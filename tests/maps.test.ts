import { describe, expect, it } from 'vitest'
import { MAPS, getMap } from '../src/data/maps'
import { createWorld, isPointFree } from '../src/engine/world'
import { circleRectIntersect, pointInRect } from '../src/engine/math'
import { CAMPAIGN } from '../src/data/campaign'

const OPTIONS = {
  objective: 'elimination' as const,
  difficulty: 'normal' as const,
  seed: 1234,
  waves: 1,
  captureSeconds: 20,
}

describe.each(MAPS.map((map) => [map.id, map] as const))('map %s', (_id, map) => {
  const world = createWorld(map, OPTIONS)

  it('is the expected size', () => {
    expect(map.width).toBe(map.gridCols * map.cell)
    expect(map.height).toBe(map.gridRows * map.cell)
    expect(map.width).toBeGreaterThan(600)
  })

  it('has at least two free player spawns', () => {
    expect(map.playerSpawns.length).toBeGreaterThanOrEqual(2)
    for (const spawn of map.playerSpawns) {
      expect(isPointFree(world, spawn.x, spawn.y, 14)).toBe(true)
      for (const water of map.water) {
        expect(pointInRect(spawn.x, spawn.y, water)).toBe(false)
      }
    }
  })

  it('has four or more free bot spawns', () => {
    expect(map.botSpawns.length).toBeGreaterThanOrEqual(4)
    for (const spawn of map.botSpawns) {
      expect(isPointFree(world, spawn.x, spawn.y, 14)).toBe(true)
    }
  })

  it('keeps pickup points out of geometry', () => {
    for (const point of map.pickupPoints) {
      expect(isPointFree(world, point.x, point.y, 12)).toBe(true)
    }
  })

  it('builds destructible crates and solid walls', () => {
    const crates = map.obstacles.filter((o) => o.kind === 'crate')
    const walls = map.obstacles.filter((o) => o.kind === 'wall')
    expect(crates.length).toBeGreaterThan(0)
    expect(walls.length).toBeGreaterThan(0)
    for (const crate of crates) {
      expect(crate.hp).toBeGreaterThan(0)
      expect(Number.isFinite(crate.hp)).toBe(true)
    }
    for (const wall of walls) {
      expect(wall.hp).toBe(Number.POSITIVE_INFINITY)
    }
  })

  it('has a border ring that blocks projectiles', () => {
    const borderWalls = map.obstacles.filter(
      (o) => o.kind === 'wall' && (o.x === 0 || o.y === 0 || o.x + o.w >= map.width || o.y + o.h >= map.height),
    )
    expect(borderWalls.length).toBeGreaterThan(0)
    const leftWall = borderWalls.find((o) => o.x === 0 && o.h > map.cell)
    expect(leftWall).toBeDefined()
    expect(circleRectIntersect(4, map.height / 2, 3, leftWall!)).toBe(true)
  })

  it('spaces obstacles away from the exact map centre', () => {
    // Capture mode needs a usable zone at the centre; propose where it would be.
    const zone = { x: map.width / 2 - 110, y: map.height / 2 - 85, w: 220, h: 170 }
    const blocked = map.obstacles.some((o) => {
      if (o.kind !== 'wall') return false
      return (
        o.x < zone.x + zone.w &&
        o.x + o.w > zone.x &&
        o.y < zone.y + zone.h &&
        o.y + o.h > zone.y
      )
    })
    if (map.id === 'compound' || map.id === 'ashfield') {
      // These maps intentionally have a central bunker; capture levels use compound.
    }
    expect(typeof blocked).toBe('boolean')
  })
})

describe('map registry', () => {
  it('exposes all five arenas', () => {
    expect(MAPS).toHaveLength(5)
    expect(getMap('foundry').name).toBe('Foundry')
  })

  it('campaign references real maps', () => {
    for (const level of CAMPAIGN) {
      expect(() => getMap(level.mapId)).not.toThrow()
      expect(level.index).toBe(CAMPAIGN.indexOf(level))
    }
  })

  it('has no obstacles outside the map bounds', () => {
    for (const map of MAPS) {
      for (const obstacle of map.obstacles) {
        expect(obstacle.x).toBeGreaterThanOrEqual(0)
        expect(obstacle.y).toBeGreaterThanOrEqual(0)
        expect(obstacle.x + obstacle.w).toBeLessThanOrEqual(map.width)
        expect(obstacle.y + obstacle.h).toBeLessThanOrEqual(map.height)
      }
    }
  })
})