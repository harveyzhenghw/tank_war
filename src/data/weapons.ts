import type { WeaponId } from '../engine/types'

export interface WeaponDef {
  id: WeaponId
  name: string
  short: string
  damage: number
  speed: number
  cooldown: number
  ammo: number | null
  radius: number
  life: number
  pellets: number
  spread: number
  splash: number
  color: string
  tracer: string
  kick: number
  sfx: 'cannon' | 'mg' | 'rocket' | 'spread'
  auto: boolean
  barrel: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    short: 'CAN',
    damage: 32,
    speed: 560,
    cooldown: 0.72,
    ammo: null,
    radius: 4,
    life: 2.4,
    pellets: 1,
    spread: 0,
    splash: 0,
    color: '#f2c14e',
    tracer: '#f8e6a0',
    kick: 6,
    sfx: 'cannon',
    auto: false,
    barrel: 27,
  },
  mg: {
    id: 'mg',
    name: 'Machine Gun',
    short: 'MG',
    damage: 6,
    speed: 820,
    cooldown: 0.08,
    ammo: 320,
    radius: 2.4,
    life: 1.15,
    pellets: 1,
    spread: 0.035,
    splash: 0,
    color: '#ffe08a',
    tracer: '#fff3c4',
    kick: 1.2,
    sfx: 'mg',
    auto: true,
    barrel: 23,
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    short: 'RKT',
    damage: 46,
    speed: 340,
    cooldown: 1.6,
    ammo: 8,
    radius: 5,
    life: 3.2,
    pellets: 1,
    spread: 0,
    splash: 76,
    color: '#ff8a4c',
    tracer: '#ffc59b',
    kick: 8,
    sfx: 'rocket',
    auto: false,
    barrel: 27,
  },
  spread: {
    id: 'spread',
    name: 'Scatter',
    short: 'SCT',
    damage: 9,
    speed: 620,
    cooldown: 1.05,
    ammo: 28,
    radius: 2.6,
    life: 0.68,
    pellets: 5,
    spread: 0.36,
    splash: 0,
    color: '#b7e28a',
    tracer: '#e6ffcc',
    kick: 5,
    sfx: 'spread',
    auto: false,
    barrel: 25,
  },
}

export const WEAPON_ORDER: WeaponId[] = ['cannon', 'mg', 'rocket', 'spread']

/** Evenly spaced pellet offsets across a symmetric spread arc. */
export function pelletAngles(count: number, spread: number): number[] {
  if (count <= 1 || spread === 0) return [0]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push((i / (count - 1) - 0.5) * spread)
  return out
}

export function startingAmmo(): Record<WeaponId, number> {
  return { cannon: Number.POSITIVE_INFINITY, mg: 320, rocket: 8, spread: 28 }
}

export function refillAmmo(ammo: Record<WeaponId, number>): void {
  ammo.mg = Math.min(480, ammo.mg + 140)
  ammo.rocket = Math.min(12, ammo.rocket + 4)
  ammo.spread = Math.min(48, ammo.spread + 18)
}