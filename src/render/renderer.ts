import type { Decor, Obstacle, Pickup, Tank, World } from '../engine/types'
import { TAU, clamp, fitView, followView } from '../engine/math'
import type { View } from '../engine/math'
import { PICKUP_STATS } from '../data/balance'
import type { Palette } from './theme'
import { shade, skinTone, tankTone } from './theme'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export class Renderer {
  view: View = { scale: 1, offsetX: 0, offsetY: 0 }
  width = 1
  height = 1

  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private palette: Palette
  private shakeEnabled = true
  private vignette: CanvasGradient | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    palette: Palette = 'default',
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx
    this.palette = palette
    window.addEventListener('resize', this.resize)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(canvas.parentElement ?? canvas)
    }
    this.resize()
  }

  setPalette(palette: Palette): void {
    this.palette = palette
  }

  setShakeEnabled(enabled: boolean): void {
    this.shakeEnabled = enabled
  }

  resize = (): void => {
    const rect = this.canvas.getBoundingClientRect()
    const cssW = Math.max(1, Math.round(rect.width || window.innerWidth))
    const cssH = Math.max(1, Math.round(rect.height || window.innerHeight))
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = cssW
    this.height = cssH
    this.dpr = dpr
    this.canvas.width = Math.round(cssW * dpr)
    this.canvas.height = Math.round(cssH * dpr)
    this.vignette = null
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  draw(world: World): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = '#080a07'
    ctx.fillRect(0, 0, this.width, this.height)

    const view =
      world.map.camera === 'follow'
        ? followView(
            world.map.width,
            world.map.height,
            this.width,
            this.height,
            world.tanks.find((tank) => tank.playerIndex !== null)?.x ?? world.map.width / 2,
            world.tanks.find((tank) => tank.playerIndex !== null)?.y ?? world.map.height / 2,
          )
        : fitView(world.map.width, world.map.height, this.width, this.height)
    this.view = view

    const shake = this.shakeEnabled ? world.shake : 0
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0

    ctx.save()
    ctx.translate(view.offsetX + sx, view.offsetY + sy)
    ctx.scale(view.scale, view.scale)

    this.drawGround(world)
    this.drawWater(world)
    this.drawZone(world)
    this.drawObstacles(world)
    this.drawRubble(world)
    this.drawPickups(world)
    this.drawFlags(world)
    this.drawTanks(world)
    this.drawProjectiles(world)
    this.drawParticles(world)

    ctx.restore()

    this.drawScreenEffects(world)
    this.drawMinimap(world)
  }

  private drawGround(world: World): void {
    const ctx = this.ctx
    const map = world.map
    const theme = map.theme

    ctx.fillStyle = theme.ground
    ctx.fillRect(0, 0, map.width, map.height)

    this.drawTerrain(world)

    for (const decor of map.decor) {
      this.drawDecor(world, decor)
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = theme.grid
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = map.cell; x < map.width; x += map.cell) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, map.height)
    }
    for (let y = map.cell; y < map.height; y += map.cell) {
      ctx.moveTo(0, y)
      ctx.lineTo(map.width, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.strokeStyle = '#0a0d08'
    ctx.lineWidth = 8
    ctx.strokeRect(0, 0, map.width, map.height)
  }

  /** Roads, paving, lawns and fields painted under the combat layer. */
  private drawTerrain(world: World): void {
    const ctx = this.ctx
    const theme = world.map.theme

    for (const t of world.map.terrain) {
      switch (t.kind) {
        case 'road': {
          ctx.fillStyle = theme.road
          ctx.fillRect(t.x, t.y, t.w, t.h)
          ctx.strokeStyle = theme.roadLine
          ctx.globalAlpha = 0.32
          ctx.lineWidth = 2
          ctx.setLineDash([20, 16])
          ctx.beginPath()
          if (t.w >= t.h) {
            const y = t.y + t.h / 2
            ctx.moveTo(t.x + 6, y)
            ctx.lineTo(t.x + t.w - 6, y)
          } else {
            const x = t.x + t.w / 2
            ctx.moveTo(x, t.y + 6)
            ctx.lineTo(x, t.y + t.h - 6)
          }
          ctx.stroke()
          ctx.setLineDash([])
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'
          ctx.lineWidth = 2
          ctx.strokeRect(t.x + 1, t.y + 1, t.w - 2, t.h - 2)
          break
        }
        case 'pavement': {
          ctx.fillStyle = theme.pavement
          ctx.fillRect(t.x, t.y, t.w, t.h)
          ctx.strokeStyle = theme.grid
          ctx.globalAlpha = 0.35
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let x = t.x + 20; x < t.x + t.w; x += 20) {
            ctx.moveTo(x, t.y)
            ctx.lineTo(x, t.y + t.h)
          }
          for (let y = t.y + 20; y < t.y + t.h; y += 20) {
            ctx.moveTo(t.x, y)
            ctx.lineTo(t.x + t.w, y)
          }
          ctx.stroke()
          ctx.strokeStyle = shade(theme.pavement, -0.18)
          ctx.globalAlpha = 0.6
          ctx.strokeRect(t.x + 1, t.y + 1, t.w - 2, t.h - 2)
          break
        }
        case 'grass': {
          ctx.fillStyle = theme.grass
          ctx.fillRect(t.x, t.y, t.w, t.h)
          ctx.strokeStyle = theme.groundAlt
          ctx.globalAlpha = 0.35
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let y = t.y + 12; y < t.y + t.h; y += 16) {
            ctx.moveTo(t.x, y)
            ctx.lineTo(t.x + t.w, y)
          }
          ctx.stroke()
          break
        }
        case 'dirt': {
          ctx.fillStyle = theme.dirt
          ctx.fillRect(t.x, t.y, t.w, t.h)
          ctx.strokeStyle = shade(theme.dirt, -0.16)
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 2
          ctx.beginPath()
          for (let y = t.y + 9; y < t.y + t.h; y += 12) {
            ctx.moveTo(t.x + 2, y)
            ctx.lineTo(t.x + t.w - 2, y)
          }
          ctx.stroke()
          break
        }
      }
    }
    ctx.globalAlpha = 1
  }

  /** Scenery is biome-specific so each arena reads as a place, not a grid. */
  private drawDecor(world: World, decor: Decor): void {
    const ctx = this.ctx
    const theme = world.map.theme
    const biome = world.map.biome
    const tone = decor.tone

    if (biome === 'park' || biome === 'village') {
      ctx.globalAlpha = 0.28 + tone * 0.2
      ctx.fillStyle = theme.grass
      ctx.beginPath()
      ctx.arc(decor.x, decor.y, decor.r * 0.75, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = biome === 'village' && tone > 0.82 ? theme.roadLine : theme.treeTop
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const angle = tone * TAU + i * 1.9
        const len = decor.r * (0.22 + ((tone * 13 + i) % 1) * 0.2)
        ctx.moveTo(decor.x + Math.cos(angle) * 3, decor.y + Math.sin(angle) * 3)
        ctx.lineTo(decor.x + Math.cos(angle) * len, decor.y + Math.sin(angle) * len)
      }
      ctx.stroke()
      return
    }

    if (biome === 'city') {
      if (tone > 0.55) {
        ctx.globalAlpha = 0.4
        ctx.fillStyle = theme.groundAlt
        ctx.beginPath()
        ctx.arc(decor.x, decor.y, decor.r * 0.36, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = theme.grid
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else {
        ctx.globalAlpha = 0.16 + tone * 0.12
        ctx.fillStyle = theme.groundAlt
        ctx.beginPath()
        ctx.ellipse(decor.x, decor.y, decor.r, decor.r * 0.42, tone * Math.PI, 0, TAU)
        ctx.fill()
      }
      return
    }

    if (biome === 'industrial') {
      ctx.globalAlpha = 0.16 + tone * 0.16
      ctx.fillStyle = theme.groundAlt
      ctx.beginPath()
      ctx.ellipse(decor.x, decor.y, decor.r, decor.r * 0.55, tone * 2.4, 0, TAU)
      ctx.fill()
      if (tone > 0.78) {
        ctx.globalAlpha = 0.32
        ctx.strokeStyle = theme.roadLine
        ctx.lineWidth = 1
        ctx.strokeRect(decor.x - decor.r * 0.3, decor.y - decor.r * 0.2, decor.r * 0.6, decor.r * 0.4)
      }
      return
    }

    // ruins
    ctx.globalAlpha = 0.22 + tone * 0.2
    ctx.fillStyle = theme.groundAlt
    ctx.beginPath()
    ctx.ellipse(decor.x, decor.y, decor.r, decor.r * 0.58, tone * Math.PI, 0, TAU)
    ctx.fill()
    if (tone > 0.86) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = theme.accent
      ctx.fillRect(decor.x - 1.5, decor.y - 1.5, 3, 3)
    }
  }

  private drawWater(world: World): void {
    const ctx = this.ctx
    const theme = world.map.theme
    for (const water of world.map.water) {
      ctx.fillStyle = theme.water
      ctx.fillRect(water.x, water.y, water.w, water.h)
      ctx.strokeStyle = theme.waterEdge
      ctx.lineWidth = 2
      ctx.strokeRect(water.x + 1, water.y + 1, water.w - 2, water.h - 2)

      ctx.strokeStyle = theme.waterEdge
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const y = water.y + 10 + i * 12
        if (y > water.y + water.h - 4) break
        const offset = Math.sin(world.time * 1.6 + i * 1.7) * 8
        ctx.moveTo(water.x + 10 + offset, y)
        ctx.lineTo(water.x + water.w - 10 + offset, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  private drawZone(world: World): void {
    const zone = world.zone
    if (!zone) return
    const ctx = this.ctx
    const accent = world.map.theme.accent
    const color = zone.contested ? '#ff6b5a' : accent

    ctx.globalAlpha = 0.1 + zone.progress * 0.22
    ctx.fillStyle = color
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h)
    ctx.globalAlpha = 1

    ctx.setLineDash([14, 10])
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h)
    ctx.setLineDash([])

    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    roundRect(ctx, zone.x, zone.y - 16, zone.w, 9, 4)
    ctx.fill()
    ctx.fillStyle = color
    if (zone.progress > 0) {
      roundRect(ctx, zone.x, zone.y - 16, Math.max(6, zone.w * zone.progress), 9, 4)
      ctx.fill()
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(zone.x + zone.w / 2, zone.y + 8)
    ctx.lineTo(zone.x + zone.w / 2, zone.y + zone.h - 8)
    ctx.moveTo(zone.x + 8, zone.y + zone.h / 2)
    ctx.lineTo(zone.x + zone.w - 8, zone.y + zone.h / 2)
    ctx.stroke()
  }

  private drawObstacles(world: World): void {
    const ctx = this.ctx
    const theme = world.map.theme
    for (const o of world.obstacles) {
      if (!o.alive) continue
      ctx.fillStyle = theme.shadow
      roundRect(ctx, o.x + 3, o.y + 4, o.w, o.h, 4)
      ctx.fill()

      const damage = Number.isFinite(o.maxHp) ? 1 - Math.max(0, o.hp) / o.maxHp : 0

      if (o.kind === 'wall') {
        ctx.fillStyle = theme.wall
        ctx.fillRect(o.x, o.y, o.w, o.h)
        ctx.fillStyle = theme.wallTop
        ctx.fillRect(o.x, o.y, o.w, Math.min(8, o.h))
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 2
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2)
        ctx.fillStyle = `rgba(255,255,255,${0.03 + o.tone * 0.05})`
        ctx.fillRect(o.x, o.y + o.h - 5, o.w, 3)
      } else if (o.kind === 'crate') {
        ctx.fillStyle = theme.crate
        roundRect(ctx, o.x, o.y, o.w, o.h, 3)
        ctx.fill()
        ctx.strokeStyle = shade(theme.crate, -0.45)
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = `rgba(0,0,0,${0.18 + damage * 0.25})`
        ctx.beginPath()
        for (let i = 1; i < 3; i++) {
          const y = o.y + (o.h / 3) * i
          ctx.moveTo(o.x + 3, y)
          ctx.lineTo(o.x + o.w - 3, y)
        }
        ctx.moveTo(o.x + o.w / 2, o.y + 3)
        ctx.lineTo(o.x + o.w / 2, o.y + o.h - 3)
        ctx.stroke()
        if (damage > 0.05) {
          ctx.fillStyle = `rgba(20,10,6,${Math.min(0.5, damage * 0.6)})`
          roundRect(ctx, o.x, o.y, o.w, o.h, 3)
          ctx.fill()
          this.drawCracks(o, damage)
        }
      } else if (o.kind === 'rock') {
        const cx = o.x + o.w / 2
        const cy = o.y + o.h / 2
        const points = 6
        ctx.beginPath()
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * TAU + o.tone * 1.4
          const wobble = 0.78 + ((o.tone * 17 + i * 0.37) % 1) * 0.28
          const px = cx + Math.cos(angle) * (o.w / 2) * wobble
          const py = cy + Math.sin(angle) * (o.h / 2) * wobble
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fillStyle = shade(theme.rock, -damage * 0.34)
        ctx.fill()
        ctx.strokeStyle = shade(theme.rockTop, -damage * 0.2)
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.beginPath()
        ctx.arc(cx - o.w * 0.15, cy - o.h * 0.2, Math.min(o.w, o.h) * 0.2, 0, TAU)
        ctx.fill()
        this.drawCracks(o, damage)
      } else if (o.kind === 'building') {
        this.drawBuilding(world, o, damage)
      } else {
        this.drawTree(world, o, damage)
      }
    }
  }

  private drawBuilding(world: World, o: Obstacle, damage: number): void {
    const ctx = this.ctx
    const theme = world.map.theme
    const biome = world.map.biome
    const inset = Math.min(6, Math.min(o.w, o.h) * 0.14)

    ctx.fillStyle = theme.building
    ctx.fillRect(o.x, o.y, o.w, o.h)
    ctx.fillStyle = theme.buildingRoof
    ctx.fillRect(o.x + inset, o.y + inset, o.w - inset * 2, o.h - inset * 2)
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 2
    ctx.strokeRect(o.x + inset + 1, o.y + inset + 1, o.w - inset * 2 - 2, o.h - inset * 2 - 2)

    if (biome === 'village' || biome === 'ruins') {
      ctx.strokeStyle = shade(theme.buildingRoof, -0.28)
      ctx.lineWidth = 2
      ctx.beginPath()
      if (o.w >= o.h) {
        ctx.moveTo(o.x + inset + 3, o.y + o.h / 2)
        ctx.lineTo(o.x + o.w - inset - 3, o.y + o.h / 2)
      } else {
        ctx.moveTo(o.x + o.w / 2, o.y + inset + 3)
        ctx.lineTo(o.x + o.w / 2, o.y + o.h - inset - 3)
      }
      ctx.stroke()
    }

    if (biome === 'city') {
      const cols = Math.max(1, Math.floor((o.w - inset * 2) / 26))
      const rows = Math.max(1, Math.floor((o.h - inset * 2) / 24))
      const gapX = (o.w - inset * 2) / cols
      const gapY = (o.h - inset * 2) / rows
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const lit = (i * 7 + j * 13 + o.id) % 5 !== 0 && damage < 0.72
          ctx.fillStyle = lit ? 'rgba(190,220,245,0.32)' : 'rgba(12,14,18,0.5)'
          ctx.fillRect(
            o.x + inset + gapX * (i + 0.3),
            o.y + inset + gapY * (j + 0.32),
            gapX * 0.4,
            gapY * 0.3,
          )
        }
      }
    } else if (biome === 'industrial') {
      ctx.fillStyle = 'rgba(184,208,214,0.2)'
      const along = o.w >= o.h
      const panels = Math.max(1, Math.floor((along ? o.w : o.h) / 30))
      for (let i = 0; i < panels; i++) {
        if (along) {
          ctx.fillRect(o.x + inset + 6 + i * 30, o.y + o.h * 0.38, 18, Math.max(6, o.h * 0.24))
        } else {
          ctx.fillRect(o.x + o.w * 0.38, o.y + inset + 6 + i * 30, Math.max(6, o.w * 0.24), 18)
        }
      }
    } else if (biome === 'ruins') {
      const holes = 2 + Math.floor(o.tone * 3)
      for (let i = 0; i < holes; i++) {
        const t = ((o.id * 31 + i * 47) % 100) / 100
        const u = ((o.id * 59 + i * 23) % 100) / 100
        ctx.fillStyle = 'rgba(8,7,6,0.55)'
        ctx.beginPath()
        ctx.ellipse(
          o.x + inset + 4 + t * (o.w - inset * 2 - 8),
          o.y + inset + 4 + u * (o.h - inset * 2 - 8),
          3 + ((o.id + i) % 5),
          2 + ((o.id + i * 3) % 4),
          t * TAU,
          0,
          TAU,
        )
        ctx.fill()
      }
    }

    if (o.h >= 48 && o.w >= 34) {
      ctx.fillStyle = shade(theme.building, -0.4)
      ctx.fillRect(o.x + o.w / 2 - 7, o.y + o.h - inset - 9, 14, 9)
      ctx.fillStyle = 'rgba(220,205,150,0.2)'
      ctx.fillRect(o.x + o.w / 2 - 4, o.y + o.h - inset - 6, 8, 3)
    }

    this.drawDamageTint(o, damage)
    this.drawCracks(o, damage)
  }

  private drawTree(world: World, o: Obstacle, damage: number): void {
    const ctx = this.ctx
    const theme = world.map.theme
    const cx = o.x + o.w / 2
    const cy = o.y + o.h / 2
    const min = Math.min(o.w, o.h)

    ctx.fillStyle = shade(theme.tree, -0.35)
    ctx.beginPath()
    ctx.arc(cx, cy + min * 0.18, min * 0.16, 0, TAU)
    ctx.fill()

    const along = o.w >= o.h
    const span = along ? o.w : o.h
    const count = Math.max(1, Math.round(span / 34))
    const step = span / count
    const radius = Math.min(along ? o.h : o.w, step) * 0.62

    for (let i = 0; i < count; i++) {
      const offset = -span / 2 + step * (i + 0.5)
      const px = cx + (along ? offset : 0)
      const py = cy + (along ? 0 : offset)
      ctx.fillStyle = damage > 0.55 ? theme.rock : theme.tree
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, TAU)
      ctx.fill()
      ctx.fillStyle = damage > 0.55 ? theme.rockTop : theme.treeTop
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.arc(px - radius * 0.22, py - radius * 0.26, radius * 0.55, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    this.drawCracks(o, damage)
  }

  private drawDamageTint(o: Obstacle, damage: number): void {
    if (damage <= 0.04) return
    const ctx = this.ctx
    ctx.fillStyle = `rgba(16,12,9,${Math.min(0.42, damage * 0.42)})`
    ctx.fillRect(o.x, o.y, o.w, o.h)
  }

  private drawCracks(o: Obstacle, damage: number): void {
    if (damage <= 0.08) return
    const ctx = this.ctx
    const seed = o.id * 73 + Math.floor(o.tone * 97)
    ctx.save()
    ctx.beginPath()
    ctx.rect(o.x + 1, o.y + 1, o.w - 2, o.h - 2)
    ctx.clip()
    ctx.strokeStyle = `rgba(10,8,6,${0.18 + damage * 0.45})`
    ctx.lineWidth = 1 + damage * 1.4
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      let x = o.x + o.w * (0.18 + ((seed + i * 17) % 100) / 160)
      let y = o.y + o.h * (0.18 + ((seed + i * 31) % 100) / 160)
      ctx.moveTo(x, y)
      for (let j = 1; j <= 3; j++) {
        x += Math.cos(seed * 0.3 + i * 2.1 + j * 1.7) * o.w * 0.09
        y += Math.sin(seed * 0.5 + i * 1.3 + j * 2.2) * o.h * 0.09
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  private drawRubble(world: World): void {
    const ctx = this.ctx
    const theme = world.map.theme
    for (const o of world.obstacles) {
      if (o.alive || o.kind === 'wall') continue
      const color =
        o.kind === 'crate'
          ? theme.crateTop
          : o.kind === 'tree'
            ? theme.tree
            : o.kind === 'building'
              ? theme.building
              : theme.rock

      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4)
      const chunks = Math.min(14, Math.max(4, Math.round((o.w * o.h) / 1500)))
      for (let i = 0; i < chunks; i++) {
        const t = ((o.id * 37 + i * 53) % 100) / 100
        const u = ((o.id * 91 + i * 29) % 100) / 100
        const size = 2 + ((o.id + i * 7) % 4)
        ctx.globalAlpha = 0.6
        ctx.fillStyle = i % 2 === 0 ? color : shade(color, -0.3)
        ctx.save()
        ctx.translate(o.x + 5 + t * (o.w - 10), o.y + 5 + u * (o.h - 10))
        ctx.rotate(t * TAU)
        ctx.fillRect(-size / 2, -size / 2, size, size)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }

  private drawPickups(world: World): void {
    const ctx = this.ctx
    for (const pickup of world.pickups) {
      if (!pickup.alive) continue
      const stats = PICKUP_STATS[pickup.kind]
      const y = pickup.y + Math.sin(pickup.bob) * 3.5
      const fade = pickup.life < 8 ? 0.4 + 0.6 * Math.abs(Math.sin(pickup.life * 4)) : 1
      ctx.globalAlpha = fade
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(pickup.x, pickup.y + 12, 12, 5, 0, 0, TAU)
      ctx.fill()

      ctx.fillStyle = 'rgba(12,16,10,0.9)'
      roundRect(ctx, pickup.x - 12, y - 12, 24, 24, 7)
      ctx.fill()
      ctx.strokeStyle = stats.color
      ctx.lineWidth = 2
      ctx.stroke()
      this.drawPickupGlyph(pickup, pickup.x, y, stats.color)

      ctx.globalAlpha = 0.18
      ctx.fillStyle = stats.color
      ctx.beginPath()
      ctx.arc(pickup.x, y, 17 + Math.sin(pickup.bob * 0.8) * 2, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  private drawPickupGlyph(pickup: Pickup, x: number, y: number, color: string): void {
    const ctx = this.ctx
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    switch (pickup.kind) {
      case 'health':
        ctx.fillRect(x - 6, y - 2, 12, 4)
        ctx.fillRect(x - 2, y - 6, 4, 12)
        break
      case 'ammo':
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(x + i * 5 - 1.5, y - 5, 3, 10)
        }
        break
      case 'damage':
        ctx.beginPath()
        ctx.moveTo(x, y - 7)
        ctx.lineTo(x + 6, y + 2)
        ctx.lineTo(x + 2, y + 2)
        ctx.lineTo(x + 2, y + 7)
        ctx.lineTo(x - 2, y + 7)
        ctx.lineTo(x - 2, y + 2)
        ctx.lineTo(x - 6, y + 2)
        ctx.closePath()
        ctx.fill()
        break
      case 'speed':
        ctx.beginPath()
        ctx.moveTo(x + 2, y - 8)
        ctx.lineTo(x - 5, y + 1)
        ctx.lineTo(x, y + 1)
        ctx.lineTo(x - 2, y + 8)
        ctx.lineTo(x + 5, y - 1)
        ctx.lineTo(x, y - 1)
        ctx.closePath()
        ctx.fill()
        break
      case 'armor':
        ctx.beginPath()
        ctx.moveTo(x, y - 8)
        ctx.lineTo(x + 6, y - 4)
        ctx.lineTo(x + 6, y + 2)
        ctx.lineTo(x, y + 8)
        ctx.lineTo(x - 6, y + 2)
        ctx.lineTo(x - 6, y - 4)
        ctx.closePath()
        ctx.stroke()
        break
      case 'shield':
        ctx.beginPath()
        ctx.arc(x, y, 6, Math.PI * 0.15, Math.PI * 0.85, true)
        ctx.stroke()
        break
    }
  }

  private drawFlags(world: World): void {
    if (world.flags.length === 0) return
    const ctx = this.ctx

    for (const flag of world.flags) {
      const color = flag.team === 0 ? '#63d1b4' : '#e2574c'
      const wave = Math.sin(world.time * 5 + flag.team) * 3

      // Home pad.
      ctx.globalAlpha = flag.carriedBy !== null ? 0.18 : 0.4
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(flag.homeX, flag.homeY, 22, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(flag.homeX, flag.homeY, 15, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // Pole.
      ctx.fillStyle = '#e7eee1'
      ctx.fillRect(flag.x - 1.5, flag.y - 20, 3, 28)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(flag.x - 1.5, flag.y - 20, 1.5, 28)

      // Cloth.
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(flag.x + 1.5, flag.y - 20)
      ctx.lineTo(flag.x + 20 + wave, flag.y - 15)
      ctx.lineTo(flag.x + 1.5, flag.y - 8)
      ctx.closePath()
      ctx.fill()

      if (flag.carriedBy !== null) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(world.time * 7))
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(flag.x, flag.y, 30, 0, TAU)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }

  private drawTanks(world: World): void {
    const ctx = this.ctx
    for (const tank of world.tanks) {
      if (!tank.alive) continue
      this.drawTank(ctx, tank, world.time)
    }
  }

  private drawTank(ctx: CanvasRenderingContext2D, tank: Tank, time: number): void {
    const skin = tank.skin ? skinTone(tank.skin, this.palette) : null
    const tone =
      skin ?? tankTone(tank.team, tank.playerIndex !== null, this.palette, tank.color)

    ctx.save()
    ctx.translate(tank.x, tank.y)

    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(2, 5, tank.radius * 1.35, tank.radius * 1.05, 0, 0, TAU)
    ctx.fill()

    const visual = tank.isBoss ? clamp(tank.radius / 15, 1, 2.1) : 1
    if (tank.isBoss) {
      ctx.globalAlpha = 0.28 + 0.16 * Math.sin(time * 4)
      ctx.strokeStyle = tank.enraged ? '#ff4d3d' : tank.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, tank.radius + 10, 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.save()
    if (visual !== 1) ctx.scale(visual, visual)

    ctx.save()
    ctx.rotate(tank.hullAngle)

    ctx.fillStyle = tone.tread
    roundRect(ctx, -18, -15, 36, 8, 3)
    ctx.fill()
    roundRect(ctx, -18, 7, 36, 8, 3)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const offset = ((tank.trackPhase * 10 + i * 8) % 32) - 16
      ctx.moveTo(offset, -14)
      ctx.lineTo(offset, -8)
      ctx.moveTo(offset, 8)
      ctx.lineTo(offset, 14)
    }
    ctx.stroke()

    ctx.fillStyle = tone.body
    roundRect(ctx, -17, -10, 34, 20, 5)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.fillStyle = tone.turret
    roundRect(ctx, 8, -5, 7, 10, 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(-12, -8, 20, 3)
    ctx.restore()

    ctx.save()
    ctx.rotate(tank.turretAngle)
    const recoil = tank.recoil
    ctx.fillStyle = tone.barrel
    roundRect(ctx, 4 - recoil, -3.5, 26, 7, 3)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(26 - recoil, -4.5, 4, 9)
    ctx.fillStyle = tone.turret
    ctx.beginPath()
    ctx.arc(0, 0, 9.5, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.arc(0, 0, 4.5, 0, TAU)
    ctx.fill()
    ctx.restore()
    ctx.restore()

    if (tank.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.8, tank.hitFlash * 3)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, tank.radius + 2, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    if (tank.spawnProtection > 0) {
      ctx.globalAlpha = 0.3 + 0.3 * Math.abs(Math.sin(time * 12))
      ctx.strokeStyle = '#f4ffe9'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, tank.radius + 7, 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (tank.shield > 0) {
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 6)
      ctx.strokeStyle = '#66e0d0'
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, tank.radius + 5, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    const frac = clamp(tank.hp / tank.maxHp, 0, 1)
    const barY = tank.isBoss ? -52 : -32
    const barW = tank.isBoss ? 58 : 38
    if (tank.isBoss || frac < 1 || tank.playerIndex !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      roundRect(ctx, -barW / 2, barY, barW, tank.isBoss ? 7 : 5, 2)
      ctx.fill()
      ctx.fillStyle = tank.enraged
        ? '#ff6b5a'
        : frac > 0.55
          ? '#5fd68a'
          : frac > 0.28
            ? '#f0b64b'
            : '#e2574c'
      if (frac > 0) {
        roundRect(ctx, -barW / 2 + 1, barY + 1, (barW - 2) * frac, tank.isBoss ? 5 : 3, 1.5)
        ctx.fill()
      }
    }

    if (tank.isBoss) {
      ctx.fillStyle = tank.enraged ? '#ffb3a8' : '#ffe6c2'
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(tank.bossName ?? tank.name, 0, barY - 6)
      if (tank.enraged) {
        ctx.fillStyle = '#ff6b5a'
        ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.fillText('ENRAGED', 0, barY + 16)
      }
    }

    if (tank.playerIndex !== null) {
      ctx.fillStyle = tone.marker
      ctx.beginPath()
      ctx.moveTo(0, -40)
      ctx.lineTo(-5, -46)
      ctx.lineTo(5, -46)
      ctx.closePath()
      ctx.fill()
      ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(tank.playerIndex === 0 ? 'P1' : 'P2', -16, -42)
    }

    ctx.restore()
  }

  private drawProjectiles(world: World): void {
    const ctx = this.ctx
    for (const p of world.projectiles) {
      const speed = Math.hypot(p.vx, p.vy) || 1
      const trail = p.weapon === 'rail' ? 52 : p.weapon === 'flame' ? 12 : 26
      const tx = p.x - (p.vx / speed) * Math.min(trail, speed * 0.05)
      const ty = p.y - (p.vy / speed) * Math.min(trail, speed * 0.05)

      if (p.weapon === 'plasma') {
        ctx.globalAlpha = 0.18
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 2.2, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = p.color
      ctx.globalAlpha = p.weapon === 'rail' ? 0.9 : 0.5
      ctx.lineWidth = p.weapon === 'flame' ? p.radius * 1.6 : p.radius * 1.1
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.globalAlpha = 1

      if (p.weapon === 'rocket') {
        ctx.fillStyle = '#ffb35c'
        ctx.beginPath()
        ctx.arc(tx, ty, p.radius * 0.9, 0, TAU)
        ctx.fill()
      }

      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#fffbe8'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * 0.4, 0, TAU)
      ctx.fill()
    }
  }

  private drawParticles(world: World): void {
    const ctx = this.ctx
    for (const p of world.particles) {
      const t = clamp(p.life / p.maxLife, 0, 1)
      switch (p.kind) {
        case 'spark': {
          ctx.globalAlpha = t
          ctx.strokeStyle = p.color
          ctx.lineWidth = p.size
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02)
          ctx.stroke()
          break
        }
        case 'smoke': {
          ctx.globalAlpha = t * 0.45
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, TAU)
          ctx.fill()
          break
        }
        case 'ring': {
          const progress = 1 - t
          ctx.globalAlpha = t * 0.8
          ctx.strokeStyle = p.color
          ctx.lineWidth = 3 * t + 1
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.35 + progress * 0.9), 0, TAU)
          ctx.stroke()
          break
        }
        case 'debris': {
          ctx.globalAlpha = t
          ctx.fillStyle = p.color
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.angle)
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
          break
        }
        case 'text': {
          ctx.globalAlpha = Math.min(1, t * 1.6)
          ctx.fillStyle = p.color
          ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(p.text ?? '', p.x, p.y)
          break
        }
        case 'flash': {
          ctx.globalAlpha = t * 0.85
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.6 + (1 - t) * 0.5), 0, TAU)
          ctx.fill()
          break
        }
      }
    }
    ctx.globalAlpha = 1
  }

  private drawScreenEffects(world: World): void {
    const ctx = this.ctx
    if (!this.vignette) {
      const gradient = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        Math.min(this.width, this.height) * 0.35,
        this.width / 2,
        this.height / 2,
        Math.max(this.width, this.height) * 0.72,
      )
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
      this.vignette = gradient
    }
    ctx.fillStyle = this.vignette
    ctx.fillRect(0, 0, this.width, this.height)

    if (world.hitFlash > 0) {
      ctx.fillStyle = `rgba(226,87,76,${Math.min(0.32, world.hitFlash * 0.3)})`
      ctx.fillRect(0, 0, this.width, this.height)
    }

    const player = world.tanks.find((t) => t.playerIndex === 0)
    if (player && player.alive && player.hp / player.maxHp < 0.3) {
      const pulse = 0.06 + 0.05 * Math.abs(Math.sin(world.time * 5))
      ctx.fillStyle = `rgba(226,87,76,${pulse})`
      ctx.fillRect(0, 0, this.width, this.height)
    }
  }

  private drawMinimap(world: World): void {
    const ctx = this.ctx
    const map = world.map
    const mw = 148
    const mh = Math.round((mw * map.height) / map.width)
    const x = 14
    const y = this.height - mh - 14
    const sx = mw / map.width
    const sy = mh / map.height

    ctx.save()
    ctx.globalAlpha = 0.8
    ctx.fillStyle = 'rgba(8,11,7,0.82)'
    roundRect(ctx, x, y, mw, mh, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(150,170,140,0.28)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.globalAlpha = 0.5
    for (const t of map.terrain) {
      ctx.fillStyle =
        t.kind === 'road'
          ? map.theme.road
          : t.kind === 'pavement'
            ? map.theme.pavement
            : t.kind === 'grass'
              ? map.theme.grass
              : map.theme.dirt
      ctx.fillRect(x + t.x * sx, y + t.y * sy, t.w * sx, t.h * sy)
    }
    ctx.globalAlpha = 1

    for (const o of world.obstacles) {
      if (!o.alive) continue
      ctx.fillStyle =
        o.kind === 'crate'
          ? '#8a6a3e'
          : o.kind === 'rock'
            ? '#5a5f55'
            : o.kind === 'building'
              ? '#7d8796'
              : o.kind === 'tree'
                ? '#4f7c42'
                : '#6b7768'
      ctx.fillRect(x + o.x * sx, y + o.y * sy, Math.max(1, o.w * sx), Math.max(1, o.h * sy))
    }

    if (world.zone) {
      ctx.strokeStyle = world.zone.contested ? '#ff6b5a' : '#e9b949'
      ctx.strokeRect(
        x + world.zone.x * sx,
        y + world.zone.y * sy,
        world.zone.w * sx,
        world.zone.h * sy,
      )
    }

    for (const pickup of world.pickups) {
      ctx.fillStyle = PICKUP_STATS[pickup.kind].color
      ctx.fillRect(x + pickup.x * sx - 1, y + pickup.y * sy - 1, 2, 2)
    }

    for (const flag of world.flags) {
      if (flag.team === 1 && !flag.revealed && flag.carriedBy === null) continue
      ctx.fillStyle = flag.team === 0 ? '#63d1b4' : '#ff6b5a'
      const fx = x + flag.x * sx
      const fy = y + flag.y * sy
      ctx.beginPath()
      ctx.moveTo(fx, fy - 4)
      ctx.lineTo(fx + 5, fy - 2)
      ctx.lineTo(fx, fy + 1)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(fx - 0.5, fy - 4, 1, 7)
    }

    if (world.map.camera === 'follow' && this.view.scale > 0) {
      const vx = -this.view.offsetX / this.view.scale
      const vy = -this.view.offsetY / this.view.scale
      const vw = this.width / this.view.scale
      const vh = this.height / this.view.scale
      ctx.strokeStyle = 'rgba(240, 233, 205, 0.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + vx * sx, y + vy * sy, vw * sx, vh * sy)
    }

    for (const tank of world.tanks) {
      if (!tank.alive) continue
      const tx = x + tank.x * sx
      const ty = y + tank.y * sy
      ctx.fillStyle = this.palette === 'contrast'
        ? tank.playerIndex !== null
          ? '#d9fbff'
          : '#ff5b45'
        : tank.color
      ctx.beginPath()
      ctx.arc(tx, ty, tank.isBoss ? 4.6 : tank.playerIndex !== null ? 3.4 : 2.6, 0, TAU)
      ctx.fill()
      if (tank.playerIndex !== null || tank.isBoss) {
        ctx.strokeStyle = tank.isBoss ? '#ffe08a' : '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    ctx.restore()
  }
}