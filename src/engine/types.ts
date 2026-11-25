import type { Rect, Vec2 } from './math'
import type { Rng } from './rng'
import type { SpatialGrid } from './spatial'

export type WeaponId =
  | 'cannon'
  | 'mg'
  | 'rocket'
  | 'spread'
  | 'rail'
  | 'plasma'
  | 'flame'
export type SkinId =
  | 'field'
  | 'desert'
  | 'arctic'
  | 'urban'
  | 'crimson'
  | 'void'
  | 'toxic'
  | 'gold'
export type BoosterId = 'ammoBelt' | 'hull' | 'armour' | 'loader' | 'stim' | 'shield'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'veteran'
export type GameMode = 'campaign' | 'skirmish' | 'versus' | 'ctf'
export type Objective =
  | 'elimination'
  | 'survival'
  | 'capture'
  | 'deathmatch'
  | 'versus'
  | 'ctf'
export type Biome = 'city' | 'park' | 'industrial' | 'village' | 'ruins' | 'desert'
export type ObstacleKind = 'wall' | 'crate' | 'rock' | 'building' | 'tree'
export type TerrainKind = 'road' | 'pavement' | 'grass' | 'dirt'
export type PickupKind = 'health' | 'armor' | 'damage' | 'speed' | 'ammo' | 'shield'
export type GameStatus = 'playing' | 'won' | 'lost'
export type ParticleKind = 'spark' | 'smoke' | 'ring' | 'debris' | 'text' | 'flash'
export type SfxName =
  | 'cannon'
  | 'mg'
  | 'rocket'
  | 'spread'
  | 'rail'
  | 'plasma'
  | 'flame'
  | 'explosion'
  | 'hit'
  | 'pickup'
  | 'death'
  | 'overdrive'
  | 'ui'
  | 'win'
  | 'lose'
  | 'wave'

export type BotMode = 'patrol' | 'engage' | 'retreat' | 'pickup' | 'flag'

export interface Obstacle extends Rect {
  id: number
  kind: ObstacleKind
  hp: number
  maxHp: number
  alive: boolean
  tone: number
}

export interface Pickup {
  id: number
  kind: PickupKind
  x: number
  y: number
  bob: number
  life: number
  alive: boolean
}

export interface Projectile {
  id: number
  ownerId: number
  team: number
  weapon: WeaponId
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  life: number
  splash: number
  color: string
  armed: number
  pierce: number
  hitIds: number[]
}

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  text?: string
  angle: number
  spin: number
  drag: number
}

export interface BotBrain {
  difficulty: Difficulty
  targetId: number | null
  mode: BotMode
  waypoint: Vec2 | null
  think: number
  aimOffset: number
  aimTimer: number
  stuckCheck: number
  lastX: number
  lastY: number
  unstick: number
  reverse: number
}

export interface Tank {
  id: number
  team: number
  playerIndex: number | null
  isBot: boolean
  name: string
  x: number
  y: number
  vx: number
  vy: number
  hullAngle: number
  turretAngle: number
  hp: number
  maxHp: number
  armor: number
  radius: number
  speed: number
  turnRate: number
  turretTurnRate: number
  weapon: WeaponId
  weapons: WeaponId[]
  ammo: Record<WeaponId, number>
  skin: SkinId | null
  cooldown: number
  reloadScale: number
  alive: boolean
  respawnAt: number | null
  spawnProtection: number
  overdrive: number
  overdriveCooldown: number
  shield: number
  damageBoost: number
  speedBoost: number
  armorBoost: number
  trackPhase: number
  recoil: number
  hitFlash: number
  color: string
  accent: string
  kills: number
  deaths: number
  lastHitBy: number | null
  ai: BotBrain | null
  isBoss: boolean
  bossName: string | null
  bossTitle: string | null
  enraged: boolean
  damageScale: number
  bounty: number
}

export interface FlagState {
  /** Team that owns this flag. Team 0 is the player side. */
  team: number
  x: number
  y: number
  homeX: number
  homeY: number
  /** Tank id currently carrying this flag, or null. */
  carriedBy: number | null
  dropped: boolean
  returnTimer: number
  /** True once the player side has spotted the enemy flag. */
  revealed: boolean
}

export interface CaptureZone extends Rect {
  progress: number
  duration: number
  contested: boolean
}

export interface MapTheme {
  ground: string
  groundAlt: string
  grid: string
  wall: string
  wallTop: string
  crate: string
  crateTop: string
  rock: string
  rockTop: string
  water: string
  waterEdge: string
  accent: string
  shadow: string
  road: string
  roadLine: string
  pavement: string
  grass: string
  dirt: string
  building: string
  buildingRoof: string
  tree: string
  treeTop: string
}

export interface TerrainRect extends Rect {
  kind: TerrainKind
}

export interface Decor {
  x: number
  y: number
  r: number
  tone: number
}

export interface MapDef {
  id: string
  name: string
  description: string
  biome: Biome
  theme: MapTheme
  width: number
  height: number
  cell: number
  gridCols: number
  gridRows: number
  obstacles: Obstacle[]
  water: Rect[]
  terrain: TerrainRect[]
  decor: Decor[]
  playerSpawns: Vec2[]
  botSpawns: Vec2[]
  pickupPoints: Vec2[]
  /** Large arenas can use a player-following camera instead of fitting the whole map. */
  camera: 'fit' | 'follow'
  flagPoints: { player: Vec2; enemy: Vec2 } | null
}

export interface World {
  map: MapDef
  bounds: Rect
  obstacles: Obstacle[]
  grid: SpatialGrid<Obstacle>
  tanks: Tank[]
  projectiles: Projectile[]
  particles: Particle[]
  pickups: Pickup[]
  zone: CaptureZone | null
  flags: FlagState[]
  objective: Objective
  status: GameStatus
  time: number
  countdown: number
  shake: number
  hitFlash: number
  kills: number
  deaths: number
  score: number
  coinsEarned: number
  wave: number
  wavesTotal: number
  waveTimer: number
  events: SfxName[]
  message: string
  messageTimer: number
  rng: Rng
  nextId: number
  pickupTimer: number
  respawn: boolean
  respawnDelay: number
  respawnPlayers: boolean
  victoryDetail: string
}

export interface PlayerControls {
  moveX: number
  moveY: number
  aimAngle: number | null
  aimTarget: Vec2 | null
  turretTurn: number
  fire: boolean
  overdrive: boolean
  cycle: number
  selectWeapon: WeaponId | null
}

export const EMPTY_CONTROLS: PlayerControls = {
  moveX: 0,
  moveY: 0,
  aimAngle: null,
  aimTarget: null,
  turretTurn: 0,
  fire: false,
  overdrive: false,
  cycle: 0,
  selectWeapon: null,
}