/**
 * Icon generator: writes the PNG icons required by the web app manifest.
 * Pure Node, no dependencies. Run with `npm run icons`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const SS = 3

function makeCanvas(size) {
  const px = new Uint8ClampedArray(size * SS * size * SS * 4)
  return { size, data: px, w: size * SS }
}

function blend(canvas, x, y, r, g, b, a) {
  const i = (y * canvas.w + x) * 4
  const d = canvas.data
  const sa = a / 255
  const da = d[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa <= 0) return
  d[i] = (r * sa + d[i] * da * (1 - sa)) / oa
  d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa
  d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa
  d[i + 3] = oa * 255
}

function roundRect(canvas, x, y, w, h, radius, [r, g, b], a = 255) {
  const x0 = Math.round(x * SS)
  const y0 = Math.round(y * SS)
  const x1 = Math.round((x + w) * SS)
  const y1 = Math.round((y + h) * SS)
  const rad = radius * SS
  for (let py = Math.max(0, y0); py < Math.min(canvas.w, y1); py++) {
    for (let px = Math.max(0, x0); px < Math.min(canvas.w, x1); px++) {
      const dx = Math.max(rad - (px - x0), 0, px - (x1 - rad))
      const dy = Math.max(rad - (py - y0), 0, py - (y1 - rad))
      if (dx * dx + dy * dy > rad * rad) continue
      blend(canvas, px, py, r, g, b, a)
    }
  }
}

function circle(canvas, cx, cy, radius, [r, g, b], a = 255) {
  const c = Math.round(cx * SS)
  const d = Math.round(cy * SS)
  const rad = radius * SS
  const from = Math.max(0, Math.floor(d - rad))
  const to = Math.min(canvas.w, Math.ceil(d + rad))
  for (let py = from; py < to; py++) {
    for (let px = Math.max(0, Math.floor(c - rad)); px < to; px++) {
      const dx = px - c
      const dy = py - d
      if (dx * dx + dy * dy > rad * rad) continue
      blend(canvas, px, py, r, g, b, a)
    }
  }
}

function downsample(canvas) {
  const { size, data, w } = canvas
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4
          const sa = data[i + 3] / 255
          r += data[i] * sa
          g += data[i + 1] * sa
          b += data[i + 2] * sa
          a += sa
        }
      }
      const n = SS * SS
      const alpha = a / n
      const o = (y * size + x) * 4
      out[o] = alpha > 0 ? r / a : 0
      out[o + 1] = alpha > 0 ? g / a : 0
      out[o + 2] = alpha > 0 ? b / a : 0
      out[o + 3] = alpha * 255
    }
  }
  return out
}

function drawIcon(size, maskable) {
  const c = makeCanvas(size)
  const s = size / 512
  const bg = maskable ? 0 : 96 * s
  roundRect(c, 0, 0, size, size, bg, [20, 26, 18])
  roundRect(c, 14 * s, 14 * s, size - 28 * s, size - 28 * s, maskable ? 0 : 72 * s, [44, 58, 40], 90)

  const cx = 256 * s
  const cy = 268 * s
  const scale = (maskable ? 0.78 : 1) * s

  // tracks + hull
  roundRect(c, cx - 132 * scale, cy - 58 * scale, 264 * scale, 116 * scale, 26 * scale, [38, 46, 35])
  roundRect(c, cx - 118 * scale, cy - 72 * scale, 236 * scale, 110 * scale, 22 * scale, [92, 107, 76])
  roundRect(c, cx - 118 * scale, cy - 36 * scale, 236 * scale, 44 * scale, 10 * scale, [109, 125, 90], 140)
  // turret
  circle(c, cx, cy - 10 * scale, 58 * scale, [114, 130, 88])
  circle(c, cx, cy - 10 * scale, 40 * scale, [133, 150, 105], 140)
  // barrel (rotated roughly up-right)
  for (let i = 0; i < 150; i++) {
    const t = i / 150
    const bx = cx + (8 + t * 150) * scale
    const by = cy - 10 * scale - t * 82 * scale
    circle(c, bx, by, 13 * scale, [125, 143, 99])
  }
  circle(c, cx + 158 * scale, cy - 92 * scale, 16 * scale, [233, 185, 73])
  circle(c, cx + 158 * scale, cy - 92 * scale, 30 * scale, [233, 185, 73], 60)

  // bottom accent bar
  roundRect(c, 120 * scale + (size - 512 * scale) / 2, 360 * s, 272 * s, 18 * s, 9 * s, [233, 185, 73], 170)
  return encodePng(size, downsample(c))
}

mkdirSync(OUT, { recursive: true })
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
]) {
  writeFileSync(resolve(OUT, name), drawIcon(size, maskable))
  console.log('wrote', name)
}