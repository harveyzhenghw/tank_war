import type { Obstacle, Tank, World } from './types'
import { SpatialGrid } from './spatial'
import type { MapDef } from './types'
import type { Vec2 } from './math'
import { circleRectIntersect, pointInRect } from './math'
import { createRng } from './rng'
import { ENEMY_COLORS, PLAYER_STATS, PICKUP_KINDS, PICKUP_STATS, TEAM_COLORS } from '../data/balance'
import { startingAmmo } from '../data/weapons'
import type { Difficulty, Objective } from './types'

export interface WorldOptions {
  objective: Objective
  difficulty: Difficulty
  seed: number
  waves: number
  captureSeconds: number
}

export function createWorld(map: MapDef, opts: WorldOptions): World {
  const rng = createRng(opts.seed)
  const world: World = {
    map,
    bounds: { x: 0, y: 0, w: map.width, h: map.height },
    obstacles: map.obstacles.map((o) => ({ ...o, alive: true })),
    grid: new SpatialGrid<Obstacle>(64),
    tanks: [],
    projectiles: [],
    particles: [],
    pickups: [],
    zone:
      opts.objective === 'capture'
        ? {
            x: map.width / 2 - 110,
            y: map.height / 2 - 85,
            w: 220,
            h: 170,
            progress: 0,
            duration: Math.max(5, opts.captureSeconds),
            contested: false,
          }
        : null,
    objective: opts.objective,
    status: 'playing',
    time: 0,
    countdown: 3,
    shake: 0,
    hitFlash: 0,
    kills: 0,
    deaths: 0,
    score: 0,
    wave: opts.objective === 'survival' ? 1 : 0,
    wavesTotal: Math.max(1, opts.waves),
    waveTimer: opts.objective === 'survival' ? 3 : 0,
    events: [],
    message: '',
    messageTimer: 0,
    rng,
    nextId: 1,
    pickupTimer: 10,
    respawn: false,
    respawnDelay: 3,
    respawnPlayers: false,
    victoryDetail: '',
  }
  world.grid.rebuild(world.obstacles.filter((o) => o.alive))
  return world
}

export function spawnPlayer(world: World, index: number, point: Vec2): Tank {
  const hullAngle = index === 0 ? 0 : Math.PI
  return addTank(world, {
    x: point.x,
    y: point.y,
    team: index,
    playerIndex: index,
    isBot: false,
    name: index === 0 ? 'P1' : 'P2',
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    hp: PLAYER_STATS.hp,
    armor: PLAYER_STATS.armor,
    speed: PLAYER_STATS.speed,
    turnRate: PLAYER_STATS.turnRate,
    turretTurnRate: PLAYER_STATS.turretTurnRate,
    hullAngle,
    difficulty: null,
  })
}

export function spawnBot(
  world: World,
  difficulty: Difficulty,
  point: Vec2,
  profile: {
    hp: number
    armor: number
    speed: number
    turnRate: number
    turretTurnRate: number
    fireScale: number
  },
  colorIndex: number,
): Tank {
  return addTank(world, {
    x: point.x,
    y: point.y,
    team: 1,
    playerIndex: null,
    isBot: true,
    name: 'Hostile',
    color: ENEMY_COLORS[colorIndex % ENEMY_COLORS.length],
    hp: profile.hp,
    armor: profile.armor,
    speed: profile.speed,
    turnRate: profile.turnRate,
    turretTurnRate: profile.turretTurnRate,
    hullAngle: world.rng.angle(),
    difficulty,
    fireScale: profile.fireScale,
  })
}

interface TankInit {
  x: number
  y: number
  team: number
  playerIndex: number | null
  isBot: boolean
  name: string
  color: string
  hp: number
  armor: number
  speed: number
  turnRate: number
  turretTurnRate: number
  hullAngle: number
  difficulty: Difficulty | null
  fireScale?: number
}

function addTank(world: World, init: TankInit): Tank {
  const id = world.nextId++
  const tank: Tank = {
    id,
    team: init.team,
    playerIndex: init.playerIndex,
    isBot: init.isBot,
    name: init.name,
    x: init.x,
    y: init.y,
    vx: 0,
    vy: 0,
    hullAngle: init.hullAngle,
    turretAngle: init.hullAngle,
    hp: init.hp,
    maxHp: init.hp,
    armor: init.armor,
    radius: PLAYER_STATS.radius,
    speed: init.speed,
    turnRate: init.turnRate,
    turretTurnRate: init.turretTurnRate,
    weapon: 'cannon',
    ammo: startingAmmo(),
    cooldown: 0,
    reloadScale: init.fireScale ?? 1,
    alive: true,
    respawnAt: null,
    spawnProtection: 1.2,
    overdrive: 0,
    overdriveCooldown: 0,
    shield: 0,
    damageBoost: 0,
    speedBoost: 0,
    armorBoost: 0,
    trackPhase: 0,
    recoil: 0,
    hitFlash: 0,
    color: init.color,
    accent: '#12160f',
    kills: 0,
    deaths: 0,
    lastHitBy: null,
    ai: init.difficulty
      ? {
          difficulty: init.difficulty,
          targetId: null,
          mode: 'patrol',
          waypoint: null,
          think: world.rng.range(0, 0.4),
          aimOffset: 0,
          aimTimer: 0,
          stuckCheck: 0,
          lastX: init.x,
          lastY: init.y,
          unstick: 0,
          reverse: 0,
        }
      : null,
  }
  world.tanks.push(tank)
  return tank
}

export function resetTank(tank: Tank, point: Vec2): void {
  tank.x = point.x
  tank.y = point.y
  tank.vx = 0
  tank.vy = 0
  tank.hp = tank.maxHp
  tank.alive = true
  tank.respawnAt = null
  tank.spawnProtection = 1.6
  tank.cooldown = 0
  tank.recoil = 0
  tank.hitFlash = 0
  tank.weapon = 'cannon'
  tank.shield = 0
  tank.damageBoost = 0
  tank.speedBoost = 0
  tank.armorBoost = 0
  tank.overdrive = 0
  tank.overdriveCooldown = 0
  tank.hullAngle = 0
  tank.turretAngle = 0
}

export function hasLineOfSight(world: World, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2) - 2
  const minY = Math.min(y1, y2) - 2
  const maxX = Math.max(x1, x2) + 2
  const maxY = Math.max(y1, y2) + 2
  const candidates = world.grid.queryRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
  for (const o of candidates) {
    if (!o.alive) continue
    if (segmentIntersect(x1, y1, x2, y2, o)) return false
  }
  return true
}

function segmentIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: { x: number; y: number; w: number; h: number },
): boolean {
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

export function isInWater(world: World, x: number, y: number): boolean {
  for (const w of world.map.water) {
    if (pointInRect(x, y, w)) return true
  }
  return false
}

export function isPointFree(world: World, x: number, y: number, radius: number): boolean {
  if (
    x < radius + 2 ||
    y < radius + 2 ||
    x > world.bounds.w - radius - 2 ||
    y > world.bounds.h - radius - 2
  ) {
    return false
  }
  for (const w of world.map.water) {
    if (circleRectIntersect(x, y, radius * 0.7, w)) return false
  }
  for (const o of world.grid.queryCircle(x, y, radius)) {
    if (o.alive && circleRectIntersect(x, y, radius, o)) return false
  }
  return true
}

export function randomPickupKind(world: World): (typeof PICKUP_KINDS)[number] {
  const total = PICKUP_KINDS.reduce((sum, k) => sum + PICKUP_STATS[k].weight, 0)
  let roll = world.rng.next() * total
  for (const kind of PICKUP_KINDS) {
    roll -= PICKUP_STATS[kind].weight
    if (roll <= 0) return kind
  }
  return 'health'
}

export function addPickup(
  world: World,
  kind: (typeof PICKUP_KINDS)[number],
  x: number,
  y: number,
): void {
  world.pickups.push({
    id: world.nextId++,
    kind,
    x,
    y,
    bob: world.rng.range(0, Math.PI * 2),
    life: 60,
    alive: true,
  })
}

export function damageObstacle(world: World, obstacle: Obstacle, amount: number): boolean {
  if (!obstacle.alive) return false
  if (obstacle.kind !== 'crate') return false
  obstacle.hp -= amount
  if (obstacle.hp <= 0) {
    obstacle.alive = false
    world.grid.rebuild(world.obstacles.filter((o) => o.alive))
    return true
  }
  return false
}

/** Pick a spawn point far away from living players. */
export function pickBotSpawn(world: World, avoidDistance = 260): Vec2 {
  const players = world.tanks.filter((t) => t.playerIndex !== null && t.alive)
  let best: Vec2 | null = null
  let bestScore = -1
  for (let attempt = 0; attempt < 16; attempt++) {
    const point = world.rng.pick(world.map.botSpawns)
    if (!isPointFree(world, point.x, point.y, 20)) continue
    let nearest = Number.POSITIVE_INFINITY
    for (const p of players) nearest = Math.min(nearest, Math.hypot(p.x - point.x, p.y - point.y))
    const score = nearest + world.rng.range(0, 60)
    if (nearest > avoidDistance) return point
    if (score > bestScore) {
      bestScore = score
      best = point
    }
  }
  return best ?? world.map.botSpawns[0]
}