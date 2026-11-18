import type { Pickup, Tank, World } from '../engine/types'
import { TAU, clamp, fitView } from '../engine/math'
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

    const view = fitView(world.map.width, world.map.height, this.width, this.height)
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
    this.drawPickups(world)
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

    for (const decor of map.decor) {
      ctx.globalAlpha = 0.25 + decor.tone * 0.3
      ctx.fillStyle = theme.groundAlt
      ctx.beginPath()
      ctx.arc(decor.x, decor.y, decor.r, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = theme.grid
    ctx.globalAlpha = 0.35
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
        const damage = 1 - Math.max(0, o.hp) / o.maxHp
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
        }
      } else {
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
        ctx.fillStyle = theme.rock
        ctx.fill()
        ctx.strokeStyle = theme.rockTop
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.beginPath()
        ctx.arc(cx - o.w * 0.15, cy - o.h * 0.2, Math.min(o.w, o.h) * 0.2, 0, TAU)
        ctx.fill()
      }
    }
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
    if (frac < 1 || tank.playerIndex !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      roundRect(ctx, -19, -32, 38, 5, 2)
      ctx.fill()
      ctx.fillStyle = frac > 0.55 ? '#5fd68a' : frac > 0.28 ? '#f0b64b' : '#e2574c'
      if (frac > 0) {
        roundRect(ctx, -18, -31, 36 * frac, 3, 1.5)
        ctx.fill()
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

    for (const o of world.obstacles) {
      if (!o.alive) continue
      ctx.fillStyle = o.kind === 'crate' ? '#8a6a3e' : o.kind === 'rock' ? '#5a5f55' : '#6b7768'
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
      ctx.arc(tx, ty, tank.playerIndex !== null ? 3.4 : 2.6, 0, TAU)
      ctx.fill()
      if (tank.playerIndex !== null) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    ctx.restore()
  }
}