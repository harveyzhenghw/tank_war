import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRESS, type Progress } from '../src/settings'
import {
  buyBooster,
  buySkin,
  buyWeapon,
  equipSkin,
  progressLoadout,
  toggleBooster,
} from '../src/data/store'
import { BOOSTERS, MAX_EQUIPPED_BOOSTERS, boosterEffects } from '../src/data/boosters'
import { DIFFICULTY_LABEL } from '../src/data/balance'
import { WEAPON_PRICES } from '../src/data/weapons'

function progress(patch: Partial<Progress> = {}): Progress {
  return {
    ...DEFAULT_PROGRESS,
    best: {},
    ownedWeapons: [...DEFAULT_PROGRESS.ownedWeapons],
    ownedSkins: [...DEFAULT_PROGRESS.ownedSkins],
    ownedBoosters: [...DEFAULT_PROGRESS.ownedBoosters],
    equippedBoosters: [...DEFAULT_PROGRESS.equippedBoosters],
    ...patch,
  }
}

describe('store purchases', () => {
  it('buys a weapon once and deducts its price', () => {
    const start = progress({ coins: 500 })
    const after = buyWeapon(start, 'rail')
    expect(after.coins).toBe(500 - (WEAPON_PRICES.rail ?? 0))
    expect(after.ownedWeapons).toContain('rail')

    const again = buyWeapon(after, 'rail')
    expect(again).toBe(after)
    expect(again.coins).toBe(after.coins)
  })

  it('refuses purchases that cannot be afforded', () => {
    const start = progress({ coins: 10 })
    expect(buyWeapon(start, 'plasma')).toBe(start)
    expect(buySkin(start, 'gold')).toBe(start)
    expect(buyBooster(start, 'shield')).toBe(start)
  })

  it('buys and equips a skin, and only equips owned skins', () => {
    const start = progress({ coins: 100 })
    const after = buySkin(start, 'desert')
    expect(after.ownedSkins).toContain('desert')
    expect(after.equippedSkin).toBe('desert')
    expect(equipSkin(after, 'gold')).toBe(after)
  })

  it('applies seat limits to boosters and toggles equipped state', () => {
    let state = progress({ coins: 2000 })
    state = buyBooster(state, 'ammoBelt')
    state = buyBooster(state, 'hull')
    state = buyBooster(state, 'armour')
    expect(state.equippedBoosters).toHaveLength(MAX_EQUIPPED_BOOSTERS)
    expect(state.ownedBoosters).toHaveLength(3)

    state = toggleBooster(state, 'ammoBelt')
    expect(state.equippedBoosters).not.toContain('ammoBelt')
    state = toggleBooster(state, 'armour')
    expect(state.equippedBoosters).toContain('armour')
  })

  it('builds a loadout from owned gear', () => {
    const state = progress({
      coins: 1000,
      ownedWeapons: ['cannon', 'mg', 'rail'],
      equippedSkin: 'urban',
      ownedSkins: ['field', 'urban'],
      ownedBoosters: ['hull'],
      equippedBoosters: ['hull'],
    })
    const loadout = progressLoadout(state)
    expect(loadout.weapons).toContain('rail')
    expect(loadout.skin).toBe('urban')
    expect(loadout.boosters).toEqual(['hull'])
  })
})

describe('boosters and difficulty', () => {
  it('stacks booster effects', () => {
    const effects = boosterEffects(['hull', 'ammoBelt'])
    expect(effects.hp).toBe(20)
    expect(effects.ammoMul).toBeCloseTo(1.4, 6)
    expect(effects.reloadMul).toBeCloseTo(1, 6)
    expect(BOOSTERS.loader.reloadMul).toBeGreaterThan(1)
  })

  it('uses the four requested difficulty names', () => {
    expect(DIFFICULTY_LABEL).toEqual({
      easy: 'Rookie',
      normal: 'Soldier',
      hard: 'Veteran',
      veteran: 'War Hero',
    })
  })
})
