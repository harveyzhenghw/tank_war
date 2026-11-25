import type { Difficulty, Objective } from '../engine/types'

export interface LevelDef {
  id: string
  index: number
  name: string
  mapId: string
  brief: string
  objectiveLabel: string
  /** Number of regular enemies, or escorts on a boss mission. */
  bots: number
  /** The tier this operation was designed around. The player may pick any tier. */
  recommended: Difficulty
  objective: Objective
  waves?: number
  captureSeconds?: number
  bossId?: string
}

export const CAMPAIGN: LevelDef[] = [
  {
    id: 'l1',
    index: 0,
    name: 'First Contact',
    mapId: 'downtown',
    brief:
      'A scout lance is dug into the city blocks. Clear the streets and bring the buildings down.',
    objectiveLabel: 'Destroy all hostiles',
    bots: 3,
    recommended: 'easy',
    objective: 'elimination',
  },
  {
    id: 'l2',
    index: 1,
    name: 'Greenway Sweep',
    mapId: 'greenway',
    brief:
      'Raider armour is using the park for cover. Hunt them through the trees and ponds.',
    objectiveLabel: 'Destroy all hostiles',
    bots: 4,
    recommended: 'normal',
    objective: 'elimination',
  },
  {
    id: 'l3',
    index: 2,
    name: 'Hold the Line',
    mapId: 'foundry',
    brief:
      'Three waves are pushing through the industrial yard. Nothing gets past the warehouses.',
    objectiveLabel: 'Survive three waves',
    bots: 3,
    recommended: 'normal',
    objective: 'survival',
    waves: 3,
  },
  {
    id: 'l4',
    index: 3,
    name: 'Seize the Square',
    mapId: 'village',
    brief: 'Take the village square and hold it for twenty seconds under fire.',
    objectiveLabel: 'Capture the square',
    bots: 4,
    recommended: 'hard',
    objective: 'capture',
    captureSeconds: 20,
  },
  {
    id: 'l5',
    index: 4,
    name: 'Iron Marshal',
    mapId: 'ashfield',
    brief:
      'The Ashfield warlord is massing a spearhead in the burnt-out district. Break the escorts, then the Marshal.',
    objectiveLabel: 'Destroy the Iron Marshal',
    bots: 3,
    recommended: 'hard',
    objective: 'elimination',
    bossId: 'ironMarshal',
  },
  {
    id: 'l6',
    index: 5,
    name: 'Dune Patrol',
    mapId: 'dunes',
    brief:
      'Raider tanks are running supplies across the open sand. Cut the column apart before it scatters.',
    objectiveLabel: 'Destroy all hostiles',
    bots: 5,
    recommended: 'hard',
    objective: 'elimination',
  },
  {
    id: 'l7',
    index: 6,
    name: 'Crossroads',
    mapId: 'crossroads',
    brief:
      'Four waves will try to force the junction. Hold the crossing and keep the highway closed.',
    objectiveLabel: 'Survive four waves',
    bots: 4,
    recommended: 'veteran',
    objective: 'survival',
    waves: 4,
  },
  {
    id: 'l8',
    index: 7,
    name: 'The Warden',
    mapId: 'compound',
    brief:
      'The Warden commands the industrial compound from behind two gates. Break the gates and end the garrison.',
    objectiveLabel: 'Destroy the Warden',
    bots: 4,
    recommended: 'veteran',
    objective: 'elimination',
    bossId: 'warden',
  },
  {
    id: 'l9',
    index: 8,
    name: 'Operation Flagfall',
    mapId: 'frontier',
    brief:
      'The frontier has become a fortress maze. Follow the switchbacks, check every dead end and blast the crate barricades. Take their flag and bring it home in one piece.',
    objectiveLabel: 'Capture the enemy flag',
    bots: 4,
    recommended: 'veteran',
    objective: 'ctf',
  },
  {
    id: 'l10',
    index: 9,
    name: 'The Last Citadel',
    mapId: 'citadel',
    brief:
      'The Sovereign is waiting at the end of the long approach. This is the last operation. Finish it.',
    objectiveLabel: 'Destroy the Sovereign',
    bots: 6,
    recommended: 'veteran',
    objective: 'elimination',
    bossId: 'sovereign',
  },
]

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(
  CAMPAIGN.map((level) => [level.id, level]),
)

export function getLevel(id: string): LevelDef | undefined {
  return LEVEL_BY_ID[id]
}
