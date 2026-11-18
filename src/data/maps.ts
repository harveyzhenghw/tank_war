import type { Decor, MapDef, MapTheme, Obstacle, ObstacleKind } from '../engine/types'
import type { Rect, Vec2 } from '../engine/math'
import { createRng, hashString } from '../engine/rng'

const COLS = 24
const ROWS = 16
const CELL = 40

const OBSTACLE_KINDS: Record<string, ObstacleKind> = {
  '#': 'wall',
  X: 'crate',
  O: 'rock',
}

const CRATE_HP = 55

type Grid = string[][]

function blank(): Grid {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '.'))
}

function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (j >= 0 && j < ROWS && i >= 0 && i < COLS) g[j][i] = ch
    }
  }
}

function border(g: Grid): void {
  fill(g, 0, 0, COLS, 1, '#')
  fill(g, 0, ROWS - 1, COLS, 1, '#')
  fill(g, 0, 0, 1, ROWS, '#')
  fill(g, COLS - 1, 0, 1, ROWS, '#')
}

function put(g: Grid, x: number, y: number, ch: string): void {
  if (!g[y] || g[y][x] === undefined) throw new Error(`map cell out of bounds: ${x},${y}`)
  if (g[y][x] !== '.') throw new Error(`map cell ${x},${y} is occupied by "${g[y][x]}"`)
  g[y][x] = ch
}

interface CellRect extends Rect {
  ch: string
}

/** Greedily merge matching cells into rectangles (right first, then down). */
function extractRects(g: Grid, match: (ch: string) => boolean): CellRect[] {
  const used = g.map((row) => row.map(() => false))
  const out: CellRect[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = g[y][x]
      if (used[y][x] || !match(ch)) continue
      let w = 1
      while (x + w < COLS && !used[y][x + w] && g[y][x + w] === ch) w++
      let h = 1
      grow: while (y + h < ROWS) {
        for (let i = 0; i < w; i++) {
          if (used[y + h][x + i] || g[y + h][x + i] !== ch) break grow
        }
        h++
      }
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) used[y + j][x + i] = true
      }
      out.push({ x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, ch })
    }
  }
  return out
}

function cellsWith(g: Grid, ch: string): Vec2[] {
  const out: Vec2[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (g[y][x] === ch) out.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 })
    }
  }
  return out
}

function makeDecor(id: string): Decor[] {
  const rng = createRng(hashString(`decor:${id}`))
  return Array.from({ length: 42 }, () => ({
    x: rng.range(0, COLS * CELL),
    y: rng.range(0, ROWS * CELL),
    r: rng.range(24, 84),
    tone: rng.next(),
  }))
}

interface MapSource {
  id: string
  name: string
  description: string
  theme: MapTheme
  grid: Grid
}

function parseMap(src: MapSource): MapDef {
  const g = src.grid.map((row) => {
    const cells = row.slice(0, COLS)
    while (cells.length < COLS) cells.push('.')
    return cells
  })

  const obstacleRects = extractRects(g, (ch) => ch in OBSTACLE_KINDS)
  const obstacles: Obstacle[] = obstacleRects.map((r, i) => {
    const kind = OBSTACLE_KINDS[r.ch]
    return {
      id: i + 1,
      kind,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hp: kind === 'crate' ? CRATE_HP : Number.POSITIVE_INFINITY,
      maxHp: kind === 'crate' ? CRATE_HP : Number.POSITIVE_INFINITY,
      alive: true,
      tone: ((r.x * 13 + r.y * 7 + r.w * 3) % 97) / 97,
    }
  })

  const water = extractRects(g, (ch) => ch === '~').map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }))

  const playerSpawns = cellsWith(g, '1').concat(cellsWith(g, '2'))
  const botSpawns = cellsWith(g, '*')
  const pickupPoints = cellsWith(g, '+')

  if (playerSpawns.length < 2) throw new Error(`map ${src.id} needs two player spawns`)
  if (botSpawns.length < 4) throw new Error(`map ${src.id} needs at least four bot spawns`)

  return {
    id: src.id,
    name: src.name,
    description: src.description,
    theme: src.theme,
    width: COLS * CELL,
    height: ROWS * CELL,
    cell: CELL,
    gridCols: COLS,
    gridRows: ROWS,
    obstacles,
    water,
    decor: makeDecor(src.id),
    playerSpawns,
    botSpawns,
    pickupPoints,
  }
}

const FOUNDRY_THEME: MapTheme = {
  ground: '#1a201c',
  groundAlt: '#202720',
  grid: '#253026',
  wall: '#4b564b',
  wallTop: '#5e6b5a',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#4a4f46',
  rockTop: '#5c6156',
  water: '#1c3238',
  waterEdge: '#2e4d55',
  accent: '#e9b949',
  shadow: 'rgba(0,0,0,0.35)',
}

const DUNES_THEME: MapTheme = {
  ground: '#2a2418',
  groundAlt: '#332b1c',
  grid: '#3a3121',
  wall: '#7a6740',
  wallTop: '#8f7a4c',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#6b5a3a',
  rockTop: '#806c47',
  water: '#243a3a',
  waterEdge: '#32514c',
  accent: '#f0b64b',
  shadow: 'rgba(0,0,0,0.3)',
}

const CROSSROADS_THEME: MapTheme = {
  ground: '#1a1d21',
  groundAlt: '#202429',
  grid: '#262b31',
  wall: '#414a55',
  wallTop: '#525d69',
  crate: '#7a5c3a',
  crateTop: '#94714a',
  rock: '#454a50',
  rockTop: '#565c63',
  water: '#1e3138',
  waterEdge: '#2d4a53',
  accent: '#8fd0ff',
  shadow: 'rgba(0,0,0,0.4)',
}

const COMPOUND_THEME: MapTheme = {
  ground: '#1c2418',
  groundAlt: '#222b1d',
  grid: '#293521',
  wall: '#4c5540',
  wallTop: '#5d684e',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#4a4f46',
  rockTop: '#5c6156',
  water: '#22343a',
  waterEdge: '#2f4a51',
  accent: '#b7e28a',
  shadow: 'rgba(0,0,0,0.36)',
}

const ASHFIELD_THEME: MapTheme = {
  ground: '#201a18',
  groundAlt: '#271f1c',
  grid: '#2e2623',
  wall: '#3d3230',
  wallTop: '#4d403c',
  crate: '#6f4f34',
  crateTop: '#85613f',
  rock: '#453b39',
  rockTop: '#554a47',
  water: '#2a2226',
  waterEdge: '#3b3034',
  accent: '#ff8a4c',
  shadow: 'rgba(0,0,0,0.45)',
}

function foundry(): Grid {
  const g = blank()
  border(g)
  fill(g, 9, 6, 6, 1, '#')
  fill(g, 9, 9, 6, 1, '#')
  fill(g, 9, 7, 1, 2, '#')
  fill(g, 14, 7, 1, 2, '#')
  fill(g, 10, 7, 4, 2, 'X')
  for (const [x, y] of [
    [3, 3],
    [19, 3],
    [3, 11],
    [19, 11],
  ]) {
    fill(g, x, y, 2, 2, '#')
  }
  for (const [x, y] of [
    [6, 5],
    [16, 5],
    [6, 10],
    [16, 10],
  ]) {
    fill(g, x, y, 2, 1, 'X')
  }
  fill(g, 12, 12, 1, 1, 'O')
  fill(g, 11, 3, 1, 1, 'O')

  put(g, 2, 8, '1')
  put(g, 21, 8, '2')
  for (const [x, y] of [
    [11, 2],
    [12, 13],
    [5, 4],
    [18, 4],
    [5, 11],
    [18, 11],
  ]) {
    put(g, x, y, '*')
  }
  for (const [x, y] of [
    [6, 8],
    [17, 8],
    [12, 5],
  ]) {
    put(g, x, y, '+')
  }
  return g
}

function dunes(): Grid {
  const g = blank()
  border(g)
  fill(g, 5, 4, 3, 2, 'O')
  fill(g, 16, 4, 3, 2, 'O')
  fill(g, 9, 8, 2, 2, 'O')
  fill(g, 13, 8, 2, 2, 'O')
  fill(g, 4, 12, 2, 1, 'O')
  fill(g, 18, 12, 2, 1, 'O')
  fill(g, 11, 3, 2, 1, 'X')
  fill(g, 11, 12, 2, 1, 'X')
  fill(g, 1, 13, 4, 1, '~')

  put(g, 2, 8, '1')
  put(g, 21, 8, '2')
  for (const [x, y] of [
    [12, 2],
    [12, 13],
    [3, 3],
    [20, 3],
    [3, 12],
    [20, 12],
  ]) {
    put(g, x, y, '*')
  }
  for (const [x, y] of [
    [7, 8],
    [16, 8],
    [12, 6],
  ]) {
    put(g, x, y, '+')
  }
  return g
}

function crossroads(): Grid {
  const g = blank()
  border(g)
  fill(g, 11, 4, 2, 3, '#')
  fill(g, 11, 10, 2, 2, '#')
  fill(g, 7, 7, 3, 2, '#')
  fill(g, 14, 7, 3, 2, '#')
  fill(g, 4, 3, 3, 1, 'X')
  fill(g, 17, 3, 3, 1, 'X')
  fill(g, 4, 12, 3, 1, 'X')
  fill(g, 17, 12, 3, 1, 'X')
  fill(g, 8, 2, 1, 1, 'O')
  fill(g, 15, 2, 1, 1, 'O')
  fill(g, 8, 13, 1, 1, 'O')
  fill(g, 15, 13, 1, 1, 'O')
  fill(g, 1, 10, 3, 1, '~')
  fill(g, 20, 10, 3, 1, '~')

  put(g, 2, 8, '1')
  put(g, 21, 8, '2')
  for (const [x, y] of [
    [12, 2],
    [12, 13],
    [5, 5],
    [18, 5],
    [5, 10],
    [18, 10],
  ]) {
    put(g, x, y, '*')
  }
  for (const [x, y] of [
    [12, 7],
    [6, 8],
    [17, 8],
  ]) {
    put(g, x, y, '+')
  }
  return g
}

function compound(): Grid {
  const g = blank()
  border(g)
  fill(g, 6, 1, 1, 3, '#')
  fill(g, 6, 5, 1, 6, '#')
  fill(g, 6, 12, 1, 3, '#')
  fill(g, 17, 1, 1, 3, '#')
  fill(g, 17, 5, 1, 6, '#')
  fill(g, 17, 12, 1, 3, '#')
  fill(g, 10, 6, 4, 1, '#')
  fill(g, 10, 9, 4, 1, '#')
  fill(g, 2, 3, 2, 1, 'X')
  fill(g, 2, 12, 2, 1, 'X')
  fill(g, 20, 3, 2, 1, 'X')
  fill(g, 20, 12, 2, 1, 'X')
  fill(g, 8, 2, 2, 1, 'X')
  fill(g, 14, 13, 2, 1, 'X')

  put(g, 3, 8, '1')
  put(g, 20, 8, '2')
  for (const [x, y] of [
    [12, 2],
    [12, 13],
    [8, 5],
    [15, 10],
    [3, 4],
    [20, 11],
  ]) {
    put(g, x, y, '*')
  }
  for (const [x, y] of [
    [9, 8],
    [14, 8],
    [12, 3],
  ]) {
    put(g, x, y, '+')
  }
  return g
}

function ashfield(): Grid {
  const g = blank()
  border(g)
  fill(g, 2, 2, 3, 2, '~')
  fill(g, 19, 12, 3, 2, '~')
  fill(g, 11, 7, 2, 2, '#')
  fill(g, 8, 3, 2, 1, 'O')
  fill(g, 14, 3, 2, 1, 'O')
  fill(g, 8, 12, 2, 1, 'O')
  fill(g, 14, 12, 2, 1, 'O')
  fill(g, 4, 6, 1, 3, 'X')
  fill(g, 19, 6, 1, 3, 'X')
  fill(g, 11, 5, 2, 1, 'X')
  fill(g, 11, 10, 2, 1, 'X')

  put(g, 2, 8, '1')
  put(g, 21, 8, '2')
  for (const [x, y] of [
    [12, 2],
    [12, 13],
    [5, 3],
    [18, 3],
    [5, 12],
    [18, 12],
  ]) {
    put(g, x, y, '*')
  }
  for (const [x, y] of [
    [7, 8],
    [16, 8],
    [12, 4],
  ]) {
    put(g, x, y, '+')
  }
  return g
}

const SOURCES: MapSource[] = [
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Tight industrial yard. Break the crates, own the centre.',
    theme: FOUNDRY_THEME,
    grid: foundry(),
  },
  {
    id: 'dunes',
    name: 'Dunes',
    description: 'Open sand and long sight lines. Rock cover is everything.',
    theme: DUNES_THEME,
    grid: dunes(),
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    description: 'Four lanes meeting at a contested junction.',
    theme: CROSSROADS_THEME,
    grid: crossroads(),
  },
  {
    id: 'compound',
    name: 'Compound',
    description: 'Walled courtyards with narrow doorways. Watch your flanks.',
    theme: COMPOUND_THEME,
    grid: compound(),
  },
  {
    id: 'ashfield',
    name: 'Ashfield',
    description: 'Burnt ground, tar pits, and a veteran welcome.',
    theme: ASHFIELD_THEME,
    grid: ashfield(),
  },
]

export const MAPS: MapDef[] = SOURCES.map(parseMap)

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(
  MAPS.map((map) => [map.id, map]),
)

export function getMap(id: string): MapDef {
  const map = MAP_BY_ID[id]
  if (!map) throw new Error(`unknown map: ${id}`)
  return map
}

export const MAP_IDS = MAPS.map((map) => map.id)