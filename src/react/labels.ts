import type { Objective } from '../engine/types'

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  elimination: 'Elimination',
  survival: 'Survival',
  capture: 'Capture',
  deathmatch: 'Deathmatch',
  versus: 'Versus',
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatScore(score: number): string {
  return score.toLocaleString('en-US')
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false
}