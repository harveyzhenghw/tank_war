import type {
  Biome,
  Decor,
  MapDef,
  MapTheme,
  Obstacle,
  ObstacleKind,
  TerrainKind,
  TerrainRect,
} from '../engine/types'
import type { Rect, Vec2 } from '../engine/math'
import { createRng, hashString } from '../engine/rng'

const CELL = 40
const CRATE_HP = 55
const MAX_PARTICLES_DECOR = 48

const OBSTACLE_KINDS: Record<string, ObstacleKind> = {
  '#': 'wall',
  X: 'crate',
  O: 'rock',
  B: 'building',
  T: 'tree',
}

const TERRAIN_KINDS: Record<string, TerrainKind> = {
  '=': 'road',
  ':': 'pavement',
  ',': 'grass',
  ';': 'dirt',
}

const SPAWN_CHARS = new Set(['1', '2', '*', '+'])

const GRID_CHARS = new Set([
  '.',
  '~',
  'Y',
  'E',
  ...Object.keys(OBSTACLE_KINDS),
  ...Object.keys(TERRAIN_KINDS),
  ...SPAWN_CHARS,
])

type Grid = string[][]

/** Build a blank rectangular map grid. */
function makeGrid(cols: number, rows: number, fill = '.'): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))
}

/** Paint a rectangular region of a grid. */
function paint(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (j >= 0 && j < g.length && i >= 0 && i < g[0].length) g[j][i] = ch
    }
  }
}

/** Place a single character on a grid. */
function place(g: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch
}

function addBorder(g: Grid, ch = '#'): void {
  const rows = g.length
  const cols = g[0].length
  paint(g, 0, 0, cols, 1, ch)
  paint(g, 0, rows - 1, cols, 1, ch)
  paint(g, 0, 0, 1, rows, ch)
  paint(g, cols - 1, 0, 1, rows, ch)
}

/** Collapse literal map rows into a validated character grid. */
function parseGrid(id: string, text: string): Grid {
  const rows = text
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row.length > 0)

  if (rows.length < 1) {
    throw new Error(`map ${id} has no rows`)
  }

  const cols = rows[0].length
  return rows.map((row, y) => {
    if (row.length !== cols) {
      throw new Error(`map ${id} row ${y} has ${row.length} cells, expected ${cols}`)
    }
    for (const ch of row) {
      if (!GRID_CHARS.has(ch)) {
        throw new Error(`map ${id} row ${y} uses unknown cell "${ch}"`)
      }
    }
    return row.split('')
  })
}

interface CellRect extends Rect {
  ch: string
}

/** Greedily merge matching cells into rectangles (right first, then down). */
function extractRects(g: Grid, match: (ch: string) => boolean): CellRect[] {
  const rows = g.length
  const cols = g[0].length
  const used = g.map((row) => row.map(() => false))
  const out: CellRect[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = g[y][x]
      if (used[y][x] || !match(ch)) continue
      let w = 1
      while (x + w < cols && !used[y][x + w] && g[y][x + w] === ch) w++
      let h = 1
      grow: while (y + h < rows) {
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
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x] === ch) out.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 })
    }
  }
  return out
}

function firstCell(g: Grid, ch: string): Vec2 | null {
  const cells = cellsWith(g, ch)
  return cells[0] ?? null
}

/** Building and cover toughness scales with footprint so big structures are not paper. */
function obstacleHp(kind: ObstacleKind, areaCells: number): number {
  switch (kind) {
    case 'crate':
      return CRATE_HP
    case 'tree':
      return 45 + areaCells * 25
    case 'rock':
      return 90 + areaCells * 45
    case 'building':
      return Math.min(380, Math.max(200, 140 + areaCells * 10))
    case 'wall':
      return Number.POSITIVE_INFINITY
  }
}

function insideAny(x: number, y: number, rects: Rect[]): boolean {
  return rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
}

/** Scatter scenery that belongs on open ground, never on roads, paving or water. */
function makeDecor(
  id: string,
  biome: Biome,
  grid: Grid,
  terrain: TerrainRect[],
  water: Rect[],
): Decor[] {
  // The frontier is a paved maze; scattered scenery would bleed over its roads.
  if (id === 'frontier') return []
  const rng = createRng(hashString(`decor:${id}`))
  const keepOff: Rect[] = [
    ...terrain.filter((t) => t.kind === 'road' || t.kind === 'pavement'),
    ...water,
  ]
  const count = biome === 'park' || biome === 'village' ? 56 : MAX_PARTICLES_DECOR
  const decor: Decor[] = []
  const worldW = grid[0].length * CELL
  const worldH = grid.length * CELL

  for (let attempt = 0; attempt < count * 4 && decor.length < count; attempt++) {
    const x = rng.range(24, worldW - 24)
    const y = rng.range(24, worldH - 24)
    if (insideAny(x, y, keepOff)) continue
    const radius =
      biome === 'city' || biome === 'industrial'
        ? rng.range(10, 34)
        : biome === 'ruins'
          ? rng.range(18, 58)
          : rng.range(14, 44)
    decor.push({ x, y, r: radius, tone: rng.next() })
  }
  return decor
}

interface MapSource {
  id: string
  name: string
  description: string
  biome: Biome
  theme: MapTheme
  grid: Grid
  camera?: 'fit' | 'follow'
}

function parseMap(src: MapSource): MapDef {
  const terrain: TerrainRect[] = extractRects(src.grid, (ch) => ch in TERRAIN_KINDS).map(
    (r) => ({
      kind: TERRAIN_KINDS[r.ch],
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    }),
  )

  const obstacleRects = extractRects(src.grid, (ch) => ch in OBSTACLE_KINDS)
  const obstacles: Obstacle[] = obstacleRects.map((r, i) => {
    const kind = OBSTACLE_KINDS[r.ch]
    const area = Math.max(1, (r.w / CELL) * (r.h / CELL))
    const hp = obstacleHp(kind, area)
    return {
      id: i + 1,
      kind,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hp,
      maxHp: hp,
      alive: true,
      tone: ((r.x * 13 + r.y * 7 + r.w * 3) % 97) / 97,
    }
  })

  const water = extractRects(src.grid, (ch) => ch === '~').map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }))

  const playerSpawns = cellsWith(src.grid, '1').concat(cellsWith(src.grid, '2'))
  const botSpawns = cellsWith(src.grid, '*')
  const pickupPoints = cellsWith(src.grid, '+')
  const playerFlag = firstCell(src.grid, 'Y')
  const enemyFlag = firstCell(src.grid, 'E')
  const cols = src.grid[0].length
  const rows = src.grid.length

  if (playerSpawns.length < 2) throw new Error(`map ${src.id} needs two player spawns`)
  if (botSpawns.length < 4) throw new Error(`map ${src.id} needs at least four bot spawns`)
  if (pickupPoints.length < 3) throw new Error(`map ${src.id} needs at least three pickups`)
  if (Boolean(playerFlag) !== Boolean(enemyFlag)) {
    throw new Error(`map ${src.id} must define both a player flag (Y) and an enemy flag (E)`)
  }

  return {
    id: src.id,
    name: src.name,
    description: src.description,
    biome: src.biome,
    theme: src.theme,
    width: cols * CELL,
    height: rows * CELL,
    cell: CELL,
    gridCols: cols,
    gridRows: rows,
    obstacles,
    water,
    terrain,
    decor: makeDecor(src.id, src.biome, src.grid, terrain, water),
    playerSpawns,
    botSpawns,
    pickupPoints,
    camera: src.camera ?? 'fit',
    flagPoints:
      playerFlag && enemyFlag ? { player: playerFlag, enemy: enemyFlag } : null,
  }
}

const DOWNTOWN_THEME: MapTheme = {
  ground: '#1b1e24',
  groundAlt: '#22262e',
  grid: '#2b303a',
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
  road: '#292e37',
  roadLine: '#c9d6e8',
  pavement: '#343a45',
  grass: '#2c3a2a',
  dirt: '#3a3328',
  building: '#4b5260',
  buildingRoof: '#5b6373',
  tree: '#3e5f3d',
  treeTop: '#5a8150',
}

const GREENWAY_THEME: MapTheme = {
  ground: '#1f2a1c',
  groundAlt: '#27341f',
  grid: '#2e3d25',
  wall: '#5d6253',
  wallTop: '#707666',
  crate: '#7a5c3a',
  crateTop: '#94714a',
  rock: '#4a4f46',
  rockTop: '#5c6156',
  water: '#1c3238',
  waterEdge: '#2e4d55',
  accent: '#b7e28a',
  shadow: 'rgba(0,0,0,0.32)',
  road: '#3a3a2c',
  roadLine: '#a9b07a',
  pavement: '#3c4136',
  grass: '#2c3d24',
  dirt: '#4a3d29',
  building: '#5c5f4a',
  buildingRoof: '#6e7358',
  tree: '#335a2f',
  treeTop: '#4f7c42',
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
  road: '#242a26',
  roadLine: '#b7a24a',
  pavement: '#2d332e',
  grass: '#27331f',
  dirt: '#3a3123',
  building: '#4a5148',
  buildingRoof: '#5a6257',
  tree: '#3d5a35',
  treeTop: '#557a47',
}

const VILLAGE_THEME: MapTheme = {
  ground: '#242619',
  groundAlt: '#2c2e1e',
  grid: '#343722',
  wall: '#6b6049',
  wallTop: '#7d7155',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#5a5d4b',
  rockTop: '#6c705b',
  water: '#26363a',
  waterEdge: '#355055',
  accent: '#f0b64b',
  shadow: 'rgba(0,0,0,0.34)',
  road: '#3b3528',
  roadLine: '#c0a86a',
  pavement: '#4a4435',
  grass: '#33401f',
  dirt: '#4d3d22',
  building: '#6b5b46',
  buildingRoof: '#826b50',
  tree: '#3b5a2e',
  treeTop: '#557d40',
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
  road: '#2f2a27',
  roadLine: '#8a6d54',
  pavement: '#39312d',
  grass: '#333a26',
  dirt: '#423528',
  building: '#4a3e39',
  buildingRoof: '#594a43',
  tree: '#4a4530',
  treeTop: '#635c40',
}

const DOWNTOWN_GRID = `
########################
#..BBBBB..:=*:..BBBB...#
#..BBBBB..:==:..BBBB...#
#..BBBBB..:==:..BBBB...#
#.1....*..:==:..*....2.#
#.XX...OO.:==:.OO...XX.#
#::::::::+::+:+::::::::#
#======================#
#======================#
#::::::::::::::::::::::#
#.OOOO.*.X:==:.X.*.OOOO#
#..BBBB...:==:..BBBB...#
#..BBBB...:==:..BBBB...#
#..BBBB...:==:..BBBB...#
#.........:=*:.........#
########################
`

const GREENWAY_GRID = `
########################
#......................#
#.~~~~.........TT......#
#.~~~~..*OO...TTT.*....#
#..~~....OO........TT..#
#...........TT.........#
#........*TTTT.........#
#.....+.....+..........#
#.1..................2.#
#....;;;....;;;........#
#...;;;...*..;;;..+....#
#..OO...........TT..*..#
#.OOOO....XX....TTT....#
#........XX............#
#...........*..........#
########################
`

const FOUNDRY_GRID = `
########################
#..BBBB.......BBBBB....#
#..BBBB.......BBBBB....#
#..BBBB.......BBBBB....#
#...*..............*...#
#..XX..............XX..#
#..XX....======....XX..#
#........==+===........#
#.1O.....======.....O2.#
#........======........#
#..XX....=+====....XX..#
#..XX..............XX..#
#........*.~~~~........#
#..........~~~~........#
#..O......+.....*..O...#
########################
`

const VILLAGE_GRID = `
########################
#..BBBB......BBBB......#
#..BBBB......BBBB......#
#..BBBB......BBBB......#
#...*..........*.......#
#.TT.....;;;;....TT...*#
#....+..;;;;;;.........#
#..1...;;;;;;......2...#
#.......;;;;;;......+..#
#.OO.....;;;;.....OO...#
#.......;;;;;;....+....#
#..TT.....XX.....TT....#
#..BBBB......BBBB......#
#..BBBB......BBBB......#
#...*..............*...#
########################
`

const ASHFIELD_GRID = `
########################
#..BBB.......BBB.......#
#..BBB......+BBB.......#
#..B.........BBB.......#
#...*..............*...#
#..OO......XX......OO..#
#......;;;*....;;;.....#
#..1...;;;.....;;;...2.#
#......;;;.....;;;*....#
#..TT..;;;.....;;;..TT.#
#.......+......+.......#
#..BBB......BBB........#
#..BBB......BBB........#
#..B........BBB........#
#..~~~~................#
########################
`

const DUNES_THEME: MapTheme = {
  ground: '#2b2418',
  groundAlt: '#332b1c',
  grid: '#3e3423',
  wall: '#6b5c42',
  wallTop: '#7d6d50',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#6d6048',
  rockTop: '#807252',
  water: '#2a3438',
  waterEdge: '#3a4a4f',
  accent: '#f0c96b',
  shadow: 'rgba(0,0,0,0.32)',
  road: '#4a4030',
  roadLine: '#d8c48a',
  pavement: '#5a4d38',
  grass: '#3e4628',
  dirt: '#5c4b2e',
  building: '#6b5c46',
  buildingRoof: '#827054',
  tree: '#4f5a30',
  treeTop: '#6b7a40',
}

const CROSSROADS_THEME: MapTheme = {
  ground: '#1c2024',
  groundAlt: '#23282d',
  grid: '#2c3338',
  wall: '#444d54',
  wallTop: '#556069',
  crate: '#7a5c3a',
  crateTop: '#94714a',
  rock: '#4a5052',
  rockTop: '#5c6365',
  water: '#1e3138',
  waterEdge: '#2d4a53',
  accent: '#8fd0ff',
  shadow: 'rgba(0,0,0,0.4)',
  road: '#30363c',
  roadLine: '#d9e2ea',
  pavement: '#3b4248',
  grass: '#2f3a2c',
  dirt: '#3c362a',
  building: '#4b525c',
  buildingRoof: '#5b6370',
  tree: '#3e5f3d',
  treeTop: '#5a8150',
}

const COMPOUND_THEME: MapTheme = {
  ground: '#1e201b',
  groundAlt: '#252822',
  grid: '#30352b',
  wall: '#4d5548',
  wallTop: '#606a59',
  crate: '#8a6a3e',
  crateTop: '#a98550',
  rock: '#4c5148',
  rockTop: '#5e6358',
  water: '#203035',
  waterEdge: '#31484d',
  accent: '#ffb454',
  shadow: 'rgba(0,0,0,0.38)',
  road: '#292d26',
  roadLine: '#b7a24a',
  pavement: '#353a31',
  grass: '#2f3a24',
  dirt: '#3d3526',
  building: '#4d5448',
  buildingRoof: '#5d6657',
  tree: '#3d5a35',
  treeTop: '#557a47',
}

const FRONTIER_THEME: MapTheme = {
  ground: '#20261c',
  groundAlt: '#283020',
  grid: '#343d28',
  wall: '#535c4c',
  wallTop: '#66705c',
  crate: '#7a5c3a',
  crateTop: '#94714a',
  rock: '#4d5448',
  rockTop: '#606858',
  water: '#1c3238',
  waterEdge: '#2e4d55',
  accent: '#7fe0c0',
  shadow: 'rgba(0,0,0,0.35)',
  road: '#3a3a2c',
  roadLine: '#b6c08a',
  pavement: '#3f4636',
  grass: '#304226',
  dirt: '#4a3d29',
  building: '#5c5f4a',
  buildingRoof: '#6e7358',
  tree: '#335a2f',
  treeTop: '#4f7c42',
}

const CITADEL_THEME: MapTheme = {
  ground: '#1c1718',
  groundAlt: '#241d1e',
  grid: '#302628',
  wall: '#403236',
  wallTop: '#524246',
  crate: '#6f4f34',
  crateTop: '#85613f',
  rock: '#463a3c',
  rockTop: '#57494b',
  water: '#2a2226',
  waterEdge: '#3b3034',
  accent: '#ff6b5a',
  shadow: 'rgba(0,0,0,0.48)',
  road: '#2e272a',
  roadLine: '#9a6d5c',
  pavement: '#3a3033',
  grass: '#363a28',
  dirt: '#443528',
  building: '#4a3c3e',
  buildingRoof: '#5a484a',
  tree: '#4a4530',
  treeTop: '#635c40',
}

/** Sand, wrecks and open sight lines. */
function makeDunesGrid(): Grid {
  const g = makeGrid(24, 16)
  addBorder(g)
  paint(g, 2, 2, 20, 12, ';')
  paint(g, 2, 7, 20, 2, '=')
  paint(g, 11, 2, 2, 12, '=')
  paint(g, 3, 3, 2, 2, 'O')
  paint(g, 19, 3, 2, 2, 'O')
  paint(g, 3, 11, 2, 2, 'O')
  paint(g, 19, 11, 2, 2, 'O')
  paint(g, 8, 4, 2, 1, 'X')
  paint(g, 14, 4, 2, 1, 'X')
  paint(g, 8, 10, 2, 1, 'X')
  paint(g, 14, 10, 2, 1, 'X')
  paint(g, 6, 5, 2, 1, 'T')
  paint(g, 16, 5, 2, 1, 'T')
  paint(g, 6, 9, 2, 1, 'T')
  paint(g, 16, 9, 2, 1, 'T')
  place(g, 3, 13, '1')
  place(g, 20, 13, '2')
  place(g, 6, 2, '*')
  place(g, 17, 2, '*')
  place(g, 6, 13, '*')
  place(g, 17, 13, '*')
  place(g, 12, 3, '+')
  place(g, 12, 12, '+')
  place(g, 21, 8, '+')
  return g
}

/** A highway junction with four ruined blocks and a wide central crossing. */
function makeCrossroadsGrid(): Grid {
  const g = makeGrid(24, 16)
  addBorder(g)
  paint(g, 2, 2, 20, 12, ';')
  paint(g, 2, 7, 20, 2, '=')
  paint(g, 11, 2, 2, 12, '=')
  paint(g, 3, 2, 4, 3, 'B')
  paint(g, 17, 2, 4, 3, 'B')
  paint(g, 3, 11, 4, 3, 'B')
  paint(g, 17, 11, 4, 3, 'B')
  paint(g, 8, 4, 2, 1, 'X')
  paint(g, 14, 4, 2, 1, 'X')
  paint(g, 8, 10, 2, 1, 'X')
  paint(g, 14, 10, 2, 1, 'X')
  paint(g, 8, 5, 1, 2, 'O')
  paint(g, 15, 5, 1, 2, 'O')
  paint(g, 8, 9, 1, 2, 'O')
  paint(g, 15, 9, 1, 2, 'O')
  place(g, 2, 13, '1')
  place(g, 21, 13, '2')
  place(g, 5, 5, '*')
  place(g, 18, 5, '*')
  place(g, 5, 10, '*')
  place(g, 18, 10, '*')
  place(g, 12, 3, '+')
  place(g, 12, 12, '+')
  place(g, 8, 8, '+')
  place(g, 15, 8, '+')
  return g
}

/** A walled industrial compound with two gates and a killing ground inside. */
function makeCompoundGrid(): Grid {
  const g = makeGrid(24, 16)
  addBorder(g)
  paint(g, 2, 2, 20, 12, ':')
  paint(g, 5, 3, 14, 1, '#')
  paint(g, 5, 12, 14, 1, '#')
  paint(g, 5, 3, 1, 10, '#')
  paint(g, 18, 3, 1, 10, '#')
  paint(g, 10, 3, 4, 1, '.')
  paint(g, 10, 12, 4, 1, '.')
  paint(g, 8, 5, 3, 3, 'B')
  paint(g, 13, 8, 3, 3, 'B')
  paint(g, 6, 6, 2, 1, 'X')
  paint(g, 16, 6, 2, 1, 'X')
  paint(g, 6, 10, 2, 1, 'X')
  paint(g, 16, 10, 2, 1, 'X')
  paint(g, 12, 5, 1, 2, 'O')
  paint(g, 12, 10, 1, 2, 'O')
  place(g, 3, 13, '1')
  place(g, 3, 14, '2')
  place(g, 7, 4, '*')
  place(g, 16, 4, '*')
  place(g, 7, 11, '*')
  place(g, 16, 11, '*')
  place(g, 12, 6, '+')
  place(g, 12, 10, '+')
  place(g, 3, 9, '+')
  return g
}

// The frontier is a 15 x 9 grid of 2 x 2 cell road chambers separated by
// one-cell walls. Chambers are wide enough for a tank to turn inside and
// doorways are a full 80 px, so the current steering AI can drive the maze.
const FRONTIER_ROOMS_X = 15
const FRONTIER_ROOMS_Y = 9
const FRONTIER_ROOM = 3
const FRONTIER_ORIGIN = 2
const FRONTIER_VAULT = { rx: 7, ry: 4 }

function frontierRoomX(rx: number): number {
  return FRONTIER_ORIGIN + rx * FRONTIER_ROOM
}

function frontierRoomY(ry: number): number {
  return FRONTIER_ORIGIN + ry * FRONTIER_ROOM
}

/** Rooms swallowed by the two fortified bases. */
function isFrontierBaseRoom(rx: number, ry: number): boolean {
  return ry >= 3 && ry <= 5 && (rx <= 3 || rx >= 11)
}

function isFrontierMazeRoom(rx: number, ry: number): boolean {
  return (
    rx >= 0 &&
    rx < FRONTIER_ROOMS_X &&
    ry >= 0 &&
    ry < FRONTIER_ROOMS_Y &&
    !isFrontierBaseRoom(rx, ry)
  )
}

/** Carve a full-width doorway in the wall between two chambers. */
function carveFrontierDoor(g: Grid, ax: number, ay: number, bx: number, by: number): void {
  if (ay === by) {
    paint(g, frontierRoomX(Math.min(ax, bx)) + 2, frontierRoomY(ay), 1, 2, '=')
  } else {
    paint(g, frontierRoomX(ax), frontierRoomY(Math.min(ay, by)) + 2, 2, 1, '=')
  }
}

/** Blastable crate doorway: blocked until a tank shoots it open. */
function crateFrontierDoor(g: Grid, ax: number, ay: number, bx: number, by: number): void {
  if (ay === by) {
    paint(g, frontierRoomX(Math.min(ax, bx)) + 2, frontierRoomY(ay), 1, 2, 'X')
  } else {
    paint(g, frontierRoomX(ax), frontierRoomY(Math.min(ay, by)) + 2, 2, 1, 'X')
  }
}

function frontierDoorOpen(g: Grid, ax: number, ay: number, bx: number, by: number): boolean {
  if (ay === by) {
    const x = frontierRoomX(Math.min(ax, bx)) + 2
    const y = frontierRoomY(ay)
    return g[y][x] !== '#' && g[y + 1][x] !== '#'
  }
  const x = frontierRoomX(ax)
  const y = frontierRoomY(Math.min(ay, by)) + 2
  return g[y][x] !== '#' && g[y][x + 1] !== '#'
}

/** Number of open sides on a chamber, used to find dead ends. */
function frontierRoomDegree(g: Grid, rx: number, ry: number): number {
  const x = frontierRoomX(rx)
  const y = frontierRoomY(ry)
  const open = (cx: number, cy: number): boolean => g[cy] !== undefined && g[cy][cx] !== '#'
  let degree = 0
  if (rx > 0 && open(x - 1, y) && open(x - 1, y + 1)) degree++
  if (rx < FRONTIER_ROOMS_X - 1 && open(x + 2, y) && open(x + 2, y + 1)) degree++
  if (ry > 0 && open(x, y - 1) && open(x + 1, y - 1)) degree++
  if (ry < FRONTIER_ROOMS_Y - 1 && open(x, y + 2) && open(x + 1, y + 2)) degree++
  return degree
}

/** Grow the left half as a perfect maze, then mirror it for a fair arena. */
function growFrontierMaze(g: Grid): void {
  const rng = createRng(hashString('frontier-road-maze-v7'))
  const key = (rx: number, ry: number): string => `${rx},${ry}`
  const visited = new Set<string>()
  const start = { rx: 0, ry: 0 }
  visited.add(key(start.rx, start.ry))
  const stack = [start]
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const options: { rx: number; ry: number }[] = []
    for (const [dx, dy] of directions) {
      const rx = current.rx + dx
      const ry = current.ry + dy
      if (rx < 0 || rx > 7 || !isFrontierMazeRoom(rx, ry) || visited.has(key(rx, ry))) continue
      options.push({ rx, ry })
    }
    if (options.length === 0) {
      stack.pop()
      continue
    }
    const next = rng.pick(options)
    carveFrontierDoor(g, current.rx, current.ry, next.rx, next.ry)
    visited.add(key(next.rx, next.ry))
    stack.push(next)
  }

  // A few extra doors create loops, so a wrong turn is recoverable without
  // backtracking through the entire maze.
  const candidates: { ax: number; ay: number; bx: number; by: number }[] = []
  for (let ry = 0; ry < FRONTIER_ROOMS_Y; ry++) {
    for (let rx = 0; rx <= 7; rx++) {
      if (!isFrontierMazeRoom(rx, ry)) continue
      if (rx < 7 && isFrontierMazeRoom(rx + 1, ry) && !frontierDoorOpen(g, rx, ry, rx + 1, ry)) {
        candidates.push({ ax: rx, ay: ry, bx: rx + 1, by: ry })
      }
      if (isFrontierMazeRoom(rx, ry + 1) && !frontierDoorOpen(g, rx, ry, rx, ry + 1)) {
        candidates.push({ ax: rx, ay: ry, bx: rx, by: ry + 1 })
      }
    }
  }
  for (let i = 0; i < 2 && candidates.length > 0; i++) {
    const edge = candidates.splice(rng.int(0, candidates.length - 1), 1)[0]
    carveFrontierDoor(g, edge.ax, edge.ay, edge.bx, edge.by)
  }

  // Barricade the vault's west door (mirrored to the east door), but always
  // leave a normal way in from the north or south.
  if (
    !frontierDoorOpen(g, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry - 1) &&
    !frontierDoorOpen(g, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry + 1)
  ) {
    carveFrontierDoor(g, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry, FRONTIER_VAULT.rx, FRONTIER_VAULT.ry - 1)
  }
  crateFrontierDoor(
    g,
    FRONTIER_VAULT.rx - 1,
    FRONTIER_VAULT.ry,
    FRONTIER_VAULT.rx,
    FRONTIER_VAULT.ry,
  )

  // Two more crate-sealed shortcuts per side reward map knowledge.
  const shortcuts = [
    { ax: 5, ay: 0, bx: 6, by: 0 },
    { ax: 4, ay: 7, bx: 5, by: 7 },
    { ax: 5, ay: 2, bx: 6, by: 2 },
    { ax: 1, ay: 6, bx: 2, by: 6 },
    { ax: 2, ay: 8, bx: 3, by: 8 },
  ]
  let crates = 0
  for (const edge of shortcuts) {
    if (crates >= 2) break
    if (!isFrontierMazeRoom(edge.ax, edge.ay) || !isFrontierMazeRoom(edge.bx, edge.by)) continue
    if (frontierDoorOpen(g, edge.ax, edge.ay, edge.bx, edge.by)) continue
    crateFrontierDoor(g, edge.ax, edge.ay, edge.bx, edge.by)
    crates++
  }
}

/** A 48 x 30 capture-the-flag arena built as a wide road maze. */
function makeFrontierGrid(): Grid {
  const g = makeGrid(48, 30, '#')

  // Every non-base chamber starts as road.
  for (let ry = 0; ry < FRONTIER_ROOMS_Y; ry++) {
    for (let rx = 0; rx < FRONTIER_ROOMS_X; rx++) {
      if (isFrontierBaseRoom(rx, ry)) continue
      paint(g, frontierRoomX(rx), frontierRoomY(ry), 2, 2, '=')
    }
  }

  growFrontierMaze(g)

  // Fortified bases at opposite ends, open plan behind a single inner gate.
  paint(g, 2, 11, 11, 8, ':')
  paint(g, 2, 10, 12, 1, '#')
  paint(g, 2, 19, 12, 1, '#')
  paint(g, 13, 10, 1, 10, '#')
  // One gate on the inner wall, lined up with the flag so a tank can drive
  // straight in and out without hunting for the entrance.
  paint(g, 13, 14, 1, 2, '=')

  // Mirror the left half to the right for a perfectly fair arena.
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length / 2; x++) {
      g[y][g[0].length - 1 - x] = g[y][x]
    }
  }

  // Flags and spawns.
  place(g, 7, 14, 'Y')
  place(g, 40, 14, 'E')
  place(g, 4, 12, '1')
  place(g, 4, 17, '2')
  place(g, 43, 12, '*')
  place(g, 43, 17, '*')
  place(g, 39, 6, '*')
  place(g, 39, 24, '*')
  place(g, 33, 15, '*')
  place(g, 27, 24, '*')

  // Supply caches: the vault plus the most central dead ends on each side.
  const deadEnds: { rx: number; ry: number }[] = []
  for (let ry = 0; ry < FRONTIER_ROOMS_Y; ry++) {
    for (let rx = 0; rx < FRONTIER_ROOMS_X; rx++) {
      if (!isFrontierMazeRoom(rx, ry)) continue
      if (rx === FRONTIER_VAULT.rx && ry === FRONTIER_VAULT.ry) continue
      if (frontierRoomDegree(g, rx, ry) === 1) deadEnds.push({ rx, ry })
    }
  }
  const distance = (room: { rx: number; ry: number }): number =>
    Math.hypot(room.rx - FRONTIER_VAULT.rx, room.ry - FRONTIER_VAULT.ry)
  const leftEnds = deadEnds.filter((room) => room.rx < FRONTIER_VAULT.rx).sort((a, b) => distance(a) - distance(b))
  const rightEnds = deadEnds.filter((room) => room.rx > FRONTIER_VAULT.rx).sort((a, b) => distance(a) - distance(b))
  const caches = [
    FRONTIER_VAULT,
    ...leftEnds.slice(0, 3),
    ...rightEnds.slice(0, 3),
  ]
  for (const room of caches) {
    place(g, frontierRoomX(room.rx), frontierRoomY(room.ry), '+')
  }

  return g
}

/** The final boss arena: a broken citadel with a long central approach. */
function makeCitadelGrid(): Grid {
  const g = makeGrid(24, 16)
  addBorder(g)
  paint(g, 2, 2, 20, 12, ';')
  paint(g, 2, 7, 20, 2, '=')
  paint(g, 5, 3, 1, 4, '#')
  paint(g, 5, 10, 1, 3, '#')
  paint(g, 18, 3, 1, 3, '#')
  paint(g, 18, 10, 1, 4, '#')
  paint(g, 8, 3, 3, 2, 'B')
  paint(g, 13, 3, 3, 2, 'B')
  paint(g, 8, 11, 3, 2, 'B')
  paint(g, 13, 11, 3, 2, 'B')
  paint(g, 9, 6, 1, 2, 'O')
  paint(g, 14, 6, 1, 2, 'O')
  paint(g, 9, 9, 1, 2, 'O')
  paint(g, 14, 9, 1, 2, 'O')
  paint(g, 3, 5, 2, 1, 'X')
  paint(g, 19, 5, 2, 1, 'X')
  paint(g, 3, 10, 2, 1, 'X')
  paint(g, 19, 10, 2, 1, 'X')
  place(g, 2, 13, '1')
  place(g, 2, 14, '2')
  place(g, 21, 3, '*')
  place(g, 21, 4, '*')
  place(g, 21, 11, '*')
  place(g, 21, 12, '*')
  place(g, 12, 4, '+')
  place(g, 12, 11, '+')
  place(g, 7, 8, '+')
  place(g, 16, 8, '+')
  return g
}

const SOURCES: MapSource[] = [
  {
    id: 'downtown',
    name: 'Downtown',
    description:
      'City blocks and wide avenues. Break the buildings for firing lanes, but the streets are exposed.',
    biome: 'city',
    theme: DOWNTOWN_THEME,
    grid: parseGrid('downtown', DOWNTOWN_GRID),
  },
  {
    id: 'greenway',
    name: 'Greenway',
    description:
      'A city park of lawns, ponds and tree cover. Trees and boulders can be blasted away.',
    biome: 'park',
    theme: GREENWAY_THEME,
    grid: parseGrid('greenway', GREENWAY_GRID),
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description:
      'Tight industrial yard. Warehouse cover, container stacks and a cooling channel down the middle.',
    biome: 'industrial',
    theme: FOUNDRY_THEME,
    grid: parseGrid('foundry', FOUNDRY_GRID),
  },
  {
    id: 'village',
    name: 'Village',
    description:
      'Houses around a central square, ringed by fields and orchards. Hold the square and level the cover.',
    biome: 'village',
    theme: VILLAGE_THEME,
    grid: parseGrid('village', VILLAGE_GRID),
  },
  {
    id: 'ashfield',
    name: 'Ashfield',
    description:
      'A burnt-out city district. Ruined buildings and rubble everywhere. Nothing here is safe.',
    biome: 'ruins',
    theme: ASHFIELD_THEME,
    grid: parseGrid('ashfield', ASHFIELD_GRID),
  },
  {
    id: 'dunes',
    name: 'Dunes',
    description:
      'Open sand, shattered wrecks and long sight lines. Speed and cover matter more than armour.',
    biome: 'desert',
    theme: DUNES_THEME,
    grid: makeDunesGrid(),
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    description:
      'A four-way highway junction ringed by ruined blocks. The crossing is wide, flat and lethal.',
    biome: 'city',
    theme: CROSSROADS_THEME,
    grid: makeCrossroadsGrid(),
  },
  {
    id: 'compound',
    name: 'Compound',
    description:
      'A walled industrial compound with two gates and a killing ground inside. Break in and take it.',
    biome: 'industrial',
    theme: COMPOUND_THEME,
    grid: makeCompoundGrid(),
  },
  {
    id: 'frontier',
    name: 'Frontier',
    description:
      'A fortress maze of switchbacks and dead ends. Every route to the enemy flag is a puzzle, and a few crate barricades hide risky shortcuts.',
    biome: 'park',
    theme: FRONTIER_THEME,
    grid: makeFrontierGrid(),
    camera: 'follow',
  },
  {
    id: 'citadel',
    name: 'Citadel',
    description:
      'The last citadel. A long central approach between broken walls leads to the final tyrant.',
    biome: 'ruins',
    theme: CITADEL_THEME,
    grid: makeCitadelGrid(),
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
