import type { Difficulty, WeaponId } from '../engine/types'
import { WEAPONS } from './weapons'

export interface BossDef {
  id: string
  name: string
  title: string
  /** Base hull points before difficulty scaling. */
  hp: number
  armor: number
  speed: number
  turnRate: number
  turretTurnRate: number
  radius: number
  weapons: WeaponId[]
  /** Multiplier applied to every weapon's cooldown (higher is faster). */
  reloadScale: number
  /** Multiplier applied to every projectile's damage. */
  damageScale: number
  color: string
  accent: string
  bounty: number
  escorts: number
}

export const BOSSES: Record<string, BossDef> = {
  ironMarshal: {
    id: 'ironMarshal',
    name: 'Iron Marshal',
    title: 'Ashfield Warlord',
    hp: 1150,
    armor: 0.22,
    speed: 108,
    turnRate: 2.2,
    turretTurnRate: 2.8,
    radius: 24,
    weapons: ['cannon', 'mg', 'rocket'],
    reloadScale: 1.25,
    damageScale: 1.15,
    color: '#e2574c',
    accent: '#ffc36b',
    bounty: 150,
    escorts: 3,
  },
  warden: {
    id: 'warden',
    name: 'The Warden',
    title: 'Compound Custodian',
    hp: 1750,
    armor: 0.27,
    speed: 100,
    turnRate: 2.1,
    turretTurnRate: 3,
    radius: 26,
    weapons: ['cannon', 'plasma', 'flame', 'rocket'],
    reloadScale: 1.32,
    damageScale: 1.22,
    color: '#c084fc',
    accent: '#6ff0d0',
    bounty: 200,
    escorts: 4,
  },
  sovereign: {
    id: 'sovereign',
    name: 'The Sovereign',
    title: 'Last Tyrant of the Citadel',
    hp: 2600,
    armor: 0.32,
    speed: 112,
    turnRate: 2.4,
    turretTurnRate: 3.4,
    radius: 28,
    weapons: ['cannon', 'mg', 'rocket', 'rail', 'plasma'],
    reloadScale: 1.42,
    damageScale: 1.3,
    color: '#ff8a4c',
    accent: '#ffe08a',
    bounty: 300,
    escorts: 6,
  },
}

/** Boss hull and damage scale with the chosen campaign difficulty. */
export function bossDifficultyScale(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 0.8
    case 'normal':
      return 1
    case 'hard':
      return 1.2
    case 'veteran':
      return 1.4
  }
}

export function bossAmmo(weapons: WeaponId[]): Record<WeaponId, number> {
  const ammo: Record<WeaponId, number> = {
    cannon: Number.POSITIVE_INFINITY,
    mg: 0,
    rocket: 0,
    spread: 0,
    rail: 0,
    plasma: 0,
    flame: 0,
  }
  for (const id of weapons) {
    if (id === 'cannon') continue
    ammo[id] = Math.max(4, Math.round((WEAPONS[id].ammo ?? 4) * 1.6))
  }
  return ammo
}
