import type { Obstacle, Tank, World } from './types'
import { SpatialGrid } from './spatial'
import type { MapDef } from './types'
import type { Vec2 } from './math'
import { circleRectIntersect, pointInRect } from './math'
import { createRng } from './rng'
import { ENEMY_COLORS, PLAYER_STATS, PICKUP_KINDS, PICKUP_STATS, TEAM_COLORS, COINS_PER_KILL } from '../data/balance'
import { CORE_WEAPONS, WEAPON_ORDER, startingAmmo } from '../data/weapons'
import { DEFAULT_SKIN, SKINS } from '../data/skins'
import { boosterEffects } from '../data/boosters'
import { bossAmmo, bossDifficultyScale, type BossDef } from '../data/bosses'
import type { Difficulty, Objective, SkinId, WeaponId } from './types'
import type { Loadout } from './api'
import { debris, ring, smokePuff } from './systems/particles'

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
    flags: [],
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
    coinsEarned: 0,
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

export function spawnPlayer(
  world: World,
  index: number,
  point: Vec2,
  loadout?: Loadout,
  team = index,
): Tank {
  const hullAngle = index === 0 ? 0 : Math.PI
  const effects = loadout ? boosterEffects(loadout.boosters) : null
  const owned = loadout ? normalizeWeapons(loadout.weapons) : WEAPON_ORDER
  const skinDef = loadout?.skin ? SKINS[loadout.skin] ?? SKINS[DEFAULT_SKIN] : null
  const tank = addTank(world, {
    x: point.x,
    y: point.y,
    team,
    playerIndex: index,
    isBot: false,
    name: index === 0 ? 'P1' : 'P2',
    color: skinDef ? skinDef.body : TEAM_COLORS[index % TEAM_COLORS.length],
    hp: PLAYER_STATS.hp + (effects?.hp ?? 0),
    armor: PLAYER_STATS.armor + (effects?.armor ?? 0),
    speed: PLAYER_STATS.speed,
    turnRate: PLAYER_STATS.turnRate,
    turretTurnRate: PLAYER_STATS.turretTurnRate,
    hullAngle,
    difficulty: null,
    weapons: owned,
    skin: skinDef ? skinDef.id : null,
    ammo: playerAmmo(owned, effects?.ammoMul ?? 1),
    fireScale: effects?.reloadMul ?? 1,
  })

  if (effects) {
    tank.shield = effects.startShield
    tank.damageBoost = effects.startDamage
  }
  return tank
}

/** Keep only valid, unique weapon ids and guarantee the infinite-ammo cannon. */
function normalizeWeapons(ids: WeaponId[]): WeaponId[] {
  const owned = new Set<WeaponId>(['cannon'])
  for (const id of ids) {
    if (WEAPON_ORDER.includes(id)) owned.add(id)
  }
  return WEAPON_ORDER.filter((id) => owned.has(id))
}

function playerAmmo(weapons: WeaponId[], ammoMul: number): Record<WeaponId, number> {
  const ammo = startingAmmo()
  for (const id of WEAPON_ORDER) {
    if (!weapons.includes(id)) {
      ammo[id] = 0
    } else if (Number.isFinite(ammo[id])) {
      ammo[id] = Math.floor(ammo[id] * ammoMul)
    }
  }
  return ammo
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
    weapons: CORE_WEAPONS,
    ammo: playerAmmo(CORE_WEAPONS, 1),
  })
}

export function spawnBoss(
  world: World,
  boss: BossDef,
  difficulty: Difficulty,
  point: Vec2,
): Tank {
  const scale = bossDifficultyScale(difficulty)
  const hp = Math.round(boss.hp * scale)
  return addTank(world, {
    x: point.x,
    y: point.y,
    team: 1,
    playerIndex: null,
    isBot: true,
    name: boss.name,
    color: boss.color,
    hp,
    armor: boss.armor,
    speed: boss.speed,
    turnRate: boss.turnRate,
    turretTurnRate: boss.turretTurnRate,
    hullAngle: world.rng.angle(),
    difficulty,
    fireScale: boss.reloadScale,
    weapons: boss.weapons,
    ammo: bossAmmo(boss.weapons),
    radius: boss.radius,
    isBoss: true,
    bossName: boss.name,
    bossTitle: boss.title,
    damageScale: boss.damageScale * scale,
    bounty: boss.bounty,
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
  weapons?: WeaponId[]
  skin?: SkinId | null
  ammo?: Record<WeaponId, number>
  radius?: number
  isBoss?: boolean
  bossName?: string | null
  bossTitle?: string | null
  damageScale?: number
  bounty?: number
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
    radius: init.radius ?? PLAYER_STATS.radius,
    speed: init.speed,
    turnRate: init.turnRate,
    turretTurnRate: init.turretTurnRate,
    weapon: 'cannon',
    weapons: init.weapons ?? CORE_WEAPONS,
    ammo: init.ammo ?? startingAmmo(),
    skin: init.skin ?? null,
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
    isBoss: init.isBoss ?? false,
    bossName: init.bossName ?? null,
    bossTitle: init.bossTitle ?? null,
    enraged: false,
    damageScale: init.damageScale ?? 1,
    bounty: init.bounty ?? COINS_PER_KILL,
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
  if (!Number.isFinite(obstacle.hp)) return false

  obstacle.hp -= amount
  if (obstacle.hp > 0) return false

  obstacle.hp = 0
  obstacle.alive = false
  world.grid.rebuild(world.obstacles.filter((o) => o.alive))
  destroyFx(world, obstacle)
  return true
}

/** Collapse visuals for cover that has just been destroyed. */
function destroyFx(world: World, obstacle: Obstacle): void {
  const theme = world.map.theme
  const x = obstacle.x + obstacle.w / 2
  const y = obstacle.y + obstacle.h / 2

  switch (obstacle.kind) {
    case 'building':
      debris(world, x, y, theme.buildingRoof, 14, 210)
      debris(world, x, y, theme.building, 10, 170)
      smokePuff(world, x, y, Math.min(46, obstacle.w * 0.35), 'rgba(70,66,60,0.55)')
      smokePuff(world, x, y, Math.min(32, obstacle.h * 0.3), 'rgba(90,84,74,0.45)')
      ring(world, x, y, Math.max(obstacle.w, obstacle.h) * 0.55, theme.roadLine, 0.5)
      world.shake = Math.min(18, world.shake + 4)
      world.events.push('explosion')
      break
    case 'rock':
      debris(world, x, y, theme.rock, 10, 180)
      smokePuff(world, x, y, Math.min(30, obstacle.w * 0.4), 'rgba(84,80,72,0.4)')
      world.shake = Math.min(18, world.shake + 2)
      world.events.push('hit')
      break
    case 'tree':
      debris(world, x, y, theme.treeTop, 8, 150)
      debris(world, x, y, theme.tree, 5, 110)
      world.events.push('hit')
      break
    case 'crate':
      debris(world, x, y, theme.crateTop, 7, 150)
      smokePuff(world, x, y, 16, 'rgba(80,66,45,0.35)')
      world.events.push('hit')
      break
    case 'wall':
      break
  }
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