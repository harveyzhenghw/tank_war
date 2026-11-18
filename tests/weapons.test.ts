import { describe, expect, it } from 'vitest'
import { WEAPONS, WEAPON_ORDER, pelletAngles, refillAmmo, startingAmmo } from '../src/data/weapons'

describe('weapons', () => {
  it('defines four distinct weapons', () => {
    expect(WEAPON_ORDER).toHaveLength(4)
    expect(new Set(WEAPON_ORDER).size).toBe(4)
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id]
      expect(def.damage).toBeGreaterThan(0)
      expect(def.speed).toBeGreaterThan(0)
      expect(def.cooldown).toBeGreaterThan(0)
      expect(def.pellets).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives the cannon infinite ammo and limited ammo to the rest', () => {
    const ammo = startingAmmo()
    expect(ammo.cannon).toBe(Number.POSITIVE_INFINITY)
    expect(ammo.mg).toBeGreaterThan(0)
    expect(ammo.rocket).toBeGreaterThan(0)
    expect(ammo.spread).toBeGreaterThan(0)
  })

  it('spreads pellets symmetrically', () => {
    const angles = pelletAngles(5, 0.4)
    expect(angles).toHaveLength(5)
    expect(angles[0]).toBeCloseTo(-0.2, 6)
    expect(angles[4]).toBeCloseTo(0.2, 6)
    expect(angles[2]).toBeCloseTo(0, 6)
    expect(pelletAngles(1, 0.4)).toEqual([0])
  })

  it('refills ammo but respects caps', () => {
    const ammo = startingAmmo()
    refillAmmo(ammo)
    expect(ammo.rocket).toBeLessThanOrEqual(12)
    expect(ammo.spread).toBeLessThanOrEqual(48)
    expect(ammo.mg).toBeLessThanOrEqual(480)
  })
})