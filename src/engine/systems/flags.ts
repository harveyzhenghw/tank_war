import type { FlagState, World } from '../types'
import { FLAG_PICKUP_RADIUS, FLAG_RETURN_TIME } from '../../data/balance'
import { dist } from '../math'
import { hasLineOfSight } from '../world'

function makeFlag(team: number, x: number, y: number): FlagState {
  return {
    team,
    x,
    y,
    homeX: x,
    homeY: y,
    carriedBy: null,
    dropped: false,
    returnTimer: 0,
    revealed: team === 0,
  }
}

/** Place both flags at the homes defined by a CTF map. */
export function initFlags(world: World): void {
  const points = world.map.flagPoints
  if (!points) return
  world.flags = [makeFlag(0, points.player.x, points.player.y), makeFlag(1, points.enemy.x, points.enemy.y)]
}

export function isCarryingFlag(world: World, tankId: number): boolean {
  return world.flags.some((flag) => flag.carriedBy === tankId)
}

/** Drop a carried flag at the carrier's position and start its return timer. */
export function dropFlag(world: World, carrierId: number): void {
  const flag = world.flags.find((candidate) => candidate.carriedBy === carrierId)
  if (!flag) return
  const carrier = world.tanks.find((tank) => tank.id === carrierId)
  flag.carriedBy = null
  flag.dropped = true
  flag.returnTimer = FLAG_RETURN_TIME
  if (carrier) {
    flag.x = carrier.x
    flag.y = carrier.y
  }
  world.message = 'FLAG DROPPED'
  world.messageTimer = 1.6
}

function returnHome(world: World, flag: FlagState): void {
  flag.x = flag.homeX
  flag.y = flag.homeY
  flag.carriedBy = null
  flag.dropped = false
  flag.returnTimer = 0
  world.message = 'FLAG RETURNED'
  world.messageTimer = 1.4
}

/**
 * Advance flag pickups, drops, returns and captures.
 * Returns which side captured a flag this frame, if any.
 */
export function updateFlags(world: World, dt: number): 'player' | 'enemy' | null {
  if (world.flags.length === 0) return null

  let captured: 'player' | 'enemy' | null = null

  for (const flag of world.flags) {
    if (flag.carriedBy !== null) {
      const carrier = world.tanks.find((tank) => tank.id === flag.carriedBy)
      if (!carrier || !carrier.alive) {
        dropFlag(world, flag.carriedBy)
        continue
      }

      flag.x = carrier.x
      flag.y = carrier.y
      if (carrier.team === 0) flag.revealed = true

      const ownFlag = world.flags.find((candidate) => candidate.team === carrier.team)
      if (
        ownFlag &&
        ownFlag.carriedBy === null &&
        !ownFlag.dropped &&
        dist(carrier.x, carrier.y, ownFlag.homeX, ownFlag.homeY) <
          FLAG_PICKUP_RADIUS + carrier.radius
      ) {
        captured = carrier.team === 0 ? 'player' : 'enemy'
      }
      continue
    }

    if (flag.dropped) {
      flag.returnTimer = Math.max(0, flag.returnTimer - dt)
      if (flag.returnTimer === 0) {
        returnHome(world, flag)
        continue
      }
    }

    // An enemy tank picks up the flag when it drives over it.
    for (const tank of world.tanks) {
      if (!tank.alive || tank.team === flag.team) continue
      if (dist(tank.x, tank.y, flag.x, flag.y) < FLAG_PICKUP_RADIUS + tank.radius) {
        flag.carriedBy = tank.id
        flag.dropped = false
        flag.returnTimer = 0
        flag.x = tank.x
        flag.y = tank.y
        if (tank.playerIndex !== null) flag.revealed = true
        world.message = tank.playerIndex !== null ? 'ENEMY FLAG TAKEN' : 'YOUR FLAG TAKEN'
        world.messageTimer = 1.8
        break
      }
    }

    // The owning team recovers its own dropped flag by touching it.
    if (flag.dropped) {
      for (const tank of world.tanks) {
        if (!tank.alive || tank.team !== flag.team) continue
        if (dist(tank.x, tank.y, flag.x, flag.y) < FLAG_PICKUP_RADIUS + tank.radius) {
          returnHome(world, flag)
          break
        }
      }
    }

    // Enemy flag markers only appear once the player side spots them.
    if (flag.team === 1 && !flag.revealed) {
      for (const tank of world.tanks) {
        if (!tank.alive || tank.playerIndex === null) continue
        const range = dist(tank.x, tank.y, flag.x, flag.y)
        if (range < 430 || (range < 900 && hasLineOfSight(world, tank.x, tank.y, flag.x, flag.y))) {
          flag.revealed = true
          break
        }
      }
    }
  }

  return captured
}
