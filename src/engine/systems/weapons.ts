import type { PlayerControls, Tank, World } from '../types'
import { DAMAGE_PICKUP_MUL } from '../../data/balance'
import { WEAPONS, pelletAngles } from '../../data/weapons'
import { muzzleFlash } from './particles'

/**
 * Fires the tank's current weapon when the trigger is held and the cooldown
 * has elapsed. Infinite-ammo weapons use Number.POSITIVE_INFINITY.
 */
export function updateFiring(world: World, tank: Tank, controls: PlayerControls): void {
  if (!tank.alive || !controls.fire || tank.cooldown > 0) return

  const def = WEAPONS[tank.weapon]
  const ammo = tank.ammo[tank.weapon]
  if (Number.isFinite(ammo) && ammo <= 0) {
    tank.weapon = 'cannon'
    tank.cooldown = 0.2
    return
  }

  const boost = tank.damageBoost > 0 ? DAMAGE_PICKUP_MUL : 1
  const muzzleX = tank.x + Math.cos(tank.turretAngle) * (def.barrel + tank.radius * 0.5)
  const muzzleY = tank.y + Math.sin(tank.turretAngle) * (def.barrel + tank.radius * 0.5)

  for (const offset of pelletAngles(def.pellets, def.spread)) {
    const angle =
      tank.turretAngle + offset + world.rng.range(-def.spread * 0.14, def.spread * 0.14)
    world.projectiles.push({
      id: world.nextId++,
      ownerId: tank.id,
      team: tank.team,
      weapon: def.id,
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(angle) * def.speed,
      vy: Math.sin(angle) * def.speed,
      damage: def.damage * boost,
      radius: def.radius,
      life: def.life,
      splash: def.splash,
      color: def.color,
      armed: 0.03,
      pierce: def.pierce,
      hitIds: [],
    })
  }

  if (Number.isFinite(ammo)) tank.ammo[tank.weapon] = Math.max(0, ammo - 1)

  tank.cooldown = def.cooldown / tank.reloadScale
  tank.recoil = def.kick
  world.shake = Math.min(18, world.shake + def.kick * 0.3)
  muzzleFlash(world, muzzleX, muzzleY, tank.turretAngle, def.tracer)
  world.events.push(def.sfx)
}