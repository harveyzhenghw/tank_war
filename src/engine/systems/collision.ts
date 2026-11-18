import type { World } from '../types'
import { clamp, distSq, resolveCircleRect } from '../math'

/** Moves tanks, then resolves obstacle, boundary and tank-vs-tank overlap. */
export function stepTanks(world: World, dt: number): void {
  const b = world.bounds

  for (const tank of world.tanks) {
    if (!tank.alive) continue
    tank.x += tank.vx * dt
    tank.y += tank.vy * dt

    for (let pass = 0; pass < 2; pass++) {
      const near = world.grid.queryCircle(tank.x, tank.y, tank.radius + 2)
      let corrected = false
      for (const o of near) {
        if (!o.alive) continue
        const fix = resolveCircleRect(tank.x, tank.y, tank.radius, o)
        if (fix) {
          tank.x = fix.x
          tank.y = fix.y
          corrected = true
        }
      }
      if (!corrected) break
      tank.vx *= 0.25
      tank.vy *= 0.25
    }

    tank.x = clamp(tank.x, tank.radius, b.w - tank.radius)
    tank.y = clamp(tank.y, tank.radius, b.h - tank.radius)
  }

  // Soft tank-vs-tank separation.
  for (let i = 0; i < world.tanks.length; i++) {
    const a = world.tanks[i]
    if (!a.alive) continue
    for (let j = i + 1; j < world.tanks.length; j++) {
      const bTank = world.tanks[j]
      if (!bTank.alive) continue
      const minDist = a.radius + bTank.radius
      const d2 = distSq(a.x, a.y, bTank.x, bTank.y)
      if (d2 >= minDist * minDist) continue
      const d = Math.sqrt(d2) || 0.001
      const overlap = (minDist - d) / 2
      const nx = (bTank.x - a.x) / d
      const ny = (bTank.y - a.y) / d
      a.x -= nx * overlap
      a.y -= ny * overlap
      bTank.x += nx * overlap
      bTank.y += ny * overlap
    }
  }
}