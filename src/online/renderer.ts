import type { BulletState, MatchState, Role, TankState } from './simulation'
import { MAX_HP } from './simulation'
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BULLET_RADIUS,
  CLIENT_COLOR,
  HOST_COLOR,
  TANK_RADIUS,
  WALLS,
} from './map'

export interface RenderOptions {
  localRole: Role
  rtt: number | null
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawArena(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
  gradient.addColorStop(0, '#11170f')
  gradient.addColorStop(0.55, '#0d120c')
  gradient.addColorStop(1, '#090d08')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT)

  ctx.strokeStyle = 'rgba(99, 209, 180, 0.055)'
  ctx.lineWidth = 1
  for (let x = 40; x < ARENA_WIDTH; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, ARENA_HEIGHT)
    ctx.stroke()
  }
  for (let y = 40; y < ARENA_HEIGHT; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(ARENA_WIDTH, y + 0.5)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(233, 185, 73, 0.12)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 12])
  ctx.beginPath()
  ctx.moveTo(ARENA_WIDTH / 2, 70)
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 28)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = 'rgba(99, 209, 180, 0.18)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, ARENA_WIDTH - 2, ARENA_HEIGHT - 2)
}

function drawWalls(ctx: CanvasRenderingContext2D): void {
  for (const wall of WALLS) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
    roundRect(ctx, wall.x + 5, wall.y + 7, wall.w, wall.h, 4)
    ctx.fill()

    const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h)
    gradient.addColorStop(0, '#3b4735')
    gradient.addColorStop(0.22, '#293326')
    gradient.addColorStop(1, '#171e15')
    ctx.fillStyle = gradient
    roundRect(ctx, wall.x, wall.y, wall.w, wall.h, 4)
    ctx.fill()

    ctx.strokeStyle = 'rgba(130, 151, 117, 0.35)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = 'rgba(233, 185, 73, 0.11)'
    ctx.fillRect(wall.x + 5, wall.y + 5, wall.w - 10, 2)
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: BulletState[]): void {
  for (const bullet of bullets) {
    const color = bullet.owner === 'host' ? '#9df4de' : '#ffd77a'
    const speed = Math.hypot(bullet.vx, bullet.vy) || 1
    const tx = bullet.x - (bullet.vx / speed) * 20
    const ty = bullet.y - (bullet.vy / speed) * 20
    const trail = ctx.createLinearGradient(tx, ty, bullet.x, bullet.y)
    trail.addColorStop(0, 'rgba(255, 255, 255, 0)')
    trail.addColorStop(1, color)
    ctx.strokeStyle = trail
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(bullet.x, bullet.y)
    ctx.stroke()

    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  tank: TankState,
  color: string,
  label: string,
): void {
  if (!tank.alive) {
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = '#383b34'
    ctx.beginPath()
    ctx.arc(tank.x, tank.y, TANK_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.save()
  ctx.translate(tank.x, tank.y)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
  ctx.beginPath()
  ctx.ellipse(3, 5, TANK_RADIUS + 7, TANK_RADIUS + 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.rotate(tank.bodyAngle)

  ctx.fillStyle = '#1a2118'
  roundRect(ctx, -22, -20, 44, 40, 5)
  ctx.fill()

  ctx.fillStyle = '#0c100b'
  roundRect(ctx, -21, -23, 42, 8, 3)
  ctx.fill()
  roundRect(ctx, -21, 15, 42, 8, 3)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  for (let i = -16; i <= 16; i += 8) {
    ctx.beginPath()
    ctx.moveTo(i, -22)
    ctx.lineTo(i, -16)
    ctx.moveTo(i, 16)
    ctx.lineTo(i, 22)
    ctx.stroke()
  }

  const hull = ctx.createLinearGradient(-18, 0, 20, 0)
  hull.addColorStop(0, color)
  hull.addColorStop(1, '#344039')
  ctx.fillStyle = hull
  roundRect(ctx, -19, -14, 39, 28, 5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.stroke()

  ctx.fillStyle = '#10160f'
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Turret is independent of the hull, so draw it in world space.
  ctx.save()
  ctx.translate(tank.x, tank.y)
  ctx.rotate(tank.turretAngle)

  ctx.fillStyle = '#0d120c'
  roundRect(ctx, 7, -4, 27, 8, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.arc(2, 1, 4, 0, Math.PI * 2)
  ctx.fill()

  if (tank.muzzle > 0) {
    ctx.fillStyle = '#ffe6a3'
    ctx.shadowColor = '#ffd35f'
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.moveTo(33, 0)
    ctx.lineTo(48, -8)
    ctx.lineTo(45, 0)
    ctx.lineTo(48, 8)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.restore()

  if (tank.hitFlash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.7, tank.hitFlash * 4)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(tank.x, tank.y, TANK_RADIUS + 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const barW = 48
  const barX = tank.x - barW / 2
  const barY = tank.y - TANK_RADIUS - 22
  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)'
  roundRect(ctx, barX - 2, barY - 2, barW + 4, 9, 3)
  ctx.fill()
  const fraction = Math.max(0, Math.min(1, tank.hp / MAX_HP))
  ctx.fillStyle =
    fraction > 0.5 ? '#5fd68a' : fraction > 0.25 ? '#e9b949' : '#e2574c'
  roundRect(ctx, barX, barY, Math.max(0.01, barW * fraction), 5, 2)
  ctx.fill()

  ctx.font = '600 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(233, 237, 223, 0.78)'
  ctx.fillText(label, tank.x, barY - 4)
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  role: Role,
  tank: TankState,
  wins: number,
  local: boolean,
): void {
  const color = role === 'host' ? HOST_COLOR : CLIENT_COLOR
  const name = role === 'host' ? 'HOST' : 'GUEST'
  const hp = Math.max(0, Math.round(tank.hp))

  ctx.fillStyle = 'rgba(8, 11, 7, 0.86)'
  roundRect(ctx, x, y, width, 35, 7)
  ctx.fill()
  ctx.strokeStyle = `${color}55`
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillStyle = color
  ctx.fillText(local ? `${name} · YOU` : name, x + 10, y + 13)
  ctx.fillStyle = 'rgba(233, 237, 223, 0.7)'
  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${wins} W`, x + width - 10, y + 13)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  roundRect(ctx, x + 10, y + 19, width - 20, 7, 3)
  ctx.fill()
  ctx.fillStyle = hp > 50 ? '#5fd68a' : hp > 25 ? '#e9b949' : '#e2574c'
  roundRect(ctx, x + 10, y + 19, Math.max(0.01, ((width - 20) * hp) / MAX_HP), 7, 3)
  ctx.fill()

  ctx.fillStyle = 'rgba(233, 237, 223, 0.74)'
  ctx.font = '600 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${hp} HP`, x + width - 10, y + 33)
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  options: RenderOptions,
): void {
  const localRole = options.localRole

  ctx.fillStyle = 'rgba(5, 8, 5, 0.72)'
  ctx.fillRect(0, 0, ARENA_WIDTH, 58)

  panel(ctx, 16, 11, 260, 'host', state.host, state.wins.host, localRole === 'host')
  panel(
    ctx,
    ARENA_WIDTH - 276,
    11,
    260,
    'client',
    state.client,
    state.wins.client,
    localRole === 'client',
  )

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(233, 185, 73, 0.9)'
  ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillText('ONLINE DUEL', ARENA_WIDTH / 2, 23)
  ctx.fillStyle = 'rgba(233, 237, 223, 0.56)'
  ctx.font = '600 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const rtt = options.rtt === null ? 'MEASURING' : `${Math.round(options.rtt)} MS`
  ctx.fillText(rtt, ARENA_WIDTH / 2, 37)
  ctx.fillStyle = 'rgba(233, 237, 223, 0.32)'
  ctx.fillText('W/S DRIVE · A/D TURN · MOUSE AIM', ARENA_WIDTH / 2, 49)
}

export function drawOnlineGame(
  canvas: HTMLCanvasElement,
  state: MatchState,
  options: RenderOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (canvas.width !== ARENA_WIDTH || canvas.height !== ARENA_HEIGHT) {
    canvas.width = ARENA_WIDTH
    canvas.height = ARENA_HEIGHT
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
  drawArena(ctx)
  drawWalls(ctx)
  drawBullets(ctx, state.bullets)
  drawTank(ctx, state.host, HOST_COLOR, 'HOST')
  drawTank(ctx, state.client, CLIENT_COLOR, 'GUEST')
  drawHud(ctx, state, options)

  if (state.phase === 'countdown') {
    const number = Math.max(1, Math.ceil(state.countdown))
    ctx.fillStyle = 'rgba(5, 8, 5, 0.3)'
    ctx.fillRect(0, 58, ARENA_WIDTH, ARENA_HEIGHT - 58)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(233, 185, 73, 0.95)'
    ctx.font = '800 78px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText(String(number), ARENA_WIDTH / 2, ARENA_HEIGHT / 2)
    ctx.fillStyle = 'rgba(233, 237, 223, 0.74)'
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText('GET READY', ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 64)
  }
}
