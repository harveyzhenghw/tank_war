import type { Tank, World } from '../engine/types'

export type Palette = 'default' | 'contrast'

export interface TankTone {
  body: string
  tread: string
  turret: string
  barrel: string
  marker: string
}

/** Colourblind-safe replacements applied at draw time only. */
export function tankTone(team: number, isPlayer: boolean, palette: Palette, base: string): TankTone {
  if (palette === 'contrast') {
    if (isPlayer) {
      return {
        body: '#35c4f0',
        tread: '#123a49',
        turret: '#7fe6ff',
        barrel: '#9ff0ff',
        marker: '#d9fbff',
      }
    }
    return {
      body: '#ff5b45',
      tread: '#3d1512',
      turret: '#ff8a6e',
      barrel: '#ffb199',
      marker: '#ffe3d9',
    }
  }
  if (isPlayer) {
    return {
      body: base,
      tread: '#1a2a24',
      turret: lighten(base, 0.22),
      barrel: lighten(base, 0.34),
      marker: '#eafff7',
    }
  }
  return {
    body: base,
    tread: '#2a1613',
    turret: lighten(base, 0.18),
    barrel: lighten(base, 0.3),
    marker: '#ffe6dd',
  }
}

export function tankMarkerColor(tank: Tank, palette: Palette): string {
  if (tank.playerIndex !== null) return palette === 'contrast' ? '#d9fbff' : '#eafff7'
  return '#ffb199'
}

function lighten(hex: string, amount: number): string {
  const n = parseHex(hex)
  if (!n) return hex
  const r = Math.round(n.r + (255 - n.r) * amount)
  const g = Math.round(n.g + (255 - n.g) * amount)
  const b = Math.round(n.b + (255 - n.b) * amount)
  return `rgb(${r},${g},${b})`
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return null
  if (hex.length === 4) {
    return {
      r: parseInt(hex[1] + hex[1], 16),
      g: parseInt(hex[2] + hex[2], 16),
      b: parseInt(hex[3] + hex[3], 16),
    }
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

export function shade(hex: string, amount: number): string {
  const n = parseHex(hex)
  if (!n) return hex
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  return `rgb(${mix(n.r)},${mix(n.g)},${mix(n.b)})`
}