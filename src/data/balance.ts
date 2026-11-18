import type { Difficulty, PickupKind } from '../engine/types'

export interface BotProfile {
  hp: number
  armor: number
  speed: number
  turnRate: number
  turretTurnRate: number
  aimError: number
  reaction: number
  lead: number
  fireScale: number
  aggression: number
  retreatAt: number
  preferRange: number
}

export const DIFFICULTY: Record<Difficulty, BotProfile> = {
  easy: {
    hp: 80,
    armor: 0.02,
    speed: 106,
    turnRate: 1.9,
    turretTurnRate: 2.4,
    aimError: 0.3,
    reaction: 0.7,
    lead: 0.1,
    fireScale: 0.7,
    aggression: 0.55,
    retreatAt: 0.14,
    preferRange: 300,
  },
  normal: {
    hp: 100,
    armor: 0.06,
    speed: 122,
    turnRate: 2.3,
    turretTurnRate: 3.1,
    aimError: 0.18,
    reaction: 0.45,
    lead: 0.45,
    fireScale: 0.9,
    aggression: 0.75,
    retreatAt: 0.22,
    preferRange: 260,
  },
  hard: {
    hp: 120,
    armor: 0.1,
    speed: 134,
    turnRate: 2.7,
    turretTurnRate: 3.8,
    aimError: 0.1,
    reaction: 0.3,
    lead: 0.8,
    fireScale: 1.05,
    aggression: 0.9,
    retreatAt: 0.25,
    preferRange: 240,
  },
  veteran: {
    hp: 140,
    armor: 0.14,
    speed: 144,
    turnRate: 3,
    turretTurnRate: 4.4,
    aimError: 0.055,
    reaction: 0.2,
    lead: 1,
    fireScale: 1.2,
    aggression: 1,
    retreatAt: 0.3,
    preferRange: 220,
  },
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Rookie',
  normal: 'Soldier',
  hard: 'Veteran',
  veteran: 'War Hero',
}

/** Coins awarded for each enemy tank destroyed by a human player. */
export const COINS_PER_KILL = 10

export const PLAYER_STATS = {
  hp: 110,
  armor: 0.18,
  speed: 158,
  turnRate: 3.4,
  turretTurnRate: 4.6,
  radius: 15,
}

export const TEAM_COLORS = ['#63d1b4', '#f0b64b']
export const ENEMY_COLORS = ['#d6674f', '#c9543f', '#e07a4a', '#b84f45', '#d98a4b']

export const OVERDRIVE = { duration: 1.5, cooldown: 6.5, speedMul: 1.7 }

export const SHIELD_REDUCTION = 0.55
export const ARMOR_PICKUP_BONUS = 0.18
export const DAMAGE_PICKUP_MUL = 1.6
export const SPEED_PICKUP_MUL = 1.35
export const PICKUP_RADIUS = 16

export const PICKUP_STATS: Record<
  PickupKind,
  { label: string; short: string; color: string; weight: number }
> = {
  health: { label: 'Repair', short: 'HP', color: '#5fd68a', weight: 26 },
  ammo: { label: 'Ammo', short: 'AM', color: '#f0b64b', weight: 20 },
  damage: { label: 'Overcharge', short: 'DMG', color: '#e2574c', weight: 16 },
  speed: { label: 'Turbo', short: 'SPD', color: '#8fd0ff', weight: 14 },
  armor: { label: 'Plating', short: 'ARM', color: '#9aa7b8', weight: 14 },
  shield: { label: 'Shield', short: 'SHD', color: '#66e0d0', weight: 10 },
}

export const PICKUP_KINDS = Object.keys(PICKUP_STATS) as PickupKind[]