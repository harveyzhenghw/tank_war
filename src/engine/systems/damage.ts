import type { Tank, World } from '../types'
import { clamp, dist, distSq } from '../math'
import { ARMOR_PICKUP_BONUS, COINS_PER_KILL, SHIELD_REDUCTION } from '../../data/balance'
import { explosion, floatText, sparkBurst } from './particles'
import { damageObstacle } from '../world'
import { dropFlag } from './flags'

/**
 * Applies damage with shield / armour mitigation.
 * Returns the effective damage dealt.
 */
export function damageTank(world: World, tank: Tank, amount: number, source: Tank | null): number {
  if (!tank.alive || tank.spawnProtection > 0) return 0
  if (amount <= 0) return 0

  let incoming = amount
  if (tank.shield > 0) incoming *= 1 - SHIELD_REDUCTION

  const armor = clamp(tank.armor + (tank.armorBoost > 0 ? ARMOR_PICKUP_BONUS : 0), 0, 0.7)
  const dealt = Math.max(1, incoming * (1 - armor))

  tank.hp -= dealt
  tank.hitFlash = 0.2
  tank.lastHitBy = source ? source.id : null

  sparkBurst(world, tank.x, tank.y, Math.round(dealt) >= 20 ? '#ffd27a' : '#ffb35c', 6, 130)
  floatText(world, tank.x, tank.y - 18, String(Math.round(dealt)), '#ffd27a')

  const wasPlayer = tank.playerIndex !== null
  if (tank.hp <= 0) {
    tank.hp = 0
    killTank(world, tank, source)
  } else {
    world.events.push('hit')
  }
  if (wasPlayer) world.hitFlash = Math.min(1, world.hitFlash + 0.6)
  return dealt
}

export function killTank(world: World, tank: Tank, source: Tank | null): void {
  if (!tank.alive) return
  tank.alive = false
  tank.hp = 0
  tank.deaths += 1
  tank.vx = 0
  tank.vy = 0
  tank.respawnAt = world.respawn && (tank.isBot || world.respawnPlayers) ? world.time + world.respawnDelay : null

  dropFlag(world, tank.id)

  explosion(world, tank.x, tank.y, 42, '#ffb35c')
  world.shake = Math.min(18, world.shake + 9)
  world.events.push('explosion')

  if (tank.playerIndex === null) world.deaths += 1

  if (source && source.id !== tank.id && source.alive) {
    source.kills += 1
    if (source.playerIndex !== null) {
      world.kills += 1
      world.score += tank.playerIndex !== null ? 150 : tank.isBoss ? 500 : 100
      if (tank.isBot) {
        const reward = tank.isBoss ? tank.bounty : COINS_PER_KILL
        world.coinsEarned += reward
        floatText(world, tank.x, tank.y - 34, `+${reward} COINS`, '#e9b949')
      }
    }
  }

  if (tank.playerIndex !== null) {
    world.hitFlash = 1
    world.message = 'TANK DESTROYED'
    world.messageTimer = 2
  }
}

/** Radial damage with distance falloff, plus crate destruction. */
export function splashDamage(
  world: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  team: number,
  source: Tank | null,
  excludeTankId?: number,
): void {
  for (const tank of world.tanks) {
    if (!tank.alive || tank.team === team || tank.id === excludeTankId) continue
    const d = dist(x, y, tank.x, tank.y)
    if (d > radius + tank.radius) continue
    const falloff = clamp(1 - (d - tank.radius * 0.4) / radius, 0, 1)
    damageTank(world, tank, damage * Math.max(0.35, falloff), source)
  }

  for (const obstacle of world.grid.queryCircle(x, y, radius)) {
    if (!obstacle.alive) continue
    const cx = clamp(x, obstacle.x, obstacle.x + obstacle.w)
    const cy = clamp(y, obstacle.y, obstacle.y + obstacle.h)
    if (distSq(x, y, cx, cy) > radius * radius) continue
    damageObstacle(world, obstacle, damage * 1.4)
  }
}

export function isEnemy(a: Tank, b: Tank): boolean {
  return a.team !== b.team
}