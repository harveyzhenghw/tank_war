import type { Projectile, World } from '../types'
import { circleRectIntersect, distSq } from '../math'
import { damageTank, splashDamage } from './damage'
import { damageObstacle } from '../world'
import { explosion, sparkBurst, smokePuff } from './particles'

export function updateProjectiles(world: World, dt: number): void {
  const survivors: Projectile[] = []

  for (const p of world.projectiles) {
    p.life -= dt
    if (p.life <= 0) {
      if (p.splash > 0) detonate(world, p, undefined)
      continue
    }

    const speed = Math.hypot(p.vx, p.vy)
    const steps = Math.max(1, Math.ceil((speed * dt) / 9))
    const stepDt = dt / steps
    let consumed = false

    for (let step = 0; step < steps && !consumed; step++) {
      p.x += p.vx * stepDt
      p.y += p.vy * stepDt

      if (p.x < 0 || p.y < 0 || p.x > world.bounds.w || p.y > world.bounds.h) {
        if (p.splash > 0) detonate(world, p, undefined)
        consumed = true
        break
      }

      for (const obstacle of world.grid.queryCircle(p.x, p.y, p.radius)) {
        if (!obstacle.alive) continue
        if (!circleRectIntersect(p.x, p.y, p.radius, obstacle)) continue
        if (obstacle.kind === 'crate') damageObstacle(world, obstacle, p.damage)
        sparkBurst(world, p.x, p.y, '#d9c7a1', 5, 130)
        if (p.splash > 0) detonate(world, p, undefined)
        consumed = true
        break
      }
      if (consumed) break

      for (const tank of world.tanks) {
        if (!tank.alive || tank.id === p.ownerId || tank.team === p.team) continue
        const rr = p.radius + tank.radius
        if (distSq(p.x, p.y, tank.x, tank.y) > rr * rr) continue
        const source = world.tanks.find((t) => t.id === p.ownerId) ?? null
        damageTank(world, tank, p.damage, source)
        sparkBurst(world, p.x, p.y, p.color, 6, 160)
        if (p.splash > 0) detonate(world, p, tank.id)
        consumed = true
        break
      }
    }

    if (!consumed) {
      if (p.weapon === 'rocket' && world.rng.chance(0.55)) {
        smokePuff(world, p.x, p.y, 8, 'rgba(120,110,100,0.35)')
      }
      survivors.push(p)
    }
  }

  world.projectiles = survivors
}

function detonate(world: World, p: Projectile, directHitId: number | undefined): void {
  const source = world.tanks.find((t) => t.id === p.ownerId) ?? null
  explosion(world, p.x, p.y, p.splash, p.color)
  splashDamage(world, p.x, p.y, p.splash, p.damage * 0.8, p.team, source, directHitId)
  world.shake = Math.min(18, world.shake + 4)
  world.events.push('explosion')
}