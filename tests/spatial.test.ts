import { describe, expect, it } from 'vitest'
import { SpatialGrid } from '../src/engine/spatial'

interface Item {
  x: number
  y: number
  w: number
  h: number
  name: string
}

const a: Item = { x: 0, y: 0, w: 32, h: 32, name: 'a' }
const b: Item = { x: 100, y: 100, w: 20, h: 20, name: 'b' }
const c: Item = { x: 40, y: 0, w: 20, h: 20, name: 'c' }

describe('SpatialGrid', () => {
  it('returns each overlapping item once', () => {
    const grid = new SpatialGrid<Item>(32)
    grid.rebuild([a, b, c])

    const hits = grid.queryRect({ x: 20, y: 10, w: 40, h: 10 })
    expect(hits.map((item) => item.name).sort()).toEqual(['a', 'c'])
  })

  it('clears old contents on rebuild', () => {
    const grid = new SpatialGrid<Item>(32)
    grid.rebuild([a, b, c])
    grid.rebuild([b])
    expect(grid.queryCircle(10, 10, 20)).toHaveLength(0)
    expect(grid.queryCircle(110, 110, 10)).toHaveLength(1)
  })

  it('handles items spanning many cells without duplicates', () => {
    const big: Item = { x: 0, y: 0, w: 200, h: 200, name: 'big' }
    const grid = new SpatialGrid<Item>(16)
    grid.insert(big)
    const hits = grid.queryRect({ x: 30, y: 30, w: 50, h: 50 })
    expect(hits).toHaveLength(1)
  })
})