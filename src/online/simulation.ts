import { clamp, resolveCircleRect, rotateToward } from '../engine/math'
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BULLET_RADIUS,
  SPAWNS,
  TANK_RADIUS,
  WALLS,
} from './map'

export const FIXED_STEP = 1 / 60
export const MAX_HP = 100
export const BULLET_DAMAGE = 25
export const FIRE_COOLDOWN = 0.5
export const BULLET_SPEED = 480
export const BULLET_LIFETIME = 2.2
export const TANK_SPEED = 165
export const TANK_REVERSE_SPEED = 105
export const TANK_TURN_RATE = 3.05
export const TURRET_TURN_RATE = 8.5
export const ROUND_COUNTDOWN = 3

export type Role = 'host' | 'client'
export type MatchPhase = 'countdown' | 'playing' | 'roundOver'

export interface RoundWins {
  host: number
  client: number
}

export interface PlayerInput {
  seq: number
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
  /** Mouse position in logical world coordinates. */
  aimX: number
  aimY: number
}

export interface TankState {
  x: number
  y: number
  bodyAngle: number
  turretAngle: number
  hp: number
  alive: boolean
  cooldown: number
  muzzle: number
  hitFlash: number
}

export interface BulletState {
  id: string
  owner: Role
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface MatchState {
  tick: number
  phase: MatchPhase
  countdown: number
  winner: Role | null
  wins: RoundWins
  host: TankState
  client: TankState
  bullets: BulletState[]
  nextBullet: number
}

function wrapAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value))
}

export const NEUTRAL_INPUT: PlayerInput = {
  seq: 0,
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  aimX: ARENA_WIDTH / 2,
  aimY: ARENA_HEIGHT / 2,
}

function makeTank(x: number, y: number, bodyAngle: number): TankState {
  return {
    x,
    y,
    bodyAngle,
    turretAngle: bodyAngle,
    hp: MAX_HP,
    alive: true,
    cooldown: 0,
    muzzle: 0,
    hitFlash: 0,
  }
}

export function createInitialState(wins: RoundWins = { host: 0, client: 0 }): MatchState {
  return {
    tick: 0,
    phase: 'countdown',
    countdown: ROUND_COUNTDOWN,
    winner: null,
    wins: { ...wins },
    host: makeTank(SPAWNS.host.x, SPAWNS.host.y, 0),
    client: makeTank(SPAWNS.client.x, SPAWNS.client.y, Math.PI),
    bullets: [],
    nextBullet: 1,
  }
}

/** Restore tanks and bullets while keeping the series score. */
export function resetRound(state: MatchState, countdown = ROUND_COUNTDOWN): void {
  state.phase = 'countdown'
  state.countdown = countdown
  state.winner = null
  state.bullets = []
  state.nextBullet = 1
  state.host = makeTank(SPAWNS.host.x, SPAWNS.host.y, 0)
  state.client = makeTank(SPAWNS.client.x, SPAWNS.client.y, Math.PI)
}

/** Advance timers, hull movement and turret aim. Does not fire or resolve hits. */
export function stepTank(
  tank: TankState,
  input: PlayerInput,
  dt: number,
  canMove: boolean,
): void {
  if (!tank.alive) return

  tank.cooldown = Math.max(0, tank.cooldown - dt)
  tank.muzzle = Math.max(0, tank.muzzle - dt)
  tank.hitFlash = Math.max(0, tank.hitFlash - dt)

  if (canMove) {
    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (turn !== 0) {
      tank.bodyAngle += turn * TANK_TURN_RATE * dt
    }

    const drive = (input.up ? 1 : 0) - (input.down ? 1 : 0)
    if (drive !== 0) {
      const speed = drive > 0 ? TANK_SPEED : -TANK_REVERSE_SPEED
      tank.x += Math.cos(tank.bodyAngle) * speed * dt
      tank.y += Math.sin(tank.bodyAngle) * speed * dt
      resolveTankWalls(tank)
    }
  }

  const aim = Math.atan2(input.aimY - tank.y, input.aimX - tank.x)
  tank.bodyAngle = wrapAngle(tank.bodyAngle)
  tank.turretAngle = wrapAngle(
    rotateToward(tank.turretAngle, aim, TURRET_TURN_RATE * dt),
  )
}

function resolveTankWalls(tank: TankState): void {
  for (let pass = 0; pass < 2; pass++) {
    let corrected = false
    for (const wall of WALLS) {
      const fix = resolveCircleRect(tank.x, tank.y, TANK_RADIUS, wall)
      if (fix) {
        tank.x = fix.x
        tank.y = fix.y
        corrected = true
      }
    }
    if (!corrected) break
  }
  tank.x = clamp(tank.x, TANK_RADIUS, ARENA_WIDTH - TANK_RADIUS)
  tank.y = clamp(tank.y, TANK_RADIUS, ARENA_HEIGHT - TANK_RADIUS)
}

function separateTanks(a: TankState, b: TankState): void {
  if (!a.alive || !b.alive) return
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  const min = TANK_RADIUS * 2
  if (d >= min || d <= 0.0001) return
  const overlap = (min - d) / 2
  const nx = dx / d
  const ny = dy / d
  a.x = clamp(a.x - nx * overlap, TANK_RADIUS, ARENA_WIDTH - TANK_RADIUS)
  a.y = clamp(a.y - ny * overlap, TANK_RADIUS, ARENA_HEIGHT - TANK_RADIUS)
  b.x = clamp(b.x + nx * overlap, TANK_RADIUS, ARENA_WIDTH - TANK_RADIUS)
  b.y = clamp(b.y + ny * overlap, TANK_RADIUS, ARENA_HEIGHT - TANK_RADIUS)
}

function spawnBullet(state: MatchState, owner: Role, tank: TankState): void {
  const angle = tank.turretAngle
  const muzzleX = tank.x + Math.cos(angle) * (TANK_RADIUS + 13)
  const muzzleY = tank.y + Math.sin(angle) * (TANK_RADIUS + 13)
  state.bullets.push({
    id: `${owner}-${state.nextBullet++}`,
    owner,
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_LIFETIME,
  })
  tank.cooldown = FIRE_COOLDOWN
  tank.muzzle = 0.08
}

function bulletHitsWall(x: number, y: number): boolean {
  for (const wall of WALLS) {
    const closestX = clamp(x, wall.x, wall.x + wall.w)
    const closestY = clamp(y, wall.y, wall.y + wall.h)
    const dx = x - closestX
    const dy = y - closestY
    if (dx * dx + dy * dy < BULLET_RADIUS * BULLET_RADIUS) return true
  }
  return false
}

function damageTank(tank: TankState, amount: number): void {
  if (!tank.alive) return
  tank.hp = Math.max(0, tank.hp - amount)
  tank.hitFlash = 0.18
  if (tank.hp <= 0) tank.alive = false
}

function updateBullets(state: MatchState, dt: number): void {
  const survivors: BulletState[] = []

  for (const bullet of state.bullets) {
    bullet.life -= dt
    if (bullet.life <= 0) continue

    const speed = Math.hypot(bullet.vx, bullet.vy)
    const steps = Math.max(1, Math.ceil((speed * dt) / 9))
    const subDt = dt / steps
    let consumed = false

    for (let i = 0; i < steps && !consumed; i++) {
      bullet.x += bullet.vx * subDt
      bullet.y += bullet.vy * subDt

      if (
        bullet.x < 0 ||
        bullet.y < 0 ||
        bullet.x > ARENA_WIDTH ||
        bullet.y > ARENA_HEIGHT ||
        bulletHitsWall(bullet.x, bullet.y)
      ) {
        consumed = true
        break
      }

      const target = bullet.owner === 'host' ? state.client : state.host
      if (!target.alive) continue
      const rr = TANK_RADIUS + BULLET_RADIUS
      const dx = target.x - bullet.x
      const dy = target.y - bullet.y
      if (dx * dx + dy * dy > rr * rr) continue

      damageTank(target, BULLET_DAMAGE)
      consumed = true
      if (!target.alive) {
        state.phase = 'roundOver'
        state.winner = bullet.owner
        state.wins[bullet.owner] += 1
        state.bullets = []
        return
      }
      break
    }

    if (!consumed) survivors.push(bullet)
  }

  state.bullets = survivors
}

/**
 * Host-authoritative fixed-step update. The host passes its own input and the
 * latest validated input received from the client.
 */
export function stepMatch(
  state: MatchState,
  hostInput: PlayerInput,
  clientInput: PlayerInput,
  dt: number,
): void {
  const step = Math.min(0.05, Math.max(0, dt))
  state.tick += 1

  if (state.phase === 'countdown') {
    state.countdown = Math.max(0, state.countdown - step)
    stepTank(state.host, hostInput, step, false)
    stepTank(state.client, clientInput, step, false)
    if (state.countdown <= 0) state.phase = 'playing'
    return
  }

  if (state.phase === 'roundOver') {
    stepTank(state.host, hostInput, step, false)
    stepTank(state.client, clientInput, step, false)
    return
  }

  stepTank(state.host, hostInput, step, true)
  stepTank(state.client, clientInput, step, true)
  separateTanks(state.host, state.client)
  // Separation can push a tank into cover, so settle both back out of it.
  resolveTankWalls(state.host)
  resolveTankWalls(state.client)

  if (state.host.cooldown <= 0 && hostInput.fire) {
    spawnBullet(state, 'host', state.host)
  }
  if (state.client.cooldown <= 0 && clientInput.fire) {
    spawnBullet(state, 'client', state.client)
  }

  updateBullets(state, step)
}
