import type { KeyBinds } from './engine/input'
import { DEFAULT_BINDS } from './engine/input'

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
}

export const DEFAULT_PROGRESS: Progress = { unlocked: 1, best: {}, skirmishBest: 0 }

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS }
    const parsed = JSON.parse(raw) as Partial<Progress>
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      best: { ...(parsed.best ?? {}) },
      unlocked: Math.max(1, Math.min(5, parsed.unlocked ?? 1)),
    }
  } catch {
    return { ...DEFAULT_PROGRESS }
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