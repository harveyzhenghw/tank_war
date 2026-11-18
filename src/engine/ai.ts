import type { PlayerControls, Tank, World, WeaponId, Pickup } from './types'
import { EMPTY_CONTROLS } from './types'
import { DIFFICULTY } from '../data/balance'
import { WEAPONS } from '../data/weapons'
import { angleDiff, angleTo, clamp, dist } from './math'
import { hasLineOfSight, isPointFree } from './world'
import { pickupValue } from './systems/pickups'

export function sampleBot(world: World, tank: Tank, dt: number): PlayerControls {
  const brain = tank.ai
  if (!brain || !tank.alive) return EMPTY_CONTROLS
  const profile = DIFFICULTY[brain.difficulty]
  const healthRatio = tank.hp / tank.maxHp

  brain.think -= dt
  if (brain.think <= 0) {
    brain.think = 0.15 + world.rng.range(0, 0.18)
    const target = pickTarget(world, tank)
    brain.targetId = target ? target.id : null
    const pickup = findPickup(world, tank)

    if (healthRatio < profile.retreatAt) brain.mode = 'retreat'
    else if (target) brain.mode = 'engage'
    else if (pickup) brain.mode = 'pickup'
    else brain.mode = 'patrol'

    if (brain.mode === 'pickup' && pickup) {
      brain.waypoint = { x: pickup.x, y: pickup.y }
    }
    if (
      brain.mode === 'patrol' &&
      (!brain.waypoint || dist(tank.x, tank.y, brain.waypoint.x, brain.waypoint.y) < 44)
    ) {
      brain.waypoint = pickWaypoint(world)
    }
  }

  const target =
    brain.targetId !== null
      ? world.tanks.find((t) => t.id === brain.targetId && t.alive) ?? null
      : null

  brain.aimTimer -= dt
  if (brain.aimTimer <= 0) {
    brain.aimTimer = 0.45 + world.rng.range(0, 0.7)
    brain.aimOffset = world.rng.range(-profile.aimError, profile.aimError)
  }

  let aimAngle = tank.turretAngle
  let visible = false
  let targetDist = Number.POSITIVE_INFINITY

  if (target) {
    targetDist = dist(tank.x, tank.y, target.x, target.y)
    visible = hasLineOfSight(world, tank.x, tank.y, target.x, target.y)
    const flight = clamp(targetDist / WEAPONS[tank.weapon].speed, 0, 1.6) * profile.lead
    const px = target.x + target.vx * flight
    const py = target.y + target.vy * flight
    aimAngle = angleTo(tank.x, tank.y, px, py) + brain.aimOffset
  } else if (brain.waypoint) {
    aimAngle = angleTo(tank.x, tank.y, brain.waypoint.x, brain.waypoint.y)
  }

  const wantWeapon = target ? chooseWeapon(tank, targetDist, visible) : 'cannon'

  let desired: number | null = null
  let throttle = 1

  if (brain.mode === 'engage' && target) {
    const toTarget = angleTo(tank.x, tank.y, target.x, target.y)
    const preferred = profile.preferRange
    if (!visible && targetDist > 380) {
      desired = toTarget
      throttle = 1
    } else if (targetDist > preferred + 70) {
      desired = toTarget
      throttle = 0.95
    } else if (targetDist < preferred - 110) {
      desired = toTarget + Math.PI
      throttle = 1
    } else {
      const orbit = tank.id % 2 === 0 ? 1 : -1
      desired = toTarget + (Math.PI / 2) * orbit
      throttle = 0.8
    }
  } else if (brain.mode === 'retreat') {
    const health = findHealthPickup(world, tank)
    if (health) {
      desired = angleTo(tank.x, tank.y, health.x, health.y)
    } else if (target) {
      desired = angleTo(target.x, target.y, tank.x, tank.y)
    } else if (brain.waypoint) {
      desired = angleTo(tank.x, tank.y, brain.waypoint.x, brain.waypoint.y)
    }
    throttle = 1
  } else if (brain.waypoint) {
    const d = dist(tank.x, tank.y, brain.waypoint.x, brain.waypoint.y)
    if (d < 28) {
      brain.waypoint = null
    } else {
      desired = angleTo(tank.x, tank.y, brain.waypoint.x, brain.waypoint.y)
      throttle = d < 110 ? 0.55 : 0.85
    }
  }

  // Stuck detection: pick a new destination and briefly reverse.
  brain.stuckCheck -= dt
  if (brain.stuckCheck <= 0) {
    brain.stuckCheck = 1.2
    if (Math.hypot(tank.x - brain.lastX, tank.y - brain.lastY) < 11 && desired !== null) {
      brain.unstick = 0.6
      brain.waypoint = pickWaypoint(world)
    }
    brain.lastX = tank.x
    brain.lastY = tank.y
  }
  if (brain.unstick > 0) {
    brain.unstick -= dt
    if (desired !== null) desired += Math.PI
  }

  let moveX = 0
  let moveY = 0
  if (desired !== null) {
    const steered = steer(world, tank, desired)
    moveX = Math.cos(steered) * throttle
    moveY = Math.sin(steered) * throttle
  }

  const minRange = tank.weapon === 'rocket' ? 130 : 0
  const aimOk = target !== null && Math.abs(angleDiff(tank.turretAngle, aimAngle)) < 0.14
  const fire =
    target !== null &&
    visible &&
    aimOk &&
    targetDist < 640 &&
    targetDist > minRange &&
    tank.cooldown <= 0

  const overdrive =
    tank.overdriveCooldown <= 0 &&
    (brain.mode === 'retreat' || (brain.mode === 'engage' && targetDist > 430))

  return {
    moveX,
    moveY,
    aimAngle,
    aimTarget: null,
    turretTurn: 0,
    fire,
    overdrive,
    cycle: 0,
    selectWeapon: wantWeapon !== tank.weapon ? wantWeapon : null,
  }
}

/** Nearest hostile, preferring visible targets and players. */
export function pickTarget(world: World, tank: Tank): Tank | null {
  let best: Tank | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const other of world.tanks) {
    if (!other.alive || other.team === tank.team || other.id === tank.id) continue
    const d = dist(tank.x, tank.y, other.x, other.y)
    const los = hasLineOfSight(world, tank.x, tank.y, other.x, other.y)
    let score = d * (los ? 1 : 2.4)
    if (other.playerIndex !== null) score *= 0.75
    if (score < bestScore) {
      bestScore = score
      best = other
    }
  }
  return best
}

/** Weapon choice by range. Exposed for tuning and tests. */
export function chooseWeapon(tank: Tank, distance: number, visible: boolean): WeaponId {
  if (!visible) return tank.weapon === 'cannon' ? 'cannon' : 'cannon'
  const ammo = tank.ammo
  if (distance < 175 && ammo.spread > 0) return 'spread'
  if (distance > 340 && ammo.rocket > 0) return 'rocket'
  if (distance < 470 && ammo.mg > 0 && tank.cooldown > 0.35) return 'mg'
  return 'cannon'
}

function findPickup(world: World, tank: Tank): Pickup | null {
  if (tank.hp / tank.maxHp > 0.85 && tank.ammo.mg + tank.ammo.rocket + tank.ammo.spread > 40) {
    return null
  }
  let best: Pickup | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const pickup of world.pickups) {
    if (!pickup.alive || pickup.life < 1) continue
    const d = dist(tank.x, tank.y, pickup.x, pickup.y)
    if (d > 420) continue
    let value = pickupValue(pickup.kind)
    if (pickup.kind === 'health' && tank.hp / tank.maxHp > 0.7) value *= 0.4
    if (pickup.kind === 'ammo' && tank.ammo.mg + tank.ammo.rocket + tank.ammo.spread > 120) value *= 0.4
    const score = d - value * 1.6
    if (score < bestScore) {
      bestScore = score
      best = pickup
    }
  }
  return best
}

function findHealthPickup(world: World, tank: Tank): Pickup | null {
  let best: Pickup | null = null
  let bestDist = 420
  for (const pickup of world.pickups) {
    if (!pickup.alive || pickup.kind !== 'health') continue
    const d = dist(tank.x, tank.y, pickup.x, pickup.y)
    if (d < bestDist) {
      bestDist = d
      best = pickup
    }
  }
  return best
}

function pickWaypoint(world: World): { x: number; y: number } {
  for (let i = 0; i < 14; i++) {
    const x = world.rng.range(60, world.bounds.w - 60)
    const y = world.rng.range(60, world.bounds.h - 60)
    if (isPointFree(world, x, y, 20)) return { x, y }
  }
  return { x: world.bounds.w / 2, y: world.bounds.h / 2 }
}

/** Rotate a desired heading until a short probe is clear of cover. */
function steer(world: World, tank: Tank, desired: number): number {
  const probe = 58
  const offsets = [0, 0.42, -0.42, 0.85, -0.85, 1.3, -1.3, 1.9, -1.9, 2.5, -2.5]
  for (const offset of offsets) {
    const angle = desired + offset
    const px = tank.x + Math.cos(angle) * probe
    const py = tank.y + Math.sin(angle) * probe
    if (isPointFree(world, px, py, tank.radius + 3)) return angle
  }
  return desired + Math.PI
}