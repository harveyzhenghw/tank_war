import type { PlayerControls, Tank, World } from '../types'
import { angleDiff, angleTo, rotateToward } from '../math'
import { OVERDRIVE, SPEED_PICKUP_MUL } from '../../data/balance'
import { isInWater } from '../world'
import { dustTrail } from './particles'

/** Advances per-tank timers. Safe to call for dead tanks. */
export function tickTank(tank: Tank, dt: number): void {
  tank.cooldown = Math.max(0, tank.cooldown - dt)
  tank.recoil = Math.max(0, tank.recoil - dt * 34)
  tank.hitFlash = Math.max(0, tank.hitFlash - dt)
  tank.spawnProtection = Math.max(0, tank.spawnProtection - dt)
  tank.shield = Math.max(0, tank.shield - dt)
  tank.damageBoost = Math.max(0, tank.damageBoost - dt)
  tank.speedBoost = Math.max(0, tank.speedBoost - dt)
  tank.armorBoost = Math.max(0, tank.armorBoost - dt)
  tank.overdrive = Math.max(0, tank.overdrive - dt)
  tank.overdriveCooldown = Math.max(0, tank.overdriveCooldown - dt)
}

export function applyControls(world: World, tank: Tank, controls: PlayerControls, dt: number): void {
  tickTank(tank, dt)
  if (!tank.alive) return

  // Weapon selection (only weapons in this tank's loadout)
  if (
    controls.selectWeapon &&
    tank.weapons.includes(controls.selectWeapon) &&
    controls.selectWeapon !== tank.weapon
  ) {
    tank.weapon = controls.selectWeapon
    tank.cooldown = Math.min(tank.cooldown, 0.15)
  } else if (controls.cycle !== 0 && tank.weapons.length > 0) {
    const idx = tank.weapons.indexOf(tank.weapon)
    const next =
      (idx + Math.sign(controls.cycle) + tank.weapons.length) % tank.weapons.length
    tank.weapon = tank.weapons[next]
    tank.cooldown = Math.min(tank.cooldown, 0.15)
  }

  // Overdrive burst
  if (controls.overdrive && tank.overdrive <= 0 && tank.overdriveCooldown <= 0) {
    tank.overdrive = OVERDRIVE.duration
    tank.overdriveCooldown = OVERDRIVE.cooldown
    world.events.push('overdrive')
    world.shake = Math.min(18, world.shake + 2)
  }

  // Hull movement: rotate toward the stick direction, drive when aligned.
  const mag = Math.min(1, Math.hypot(controls.moveX, controls.moveY))
  let speedMul = 1
  if (tank.overdrive > 0) speedMul *= OVERDRIVE.speedMul
  if (tank.speedBoost > 0) speedMul *= SPEED_PICKUP_MUL
  if (isInWater(world, tank.x, tank.y)) speedMul *= 0.55

  if (mag > 0.06) {
    const desired = Math.atan2(controls.moveY, controls.moveX)
    const turnScale = mag > 0.55 ? 1 : 0.72
    tank.hullAngle = rotateToward(tank.hullAngle, desired, tank.turnRate * dt * turnScale)
    const align = Math.cos(angleDiff(tank.hullAngle, desired))
    if (align > 0.12) {
      const speed = tank.speed * speedMul * mag * align
      tank.vx = Math.cos(tank.hullAngle) * speed
      tank.vy = Math.sin(tank.hullAngle) * speed
      tank.trackPhase += speed * dt * 0.09
      if (speed > 70) dustTrail(world, tank)
    } else {
      tank.vx = 0
      tank.vy = 0
    }
  } else {
    tank.vx = 0
    tank.vy = 0
  }

  // Independent turret
  const aim =
    controls.aimTarget !== null
      ? angleTo(tank.x, tank.y, controls.aimTarget.x, controls.aimTarget.y)
      : controls.aimAngle
  if (aim !== null) {
    tank.turretAngle = rotateToward(tank.turretAngle, aim, tank.turretTurnRate * dt)
  } else if (controls.turretTurn !== 0) {
    tank.turretAngle += controls.turretTurn * tank.turretTurnRate * dt
  }
}