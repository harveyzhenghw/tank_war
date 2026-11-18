import type { BoosterId } from '../engine/types'

export interface BoosterDef {
  id: BoosterId
  name: string
  short: string
  description: string
  price: number
  /** Extra maximum hull points. */
  hp: number
  /** Extra damage reduction, added before the mitigation cap. */
  armor: number
  /** Multiplier applied to starting reserve ammunition. */
  ammoMul: number
  /** Multiplier applied to reload speed (higher is faster). */
  reloadMul: number
  /** Seconds of shield at the start of a match. */
  startShield: number
  /** Seconds of damage overcharge at the start of a match. */
  startDamage: number
}

export const BOOSTERS: Record<BoosterId, BoosterDef> = {
  ammoBelt: {
    id: 'ammoBelt',
    name: 'Ammo Belt',
    short: 'AMM',
    description: 'Carry 40% more reserve ammunition for every limited weapon.',
    price: 180,
    hp: 0,
    armor: 0,
    ammoMul: 1.4,
    reloadMul: 1,
    startShield: 0,
    startDamage: 0,
  },
  hull: {
    id: 'hull',
    name: 'Reinforced Hull',
    short: 'HULL',
    description: 'Weld on extra plating for 20 additional maximum hit points.',
    price: 240,
    hp: 20,
    armor: 0,
    ammoMul: 1,
    reloadMul: 1,
    startShield: 0,
    startDamage: 0,
  },
  armour: {
    id: 'armour',
    name: 'Composite Armour',
    short: 'ARM',
    description: 'Layered ceramic panels reduce incoming damage by an extra 6%.',
    price: 260,
    hp: 0,
    armor: 0.06,
    ammoMul: 1,
    reloadMul: 1,
    startShield: 0,
    startDamage: 0,
  },
  loader: {
    id: 'loader',
    name: 'Quick Loader',
    short: 'LOAD',
    description: 'Powered rammers cut every weapon cooldown by 12%.',
    price: 320,
    hp: 0,
    armor: 0,
    ammoMul: 1,
    reloadMul: 1.12,
    startShield: 0,
    startDamage: 0,
  },
  stim: {
    id: 'stim',
    name: 'Combat Stim',
    short: 'STIM',
    description: 'Start each match with 10 seconds of damage overcharge.',
    price: 380,
    hp: 0,
    armor: 0,
    ammoMul: 1,
    reloadMul: 1,
    startShield: 0,
    startDamage: 10,
  },
  shield: {
    id: 'shield',
    name: 'Reactive Shield',
    short: 'SHD',
    description: 'Start each match with 8 seconds of energy shielding.',
    price: 420,
    hp: 0,
    armor: 0,
    ammoMul: 1,
    reloadMul: 1,
    startShield: 8,
    startDamage: 0,
  },
}

export const BOOSTER_ORDER: BoosterId[] = [
  'ammoBelt',
  'hull',
  'armour',
  'loader',
  'stim',
  'shield',
]

export const MAX_EQUIPPED_BOOSTERS = 2

export function isBoosterId(value: string): value is BoosterId {
  return value in BOOSTERS
}

export function boosterEffects(ids: BoosterId[]) {
  const out = { hp: 0, armor: 0, ammoMul: 1, reloadMul: 1, startShield: 0, startDamage: 0 }
  for (const id of ids) {
    const def = BOOSTERS[id]
    out.hp += def.hp
    out.armor += def.armor
    out.ammoMul *= def.ammoMul
    out.reloadMul *= def.reloadMul
    out.startShield = Math.max(out.startShield, def.startShield)
    out.startDamage = Math.max(out.startDamage, def.startDamage)
  }
  return out
}
