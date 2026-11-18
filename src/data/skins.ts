import type { SkinId } from '../engine/types'

export interface SkinDef {
  id: SkinId
  name: string
  description: string
  price: number
  body: string
  tread: string
  turret: string
  barrel: string
  marker: string
}

export const SKINS: Record<SkinId, SkinDef> = {
  field: {
    id: 'field',
    name: 'Field Green',
    description: 'Standard-issue teal armour. Reliable and unassuming.',
    price: 0,
    body: '#63d1b4',
    tread: '#1a2a24',
    turret: '#86e4cc',
    barrel: '#a7f0dd',
    marker: '#eafff7',
  },
  desert: {
    id: 'desert',
    name: 'Desert Tan',
    description: 'Sun-bleached plating for long patrols in the dunes.',
    price: 60,
    body: '#d8b36a',
    tread: '#3a2e1c',
    turret: '#e8c98a',
    barrel: '#f4ddb0',
    marker: '#fff6df',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic White',
    description: 'Cold-weather camouflage with a high-visibility marker.',
    price: 90,
    body: '#d8e6ef',
    tread: '#2b3a44',
    turret: '#eff8ff',
    barrel: '#ffffff',
    marker: '#ffffff',
  },
  urban: {
    id: 'urban',
    name: 'Urban Grey',
    description: 'Concrete-and-steel livery built for close-quarters fighting.',
    price: 120,
    body: '#8a97a3',
    tread: '#232a30',
    turret: '#a8b4bf',
    barrel: '#c3ccd5',
    marker: '#eef3f8',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Guard',
    description: 'Parade colours of a very expensive private army.',
    price: 180,
    body: '#d6674f',
    tread: '#331714',
    turret: '#e88a72',
    barrel: '#f2ab99',
    marker: '#ffe6dd',
  },
  void: {
    id: 'void',
    name: 'Void Violet',
    description: 'Experimental coating that drinks the light around it.',
    price: 250,
    body: '#8b6bd9',
    tread: '#221a38',
    turret: '#ad90f0',
    barrel: '#cbb8ff',
    marker: '#efe6ff',
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic Lime',
    description: 'Chemical warning stripes. The enemy will see you coming.',
    price: 300,
    body: '#9bd53f',
    tread: '#22330f',
    turret: '#bce96f',
    barrel: '#d8ffa0',
    marker: '#f2ffdf',
  },
  gold: {
    id: 'gold',
    name: 'Gold Commander',
    description: 'Solid gold plating. Pure intimidation, questionable armour.',
    price: 450,
    body: '#e9b949',
    tread: '#3a2c10',
    turret: '#f4d27a',
    barrel: '#ffe7a8',
    marker: '#fff6d6',
  },
}

export const SKIN_ORDER: SkinId[] = [
  'field',
  'desert',
  'arctic',
  'urban',
  'crimson',
  'void',
  'toxic',
  'gold',
]

export const DEFAULT_SKIN: SkinId = 'field'

export function isSkinId(value: string): value is SkinId {
  return value in SKINS
}
