import type { Particle, ParticleKind, Tank, World } from '../types'
import { TAU } from '../math'

const MAX_PARTICLES = 720

function push(world: World, particle: Particle): void {
  if (world.particles.length >= MAX_PARTICLES) world.particles.shift()
  world.particles.push(particle)
}

function base(
  kind: ParticleKind,
  x: number,
  y: number,
  life: number,
  size: number,
  color: string,
): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    life,
    maxLife: life,
    size,
    color,
    angle: 0,
    spin: 0,
    drag: 0,
  }
}

export function sparkBurst(
  world: World,
  x: number,
  y: number,
  color: string,
  count = 8,
  speed = 170,
): void {
  for (let i = 0; i < count; i++) {
    const a = world.rng.angle()
    const s = world.rng.range(speed * 0.25, speed)
    const p = base('spark', x, y, world.rng.range(0.18, 0.45), world.rng.range(1.2, 2.6), color)
    p.vx = Math.cos(a) * s
    p.vy = Math.sin(a) * s
    p.drag = 3.2
    push(world, p)
  }
}

export function debris(
  world: World,
  x: number,
  y: number,
  color: string,
  count = 6,
  speed = 130,
): void {
  for (let i = 0; i < count; i++) {
    const a = world.rng.angle()
    const s = world.rng.range(speed * 0.3, speed)
    const p = base('debris', x, y, world.rng.range(0.4, 0.9), world.rng.range(2, 4.5), color)
    p.vx = Math.cos(a) * s
    p.vy = Math.sin(a) * s
    p.angle = world.rng.angle()
    p.spin = world.rng.range(-9, 9)
    p.drag = 2.4
    push(world, p)
  }
}

export function smokePuff(world: World, x: number, y: number, size = 16, color = 'rgba(60,60,55,0.5)'): void {
  const p = base('smoke', x, y, world.rng.range(0.7, 1.5), size, color)
  p.vx = world.rng.range(-22, 22)
  p.vy = world.rng.range(-30, 8)
  p.drag = 1.4
  push(world, p)
}

export function muzzleFlash(world: World, x: number, y: number, angle: number, color: string): void {
  const p = base('flash', x, y, 0.09, 12, color)
  p.angle = angle
  push(world, p)
  for (let i = 0; i < 4; i++) {
    const a = angle + world.rng.range(-0.35, 0.35)
    const s = world.rng.range(90, 260)
    const sPart = base('spark', x, y, world.rng.range(0.08, 0.2), 1.6, color)
    sPart.vx = Math.cos(a) * s
    sPart.vy = Math.sin(a) * s
    sPart.drag = 6
    push(world, sPart)
  }
}

export function ring(
  world: World,
  x: number,
  y: number,
  radius: number,
  color: string,
  life = 0.45,
): void {
  const p = base('ring', x, y, life, radius, color)
  push(world, p)
}

export function explosion(world: World, x: number, y: number, radius: number, color = '#ffb35c'): void {
  ring(world, x, y, radius * 1.25, color, 0.5)
  sparkBurst(world, x, y, color, 14, 260)
  sparkBurst(world, x, y, '#ff6a3d', 8, 180)
  debris(world, x, y, '#6a5a48', 6, 190)
  smokePuff(world, x, y, radius * 0.9)
  smokePuff(world, x, y, radius * 0.6)
  const flash = base('flash', x, y, 0.16, radius * 1.3, '#ffe6b0')
  push(world, flash)
}

export function floatText(world: World, x: number, y: number, text: string, color: string): void {
  const p = base('text', x, y, 0.75, 12, color)
  p.text = text
  p.vx = world.rng.range(-12, 12)
  p.vy = -52
  p.drag = 0.4
  push(world, p)
}

export function dustTrail(world: World, tank: Tank): void {
  if (world.rng.chance(0.28)) {
    const back = tank.hullAngle + Math.PI
    smokePuff(
      world,
      tank.x + Math.cos(back) * 12 + world.rng.range(-5, 5),
      tank.y + Math.sin(back) * 12 + world.rng.range(-5, 5),
      world.rng.range(8, 14),
      'rgba(70,66,56,0.32)',
    )
  }
}

export function updateParticles(world: World, dt: number): void {
  const alive: Particle[] = []
  for (const p of world.particles) {
    p.life -= dt
    if (p.life <= 0) continue
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.drag > 0) {
      const damp = Math.max(0, 1 - p.drag * dt)
      p.vx *= damp
      p.vy *= damp
    }
    p.angle += p.spin * dt
    if (p.kind === 'smoke') p.size += dt * 18
    alive.push(p)
  }
  world.particles = alive
}

/** Deterministic rotation helper used by the renderer for debris. */
export const PARTICLE_TURN = TAU