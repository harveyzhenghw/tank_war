import type { Pickup, Tank, World } from '../types'
import { distSq } from '../math'
import {
  ARMOR_PICKUP_BONUS,
  DAMAGE_PICKUP_MUL,
  PICKUP_RADIUS,
  PICKUP_STATS,
  SHIELD_REDUCTION,
} from '../../data/balance'
import { refillAmmo } from '../../data/weapons'
import { floatText, ring, sparkBurst } from './particles'

export function updatePickups(world: World, dt: number): void {
  const survivors: Pickup[] = []

  for (const pickup of world.pickups) {
    pickup.life -= dt
    pickup.bob += dt * 2.4
    if (pickup.life <= 0) continue

    let taken = false
    for (const tank of world.tanks) {
      if (!tank.alive) continue
      const rr = PICKUP_RADIUS + tank.radius
      if (distSq(tank.x, tank.y, pickup.x, pickup.y) > rr * rr) continue
      applyPickup(world, tank, pickup)
      taken = true
      break
    }

    if (!taken) survivors.push(pickup)
  }

  world.pickups = survivors
}

export function applyPickup(world: World, tank: Tank, pickup: Pickup): void {
  const stats = PICKUP_STATS[pickup.kind]
  switch (pickup.kind) {
    case 'health':
      tank.hp = Math.min(tank.maxHp, tank.hp + 38)
      break
    case 'ammo':
      refillAmmo(tank.ammo)
      break
    case 'damage':
      tank.damageBoost = 12
      break
    case 'speed':
      tank.speedBoost = 10
      break
    case 'armor':
      tank.armorBoost = 12
      break
    case 'shield':
      tank.shield = 9
      break
  }

  if (tank.playerIndex !== null) {
    world.score += 25
    world.events.push('pickup')
  }

  ring(world, pickup.x, pickup.y, 30, stats.color, 0.4)
  sparkBurst(world, pickup.x, pickup.y, stats.color, 10, 130)
  floatText(world, pickup.x, pickup.y - 12, stats.label.toUpperCase(), stats.color)
}

export function pickupValue(kind: Pickup['kind']): number {
  switch (kind) {
    case 'health':
      return 100
    case 'ammo':
      return 55
    case 'shield':
      return 60
    case 'damage':
      return 50
    case 'speed':
      return 45
    case 'armor':
      return 45
  }
}

export const PICKUP_TUNING = {
  armorBonus: ARMOR_PICKUP_BONUS,
  damageMul: DAMAGE_PICKUP_MUL,
  shieldReduction: SHIELD_REDUCTION,
}