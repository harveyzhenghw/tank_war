import { describe, expect, it } from 'vitest'
import { getMap } from '../src/data/maps'
import { createWorld, isPointFree } from '../src/engine/world'
import type { MapDef } from '../src/engine/types'
import { pointInRect } from '../src/engine/math'

const OPTIONS = {
  objective: 'ctf' as const,
  difficulty: 'normal' as const,
  seed: 1234,
  waves: 1,
  captureSeconds: 20,
}

const ROOM = 3
const ORIGIN = 2
const ROOMS_X = 15
const ROOMS_Y = 9

function blockedCells(map: MapDef): boolean[][] {
  const blocked = Array.from({ length: map.gridRows }, () => Array.from({ length: map.gridCols }, () => false))
  const mark = (rect: { x: number; y: number; w: number; h: number }): void => {
    for (let cy = Math.floor(rect.y / map.cell); cy < Math.ceil((rect.y + rect.h) / map.cell); cy++) {
      for (let cx = Math.floor(rect.x / map.cell); cx < Math.ceil((rect.x + rect.w) / map.cell); cx++) {
        if (cy >= 0 && cy < map.gridRows && cx >= 0 && cx < map.gridCols) blocked[cy][cx] = true
      }
    }
  }
  for (const obstacle of map.obstacles) mark(obstacle)
  for (const water of map.water) mark(water)
  return blocked
}

function cellCenter(map: MapDef, cx: number, cy: number): { x: number; y: number } {
  return { x: cx * map.cell + map.cell / 2, y: cy * map.cell + map.cell / 2 }
}

/** Breadth-first search over free cell centres; returns the step count. */
interface CellRoute {
  steps: number
  turns: number
}

/** Breadth-first search over free cell centres; returns the shortest route. */
function cellRoute(map: MapDef, from: { x: number; y: number }, to: { x: number; y: number }): CellRoute | null {
  const blocked = blockedCells(map)
  const sx = Math.floor(from.x / map.cell)
  const sy = Math.floor(from.y / map.cell)
  const tx = Math.floor(to.x / map.cell)
  const ty = Math.floor(to.y / map.cell)
  if (blocked[sy]?.[sx] || blocked[ty]?.[tx]) return null
  const key = (x: number, y: number): string => `${x},${y}`
  const queue: [number, number][] = [[sx, sy]]
  const previous = new Map<string, string | null>([[key(sx, sy), null]])
  while (queue.length > 0) {
    const [x, y] = queue.shift()!
    if (x === tx && y === ty) break
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= map.gridCols || ny >= map.gridRows) continue
      if (blocked[ny][nx]) continue
      const nextKey = key(nx, ny)
      if (previous.has(nextKey)) continue
      previous.set(nextKey, key(x, y))
      queue.push([nx, ny])
    }
  }
  if (!previous.has(key(tx, ty))) return null

  const route: [number, number][] = []
  let cursor: string | null = key(tx, ty)
  while (cursor !== null) {
    const [x, y] = cursor.split(',').map(Number)
    route.push([x, y])
    cursor = previous.get(cursor) ?? null
  }
  route.reverse()
  let turns = 0
  let lastDx = 0
  let lastDy = 0
  for (let i = 1; i < route.length; i++) {
    const dx = route[i][0] - route[i - 1][0]
    const dy = route[i][1] - route[i - 1][1]
    if (lastDx !== 0 || lastDy !== 0) {
      if (dx !== lastDx || dy !== lastDy) turns++
    }
    lastDx = dx
    lastDy = dy
  }
  return { steps: route.length - 1, turns }
}

function roomOpenCorners(map: MapDef, rx: number, ry: number): { x: number; y: number }[] {
  return [0, 1].flatMap((dy) => [0, 1].map((dx) => cellCenter(map, ORIGIN + rx * ROOM + dx, ORIGIN + ry * ROOM + dy)))
}

function roomDegree(map: MapDef, rx: number, ry: number): number {
  const x = ORIGIN + rx * ROOM
  const y = ORIGIN + ry * ROOM
  const blocked = blockedCells(map)
  const open = (cx: number, cy: number): boolean => !blocked[cy]?.[cx]
  let degree = 0
  if (rx > 0 && open(x - 1, y) && open(x - 1, y + 1)) degree++
  if (rx < ROOMS_X - 1 && open(x + 2, y) && open(x + 2, y + 1)) degree++
  if (ry > 0 && open(x, y - 1) && open(x + 1, y - 1)) degree++
  if (ry < ROOMS_Y - 1 && open(x, y + 2) && open(x + 1, y + 2)) degree++
  return degree
}

function isBaseRoom(rx: number, ry: number): boolean {
  return ry >= 3 && ry <= 5 && (rx <= 3 || rx >= 11)
}

describe('frontier maze', () => {
  const map = getMap('frontier')
  const world = createWorld(map, OPTIONS)

  it('keeps the flags, spawns and caches on free cells', () => {
    const points = map.flagPoints!
    expect(points).not.toBeNull()
    for (const point of [points.player, points.enemy, ...map.playerSpawns, ...map.botSpawns, ...map.pickupPoints]) {
      expect(isPointFree(world, point.x, point.y, 12)).toBe(true)
      for (const water of map.water) {
        expect(pointInRect(point.x, point.y, water)).toBe(false)
      }
    }
  })

  it('connects every objective through the maze', () => {
    const points = map.flagPoints!
    expect(cellRoute(map, points.player, points.enemy)).not.toBeNull()
    for (const point of [...map.playerSpawns, ...map.botSpawns, ...map.pickupPoints]) {
      expect(cellRoute(map, point, points.player)).not.toBeNull()
      expect(cellRoute(map, point, points.enemy)).not.toBeNull()
    }
  })

  it('winds through switchbacks between the flags', () => {
    const points = map.flagPoints!
    const route = cellRoute(map, points.player, points.enemy)!
    const pathLength = route.steps * map.cell
    const straight = Math.hypot(points.player.x - points.enemy.x, points.player.y - points.enemy.y)
    expect(pathLength).toBeGreaterThan(straight * 1.9)
    expect(route.turns).toBeGreaterThanOrEqual(10)
  })

  it('has dead ends and wide chambers for the steering bots', () => {
    let deadEnds = 0
    let chambers = 0
    for (let ry = 0; ry < ROOMS_Y; ry++) {
      for (let rx = 0; rx < ROOMS_X; rx++) {
        if (isBaseRoom(rx, ry)) continue
        chambers++
        if (roomDegree(map, rx, ry) === 1) deadEnds++
        for (const corner of roomOpenCorners(map, rx, ry)) {
          expect(isPointFree(world, corner.x, corner.y, 16)).toBe(true)
        }
      }
    }
    expect(chambers).toBeGreaterThan(80)
    expect(deadEnds).toBeGreaterThanOrEqual(6)
  })
})
