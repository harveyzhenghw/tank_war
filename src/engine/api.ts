import type { Difficulty, GameMode, GameStatus, Objective, WeaponId } from './types'

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
}

export type ResolvedMatchOptions = Required<Omit<MatchOptions, 'levelId'>> & {
  levelId?: string
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
}

export interface MatchResult {
  victory: boolean
  score: number
  kills: number
  deaths: number
  time: number
  levelId?: string
  mode: GameMode
  detail: string
  players: Array<{
    name: string
    color: string
    kills: number
    deaths: number
    alive: boolean
  }>
}