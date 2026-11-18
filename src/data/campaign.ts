import type { Difficulty, Objective } from '../engine/types'

export interface LevelDef {
  id: string
  index: number
  name: string
  mapId: string
  brief: string
  objectiveLabel: string
  bots: number
  difficulty: Difficulty
  objective: Objective
  waves?: number
  captureSeconds?: number
}

export const CAMPAIGN: LevelDef[] = [
  {
    id: 'l1',
    index: 0,
    name: 'First Contact',
    mapId: 'foundry',
    brief: 'A scout lance is holding the foundry yard. Clear it out.',
    objectiveLabel: 'Destroy all hostiles',
    bots: 3,
    difficulty: 'easy',
    objective: 'elimination',
  },
  {
    id: 'l2',
    index: 1,
    name: 'Sandstorm',
    mapId: 'dunes',
    brief: 'Raider armour is scattered across the dunes. Hunt every tank down.',
    objectiveLabel: 'Destroy all hostiles',
    bots: 4,
    difficulty: 'normal',
    objective: 'elimination',
  },
  {
    id: 'l3',
    index: 2,
    name: 'Hold the Line',
    mapId: 'crossroads',
    brief: 'Three waves are pushing through the crossroads. Nothing gets past.',
    objectiveLabel: 'Survive three waves',
    bots: 2,
    difficulty: 'normal',
    objective: 'survival',
    waves: 3,
  },
  {
    id: 'l4',
    index: 3,
    name: 'Seize the Yard',
    mapId: 'compound',
    brief: 'Take the central yard and hold it for twenty seconds under fire.',
    objectiveLabel: 'Capture the yard',
    bots: 3,
    difficulty: 'hard',
    objective: 'capture',
    captureSeconds: 20,
  },
  {
    id: 'l5',
    index: 4,
    name: 'Last Stand',
    mapId: 'ashfield',
    brief: 'A veteran spearhead is massing. There is no line behind you.',
    objectiveLabel: 'Destroy the spearhead',
    bots: 6,
    difficulty: 'veteran',
    objective: 'elimination',
  },
]

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(
  CAMPAIGN.map((level) => [level.id, level]),
)

export function getLevel(id: string): LevelDef | undefined {
  return LEVEL_BY_ID[id]
}