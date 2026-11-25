import type {
  BoosterId,
  Difficulty,
  GameMode,
  GameStatus,
  Objective,
  SkinId,
  WeaponId,
} from './types'

export interface Loadout {
  weapons: WeaponId[]
  skin: SkinId | null
  boosters: BoosterId[]
}

export interface MatchOptions {
  mode: GameMode
  mapId: string
  levelId?: string
  objective: Objective
  difficulty: Difficulty
  botCount?: number
  waves?: number
  captureSeconds?: number
  targetKills?: number
  players?: 1 | 2
  seed?: number
  loadout?: Loadout
  bossId?: string
}

export type ResolvedMatchOptions = Required<Omit<MatchOptions, 'levelId' | 'bossId'>> & {
  levelId?: string
  bossId?: string
}

export interface WeaponHud {
  id: WeaponId
  ammo: number | null
}

export interface PlayerHud {
  index: number
  name: string
  color: string
  hp: number
  maxHp: number
  alive: boolean
  weapon: WeaponId
  ammo: number | null
  weapons: WeaponHud[]
  overdrive: number
  kills: number
  shield: boolean
  damageBoost: boolean
  speedBoost: boolean
  armorBoost: boolean
}

export interface BossHud {
  name: string
  title: string
  hp: number
  maxHp: number
  enraged: boolean
}

export interface FlagHud {
  owner: 'player' | 'enemy'
  status: 'home' | 'carried' | 'dropped'
  carrier: string | null
}

export interface HudSnapshot {
  status: GameStatus
  paused: boolean
  countdown: number
  objective: Objective
  detail: string
  progress: number
  time: number
  enemies: number
  wave: number
  wavesTotal: number
  message: string | null
  players: PlayerHud[]
  score: number
  kills: number
  coins: number
  boss: BossHud | null
  flags: FlagHud[]
}

export interface MatchResult {
  victory: boolean
  score: number
  kills: number
  deaths: number
  time: number
  levelId?: string
  mode: GameMode
  difficulty: Difficulty
  detail: string
  coinsEarned: number
  players: Array<{
    name: string
    color: string
    kills: number
    deaths: number
    alive: boolean
  }>
}