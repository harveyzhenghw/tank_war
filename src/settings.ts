import type { KeyBinds } from './engine/input'
import { DEFAULT_BINDS } from './engine/input'
import type { BoosterId, SkinId, WeaponId } from './engine/types'
import { CORE_WEAPONS, isWeaponId } from './data/weapons'
import { MAX_EQUIPPED_BOOSTERS, isBoosterId } from './data/boosters'
import { DEFAULT_SKIN, isSkinId } from './data/skins'

export type PaletteSetting = 'default' | 'contrast'
export type TouchSetting = 'auto' | 'on' | 'off'

export interface Settings {
  master: number
  sfx: number
  music: number
  shake: boolean
  palette: PaletteSetting
  touch: TouchSetting
  binds: KeyBinds
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.85,
  sfx: 0.8,
  music: 0.3,
  shake: true,
  palette: 'default',
  touch: 'auto',
  binds: { ...DEFAULT_BINDS },
}

const SETTINGS_KEY = 'tankwar.settings.v1'
const PROGRESS_KEY = 'tankwar.progress.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      binds: { ...DEFAULT_SETTINGS.binds, ...(parsed.binds ?? {}) },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // storage can be unavailable in private mode
  }
}

export interface Progress {
  unlocked: number
  best: Record<string, number>
  skirmishBest: number
  coins: number
  totalKills: number
  ownedWeapons: WeaponId[]
  ownedSkins: SkinId[]
  equippedSkin: SkinId
  ownedBoosters: BoosterId[]
  equippedBoosters: BoosterId[]
}

export const DEFAULT_PROGRESS: Progress = {
  unlocked: 1,
  best: {},
  skirmishBest: 0,
  coins: 0,
  totalKills: 0,
  ownedWeapons: [...CORE_WEAPONS],
  ownedSkins: [DEFAULT_SKIN],
  equippedSkin: DEFAULT_SKIN,
  ownedBoosters: [],
  equippedBoosters: [],
}

function validIds<T extends string>(
  values: unknown,
  guard: (value: string) => value is T,
): T[] {
  if (!Array.isArray(values)) return []
  const out: T[] = []
  for (const value of values) {
    if (typeof value === 'string' && guard(value) && !out.includes(value)) out.push(value)
  }
  return out
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS, best: {}, ownedWeapons: [...CORE_WEAPONS] }
    const parsed = JSON.parse(raw) as Partial<Progress>
    const ownedWeapons = validIds(parsed.ownedWeapons, isWeaponId)
    for (const id of CORE_WEAPONS) {
      if (!ownedWeapons.includes(id)) ownedWeapons.push(id)
    }
    const ownedSkins = validIds(parsed.ownedSkins, isSkinId)
    if (!ownedSkins.includes(DEFAULT_SKIN)) ownedSkins.unshift(DEFAULT_SKIN)
    const ownedBoosters = validIds(parsed.ownedBoosters, isBoosterId)
    const equippedSkin =
      parsed.equippedSkin &&
      isSkinId(parsed.equippedSkin) &&
      ownedSkins.includes(parsed.equippedSkin)
        ? parsed.equippedSkin
        : DEFAULT_SKIN
    const equippedBoosters = validIds(parsed.equippedBoosters, isBoosterId)
      .filter((id) => ownedBoosters.includes(id))
      .slice(0, MAX_EQUIPPED_BOOSTERS)

    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      best: { ...(parsed.best ?? {}) },
      unlocked: Math.max(1, Math.min(5, parsed.unlocked ?? 1)),
      coins: Math.max(0, Math.floor(parsed.coins ?? 0)),
      totalKills: Math.max(0, Math.floor(parsed.totalKills ?? 0)),
      ownedWeapons,
      ownedSkins,
      equippedSkin,
      ownedBoosters,
      equippedBoosters,
    }
  } catch {
    return { ...DEFAULT_PROGRESS, best: {}, ownedWeapons: [...CORE_WEAPONS] }
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // ignore
  }
}

export function prefersTouch(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}