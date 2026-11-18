import { describe, expect, it } from 'vitest'
import {
  angleDiff,
  circleRectIntersect,
  fitView,
  resolveCircleRect,
  rotateToward,
  screenToWorld,
  segmentRectIntersect,
  worldToScreen,
} from '../src/engine/math'

const rect = { x: 10, y: 10, w: 20, h: 20 }

describe('geometry', () => {
  it('pushes circles out of rects', () => {
    expect(resolveCircleRect(0, 20, 5, rect)).toBeNull()
    const fixed = resolveCircleRect(8, 20, 5, rect)
    expect(fixed).not.toBeNull()
    expect(fixed!.x).toBeCloseTo(5, 5)
    expect(fixed!.y).toBeCloseTo(20, 5)
  })

  it('ejects circles that start inside a rect', () => {
    const fixed = resolveCircleRect(12, 20, 4, rect)
    expect(fixed).not.toBeNull()
    expect(fixed!.x).toBeLessThanOrEqual(rect.x - 4 + 0.001)
  })

  it('detects circle/rect overlap', () => {
    expect(circleRectIntersect(5, 20, 6, rect)).toBe(true)
    expect(circleRectIntersect(-40, 20, 4, rect)).toBe(false)
  })

  it('tests segments against rects', () => {
    expect(segmentRectIntersect(-10, 20, 40, 20, rect)).toBe(true)
    expect(segmentRectIntersect(-10, -10, -5, 40, rect)).toBe(false)
    expect(segmentRectIntersect(15, 15, 15, 15, rect)).toBe(true)
  })

  it('rotates angles by the shortest path', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2, 6)
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI, 6)
    expect(rotateToward(0, 1, 0.25)).toBeCloseTo(0.25, 6)
    expect(rotateToward(0, 0.1, 0.25)).toBeCloseTo(0.1, 6)
  })
})

describe('view fitting', () => {
  it('letterboxes a 3:2 world into a square viewport', () => {
    const view = fitView(960, 640, 500, 500)
    expect(view.scale).toBeCloseTo(500 / 960, 6)
    expect(view.offsetX).toBeCloseTo(0, 6)
    expect(view.offsetY).toBeGreaterThan(0)
  })

  it('round trips screen and world coordinates', () => {
    const view = fitView(800, 600, 400, 300)
    const screen = worldToScreen(view, 200, 150)
    const world = screenToWorld(view, screen.x, screen.y)
    expect(world.x).toBeCloseTo(200, 6)
    expect(world.y).toBeCloseTo(150, 6)
  })
})