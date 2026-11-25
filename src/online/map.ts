import type { Rect } from '../engine/math'

/** Logical arena size. The canvas is always rendered at this resolution. */
export const ARENA_WIDTH = 800
export const ARENA_HEIGHT = 600

export const TANK_RADIUS = 18
export const BULLET_RADIUS = 4

/** Symmetric cover. Everything is mirrored through the arena centre. */
export const WALLS: Rect[] = [
  { x: 330, y: 88, w: 140, h: 42 },
  { x: 330, y: 470, w: 140, h: 42 },
  { x: 330, y: 252, w: 140, h: 96 },
  { x: 180, y: 180, w: 70, h: 70 },
  { x: 550, y: 350, w: 70, h: 70 },
  { x: 180, y: 350, w: 70, h: 70 },
  { x: 550, y: 180, w: 70, h: 70 },
]

export const SPAWNS = {
  host: { x: 110, y: 300 },
  client: { x: 690, y: 300 },
} as const

export const HOST_COLOR = '#63d1b4'
export const CLIENT_COLOR = '#e9b949'
