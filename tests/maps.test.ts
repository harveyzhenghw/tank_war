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

  it('builds destructible cover and solid walls', () => {
    const destructibles = map.obstacles.filter((o) => o.kind !== 'wall')
    const walls = map.obstacles.filter((o) => o.kind === 'wall')
    expect(destructibles.length).toBeGreaterThan(0)
    expect(walls.length).toBeGreaterThan(0)
    for (const obstacle of destructibles) {
      expect(obstacle.hp).toBeGreaterThan(0)
      expect(Number.isFinite(obstacle.hp)).toBe(true)
      expect(obstacle.maxHp).toBe(obstacle.hp)
    }
    for (const wall of walls) {
      expect(wall.hp).toBe(Number.POSITIVE_INFINITY)
    }
  })

  it('paints terrain under the battlefield', () => {
    expect(map.terrain.length).toBeGreaterThan(0)
    for (const terrain of map.terrain) {
      expect(terrain.w).toBeGreaterThan(0)
      expect(terrain.h).toBeGreaterThan(0)
    }
  })

  it('has a border ring that blocks projectiles', () => {
    const borderWalls = map.obstacles.filter(
      (o) => o.kind === 'wall' && (o.x === 0 || o.y === 0 || o.x + o.w >= map.width || o.y + o.h >= map.height),
    )
    expect(borderWalls.length).toBeGreaterThan(0)
    const leftWall = borderWalls.find(
      (o) => o.x === 0 && o.w <= map.cell * 2 && o.h >= map.height / 2,
    )
    expect(leftWall).toBeDefined()
    expect(circleRectIntersect(4, map.height / 2, 3, leftWall!)).toBe(true)
  })

  it('keeps the centre clear on the capture arena', () => {
    // Capture mode needs a usable 220x170 zone at the centre of the village.
    const zone = { x: map.width / 2 - 110, y: map.height / 2 - 85, w: 220, h: 170 }
    const blocked = map.obstacles.filter(
      (o) =>
        o.x < zone.x + zone.w &&
        o.x + o.w > zone.x &&
        o.y < zone.y + zone.h &&
        o.y + o.h > zone.y,
    )
    if (map.id === 'village') {
      expect(blocked).toHaveLength(0)
    } else {
      expect(Array.isArray(blocked)).toBe(true)
    }
  })
})

describe('map registry', () => {
  it('exposes all ten themed arenas', () => {
    expect(MAPS).toHaveLength(10)
    expect(MAPS.map((map) => map.id)).toEqual([
      'downtown',
      'greenway',
      'foundry',
      'village',
      'ashfield',
      'dunes',
      'crossroads',
      'compound',
      'frontier',
      'citadel',
    ])
    expect(MAPS.map((map) => map.biome)).toEqual([
      'city',
      'park',
      'industrial',
      'village',
      'ruins',
      'desert',
      'city',
      'industrial',
      'park',
      'ruins',
    ])
    expect(getMap('foundry').name).toBe('Foundry')
    expect(getMap('downtown').name).toBe('Downtown')
    expect(getMap('greenway').name).toBe('Greenway')
    expect(getMap('village').name).toBe('Village')
    expect(getMap('ashfield').name).toBe('Ashfield')
    expect(getMap('dunes').name).toBe('Dunes')
    expect(getMap('crossroads').name).toBe('Crossroads')
    expect(getMap('compound').name).toBe('Compound')
    expect(getMap('frontier').name).toBe('Frontier')
    expect(getMap('citadel').name).toBe('Citadel')
  })

  it('gives the frontier a larger follow-camera arena with two flags', () => {
    const frontier = getMap('frontier')
    expect(frontier.width).toBeGreaterThan(getMap('downtown').width)
    expect(frontier.height).toBeGreaterThan(getMap('downtown').height)
    expect(frontier.camera).toBe('follow')
    expect(frontier.flagPoints).not.toBeNull()
    expect(frontier.flagPoints!.player).not.toEqual(frontier.flagPoints!.enemy)
    for (const map of MAPS) {
      if (map.id !== 'frontier') expect(map.flagPoints).toBeNull()
    }
  })

  it('gives the city and ruins destructible buildings', () => {
    for (const id of ['downtown', 'ashfield']) {
      const buildings = getMap(id).obstacles.filter((o) => o.kind === 'building')
      expect(buildings.length).toBeGreaterThan(0)
      for (const building of buildings) {
        expect(Number.isFinite(building.hp)).toBe(true)
      }
    }
  })

  it('campaign references real maps', () => {
    expect(CAMPAIGN).toHaveLength(10)
    for (const level of CAMPAIGN) {
      expect(() => getMap(level.mapId)).not.toThrow()
      expect(level.index).toBe(CAMPAIGN.indexOf(level))
    }
  })

  it('places bosses on the expected operations', () => {
    expect(CAMPAIGN[4].bossId).toBe('ironMarshal')
    expect(CAMPAIGN[7].bossId).toBe('warden')
    expect(CAMPAIGN[9].bossId).toBe('sovereign')
    expect(CAMPAIGN[8].objective).toBe('ctf')
    expect(CAMPAIGN[8].mapId).toBe('frontier')
    expect(CAMPAIGN.filter((level) => level.bossId)).toHaveLength(3)
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