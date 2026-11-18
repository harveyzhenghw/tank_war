import { describe, expect, it } from 'vitest'
import { getMap } from '../src/data/maps'
import { DIFFICULTY } from '../src/data/balance'
import { createWorld, spawnBot, spawnPlayer } from '../src/engine/world'
import { chooseWeapon, pickTarget } from '../src/engine/ai'
import type { Obstacle, Tank, World } from '../src/engine/types'

function makeWorld(): World {
  return createWorld(getMap('dunes'), {
    objective: 'elimination',
    difficulty: 'normal',
    seed: 99,
    waves: 1,
    captureSeconds: 20,
  })
}

function addPlayer(world: World, index = 0): Tank {
  const tank = spawnPlayer(world, index, world.map.playerSpawns[index] ?? world.map.playerSpawns[0])
  tank.spawnProtection = 0
  return tank
}

function addBot(world: World, x: number, y: number): Tank {
  const bot = spawnBot(world, 'normal', { x, y }, DIFFICULTY.normal, 0)
  bot.spawnProtection = 0
  return bot
}

function clearCover(world: World, extra: Obstacle[] = []): void {
  world.obstacles = extra
  world.grid.rebuild(world.obstacles)
}

describe('pickTarget', () => {
  it('ignores allies and destroyed tanks', () => {
    const world = makeWorld()
    clearCover(world)
    const bot = addBot(world, 200, 300)
    const ally = addBot(world, 220, 300)
    const deadEnemy = addPlayer(world, 0)
    deadEnemy.x = 240
    deadEnemy.y = 300
    deadEnemy.alive = false
    expect(pickTarget(world, bot)).toBeNull()
    expect(pickTarget(world, ally)).toBeNull()
  })

  it('picks the nearest visible enemy', () => {
    const world = makeWorld()
    clearCover(world)
    const bot = addBot(world, 200, 300)
    const near = addPlayer(world, 0)
    near.x = 300
    near.y = 300
    const far = addPlayer(world, 1)
    far.team = 0
    far.x = 500
    far.y = 300
    expect(pickTarget(world, bot)?.id).toBe(near.id)
  })

  it('prefers a visible enemy over a closer blocked one', () => {
    const world = makeWorld()
    clearCover(world, [
      {
        id: 900,
        kind: 'wall',
        x: 180,
        y: 0,
        w: 20,
        h: 640,
        hp: Number.POSITIVE_INFINITY,
        maxHp: Number.POSITIVE_INFINITY,
        alive: true,
        tone: 0.5,
      },
    ])
    const bot = addBot(world, 100, 100)
    const blocked = addPlayer(world, 0)
    blocked.x = 250
    blocked.y = 100
    const visible = addPlayer(world, 1)
    visible.team = 0
    visible.x = 100
    visible.y = 320

    // Blocked at 150 away scores 360 after the line-of-sight penalty;
    // visible at 220 away scores 220.
    expect(pickTarget(world, bot)?.id).toBe(visible.id)

    // Push the visible tank past 360 away so the blocked player wins.
    visible.y = 480
    expect(pickTarget(world, bot)?.id).toBe(blocked.id)
  })

  it('weights players more heavily than bots at equal distance', () => {
    const world = makeWorld()
    clearCover(world)
    const bot = addBot(world, 300, 300)
    const player = addPlayer(world, 0)
    player.x = 300
    player.y = 500
    const enemyBot = addBot(world, 140, 300)
    expect(pickTarget(world, bot)?.id).toBe(player.id)
    expect(pickTarget(world, enemyBot)).not.toBeNull()
  })
})

describe('chooseWeapon', () => {
  function tankWith(ammo: Partial<Record<'mg' | 'rocket' | 'spread', number>>, cooldown = 0): Tank {
    const world = makeWorld()
    const tank = addPlayer(world)
    tank.ammo = {
      cannon: Number.POSITIVE_INFINITY,
      mg: ammo.mg ?? 0,
      rocket: ammo.rocket ?? 0,
      spread: ammo.spread ?? 0,
    }
    tank.cooldown = cooldown
    return tank
  }

  it('always falls back to the cannon without line of sight', () => {
    const tank = tankWith({ mg: 300, rocket: 4, spread: 20 })
    expect(chooseWeapon(tank, 100, false)).toBe('cannon')
    expect(chooseWeapon(tank, 600, false)).toBe('cannon')
  })

  it('uses scatter at close range', () => {
    const tank = tankWith({ spread: 20 })
    expect(chooseWeapon(tank, 120, true)).toBe('spread')
    expect(chooseWeapon(tank, 176, true)).toBe('cannon')
  })

  it('uses rockets at long range', () => {
    const tank = tankWith({ rocket: 4 })
    expect(chooseWeapon(tank, 500, true)).toBe('rocket')
    expect(chooseWeapon(tank, 340, true)).not.toBe('rocket')
  })

  it('switches to the machine gun mid-range while reloading', () => {
    const tank = tankWith({ mg: 200 }, 0.5)
    expect(chooseWeapon(tank, 300, true)).toBe('mg')
    const ready = tankWith({ mg: 200 }, 0)
    expect(chooseWeapon(ready, 300, true)).toBe('cannon')
  })

  it('respects empty ammo', () => {
    const tank = tankWith({})
    expect(chooseWeapon(tank, 120, true)).toBe('cannon')
    expect(chooseWeapon(tank, 500, true)).toBe('cannon')
  })
})