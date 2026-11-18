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
  pierce: number
  color: string
  tracer: string
  kick: number
  sfx: 'cannon' | 'mg' | 'rocket' | 'spread' | 'rail' | 'plasma' | 'flame'
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
    pierce: 0,
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
    pierce: 0,
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
    pierce: 0,
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
    pierce: 0,
    color: '#b7e28a',
    tracer: '#e6ffcc',
    kick: 5,
    sfx: 'spread',
    auto: false,
    barrel: 25,
  },
  rail: {
    id: 'rail',
    name: 'Railgun',
    short: 'RAIL',
    damage: 85,
    speed: 1500,
    cooldown: 2.4,
    ammo: 5,
    radius: 3,
    life: 1.4,
    pellets: 1,
    spread: 0.006,
    splash: 0,
    pierce: 2,
    color: '#8fe8ff',
    tracer: '#d6f8ff',
    kick: 7,
    sfx: 'rail',
    auto: false,
    barrel: 30,
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma',
    short: 'PLS',
    damage: 58,
    speed: 430,
    cooldown: 1.9,
    ammo: 10,
    radius: 6,
    life: 3.2,
    pellets: 1,
    spread: 0.01,
    splash: 105,
    pierce: 0,
    color: '#c084fc',
    tracer: '#e9d5ff',
    kick: 7,
    sfx: 'plasma',
    auto: false,
    barrel: 28,
  },
  flame: {
    id: 'flame',
    name: 'Flamer',
    short: 'FLM',
    damage: 4,
    speed: 320,
    cooldown: 0.055,
    ammo: 260,
    radius: 2.2,
    life: 0.42,
    pellets: 1,
    spread: 0.16,
    splash: 0,
    pierce: 0,
    color: '#ff9a4d',
    tracer: '#ffd2a1',
    kick: 0.8,
    sfx: 'flame',
    auto: true,
    barrel: 24,
  },
}

/** The four standard weapons every tank starts with. */
export const CORE_WEAPONS: WeaponId[] = ['cannon', 'mg', 'rocket', 'spread']

export const WEAPON_ORDER: WeaponId[] = [
  'cannon',
  'mg',
  'rocket',
  'spread',
  'rail',
  'plasma',
  'flame',
]

export function isWeaponId(value: string): value is WeaponId {
  return value in WEAPONS
}

/** Store prices for the unlockable weapons. Core weapons are free. */
export const WEAPON_PRICES: Partial<Record<WeaponId, number>> = {
  rail: 280,
  plasma: 320,
  flame: 220,
}

export const PURCHASABLE_WEAPONS: WeaponId[] = ['flame', 'rail', 'plasma']

/** Evenly spaced pellet offsets across a symmetric spread arc. */
export function pelletAngles(count: number, spread: number): number[] {
  if (count <= 1 || spread === 0) return [0]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push((i / (count - 1) - 0.5) * spread)
  return out
}

export function startingAmmo(): Record<WeaponId, number> {
  return {
    cannon: Number.POSITIVE_INFINITY,
    mg: 320,
    rocket: 8,
    spread: 28,
    rail: 5,
    plasma: 10,
    flame: 260,
  }
}

export function refillAmmo(ammo: Record<WeaponId, number>): void {
  ammo.mg = Math.min(480, ammo.mg + 140)
  ammo.rocket = Math.min(12, ammo.rocket + 4)
  ammo.spread = Math.min(48, ammo.spread + 18)
  ammo.rail = Math.min(7, ammo.rail + 2)
  ammo.plasma = Math.min(14, ammo.plasma + 3)
  ammo.flame = Math.min(320, ammo.flame + 90)
}