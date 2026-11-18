export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface View {
  scale: number
  offsetX: number
  offsetY: number
}

export const TAU = Math.PI * 2

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const distSq = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(distSq(ax, ay, bx, by))

export const len = (x: number, y: number): number => Math.hypot(x, y)

export function normalize(x: number, y: number): Vec2 {
  const l = Math.hypot(x, y)
  if (l < 1e-6) return { x: 0, y: 0 }
  return { x: x / l, y: y / l }
}

export const angleOf = (x: number, y: number): number => Math.atan2(y, x)

export const angleTo = (fx: number, fy: number, tx: number, ty: number): number =>
  Math.atan2(ty - fy, tx - fx)

/** Signed shortest rotation from a to b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** Rotate current angle toward target by at most maxStep radians. */
export function rotateToward(current: number, target: number, maxStep: number): number {
  const d = angleDiff(current, target)
  if (Math.abs(d) <= maxStep) return current + d
  return current + Math.sign(d) * maxStep
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function circleRectIntersect(cx: number, cy: number, radius: number, r: Rect): boolean {
  const px = clamp(cx, r.x, r.x + r.w)
  const py = clamp(cy, r.y, r.y + r.h)
  return distSq(cx, cy, px, py) < radius * radius
}

export function circleCircle(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const rr = ar + br
  return distSq(ax, ay, bx, by) < rr * rr
}

/**
 * Push a circle out of an axis aligned rect.
 * Returns the corrected centre, or null when there is no overlap.
 */
export function resolveCircleRect(
  cx: number,
  cy: number,
  radius: number,
  r: Rect,
): Vec2 | null {
  const px = clamp(cx, r.x, r.x + r.w)
  const py = clamp(cy, r.y, r.y + r.h)
  const dx = cx - px
  const dy = cy - py
  const d2 = dx * dx + dy * dy
  if (d2 > radius * radius) return null

  if (d2 > 1e-9) {
    const d = Math.sqrt(d2)
    const nx = dx / d
    const ny = dy / d
    return { x: px + nx * radius, y: py + ny * radius }
  }

  // Centre is inside the rect: eject through the nearest edge.
  const left = cx - r.x
  const right = r.x + r.w - cx
  const top = cy - r.y
  const bottom = r.y + r.h - cy
  const m = Math.min(left, right, top, bottom)
  if (m === left) return { x: r.x - radius, y: cy }
  if (m === right) return { x: r.x + r.w + radius, y: cy }
  if (m === top) return { x: cx, y: r.y - radius }
  return { x: cx, y: r.y + r.h + radius }
}

/** Liang-Barsky segment vs rect test. */
export function segmentRectIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rect,
): boolean {
  if (x1 === x2 && y1 === y2) return pointInRect(x1, y1, r)
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const p = [-dx, dx, -dy, dy]
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }
  return t0 <= t1
}

export function boundsOfSegment(x1: number, y1: number, x2: number, y2: number, pad = 2): Rect {
  return {
    x: Math.min(x1, x2) - pad,
    y: Math.min(y1, y2) - pad,
    w: Math.abs(x2 - x1) + pad * 2,
    h: Math.abs(y2 - y1) + pad * 2,
  }
}

/** Fit a world rect into a viewport, letterboxing and centring it. */
export function fitView(worldW: number, worldH: number, viewW: number, viewH: number): View {
  if (worldW <= 0 || worldH <= 0 || viewW <= 0 || viewH <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const scale = Math.min(viewW / worldW, viewH / worldH)
  return {
    scale,
    offsetX: (viewW - worldW * scale) / 2,
    offsetY: (viewH - worldH * scale) / 2,
  }
}

export function screenToWorld(view: View, sx: number, sy: number): Vec2 {
  return { x: (sx - view.offsetX) / view.scale, y: (sy - view.offsetY) / view.scale }
}

export function worldToScreen(view: View, wx: number, wy: number): Vec2 {
  return { x: wx * view.scale + view.offsetX, y: wy * view.scale + view.offsetY }
}