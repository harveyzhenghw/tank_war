import { describe, expect, it } from 'vitest'
import { getMap } from '../src/data/maps'
import { DIFFICULTY } from '../src/data/balance'
import { createWorld, spawnBot, spawnPlayer } from '../src/engine/world'
import {
  damageTank,
  isEnemy,
  killTank,
  splashDamage,
} from '../src/engine/systems/damage'
import type { Tank, World } from '../src/engine/types'

function makeWorld(): World {
  return createWorld(getMap('dunes'), {
    objective: 'elimination',
    difficulty: 'normal',
    seed: 42,
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

describe('damageTank', () => {
  it('ignores damage while spawn protection is active', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    player.spawnProtection = 1
    const before = player.hp
    expect(damageTank(world, player, 50, null)).toBe(0)
    expect(player.hp).toBe(before)
  })

  it('mitigates damage with armour', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    player.armor = 0.2
    const dealt = damageTank(world, player, 100, null)
    expect(dealt).toBeCloseTo(80, 5)
    expect(player.hp).toBeCloseTo(player.maxHp - 80, 5)
  })

  it('applies the shield reduction before armour', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    player.armor = 0
    player.shield = 5
    const dealt = damageTank(world, player, 100, null)
    expect(dealt).toBeCloseTo(45, 5)
  })

  it('stacks plating pickups onto base armour but caps mitigation', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    player.armor = 0.6
    player.armorBoost = 5
    const dealt = damageTank(world, player, 100, null)
    // 0.6 + 0.18 clamps to the 0.7 mitigation ceiling.
    expect(dealt).toBeCloseTo(30, 5)
  })

  it('always deals at least one point of damage', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    player.armor = 0.7
    expect(damageTank(world, player, 0.5, null)).toBeGreaterThanOrEqual(1)
  })

  it('credits kills and score to player attackers', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    const bot = addBot(world, 500, 500)
    const scoreBefore = world.score

    damageTank(world, bot, 10_000, player)

    expect(bot.alive).toBe(false)
    expect(bot.deaths).toBe(1)
    expect(player.kills).toBe(1)
    expect(world.kills).toBe(1)
    expect(world.deaths).toBe(1)
    expect(world.score).toBe(scoreBefore + 100)
    expect(world.coinsEarned).toBe(10)
  })

  it('does not award score when a bot kills the player', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    const bot = addBot(world, 500, 500)
    const scoreBefore = world.score

    damageTank(world, player, 10_000, bot)

    expect(player.alive).toBe(false)
    expect(bot.kills).toBe(1)
    expect(world.kills).toBe(0)
    expect(world.score).toBe(scoreBefore)
    expect(world.coinsEarned).toBe(0)
    expect(world.hitFlash).toBeGreaterThan(0)
  })

  it('only gives score for enemy kills, not friendly fire', () => {
    const world = makeWorld()
    const p1 = addPlayer(world, 0)
    const p2 = addPlayer(world, 1)
    const scoreBefore = world.score

    damageTank(world, p2, 10_000, p1)

    expect(p2.alive).toBe(false)
    expect(p1.kills).toBe(1)
    expect(world.score).toBe(scoreBefore + 150)
    expect(world.coinsEarned).toBe(0)
  })

  it('sets a respawn timer only when respawns are enabled', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    const bot = addBot(world, 500, 500)
    killTank(world, bot, player)
    expect(bot.respawnAt).toBeNull()

    world.respawn = true
    world.respawnDelay = 2
    const other = addBot(world, 520, 500)
    killTank(world, other, player)
    expect(other.respawnAt).toBeCloseTo(world.time + 2, 5)
  })
})

describe('splashDamage', () => {
  it('falls off with distance and has a damage floor', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    const near = addBot(world, 300, 300)
    const far = addBot(world, 370, 300)

    splashDamage(world, 300, 300, 76, 100, 0, player)

    const nearDealt = near.maxHp - near.hp
    const farDealt = far.maxHp - far.hp
    expect(nearDealt).toBeGreaterThan(farDealt)
    // 0.35 * 100 damages minus 6% armour.
    expect(farDealt).toBeCloseTo(32.9, 4)
  })

  it('never hurts allies or the excluded tank', () => {
    const world = makeWorld()
    const player = addPlayer(world)
    const ally = addPlayer(world, 1)
    const enemy = addBot(world, 400, 400)

    splashDamage(world, 400, 400, 90, 60, 0, player)
    expect(enemy.hp).toBeLessThan(enemy.maxHp)
    const allyHp = ally.hp
    const playerHp = player.hp

    splashDamage(world, 400, 400, 90, 60, 1, null, enemy.id)
    expect(allyHp).toBe(ally.hp)
    expect(playerHp).toBe(player.hp)
  })

  it('damages and eventually destroys crates but not walls', () => {
    const world = makeWorld()
    const crate = world.obstacles.find((o) => o.kind === 'crate')
    const wall = world.obstacles.find((o) => o.kind === 'wall')
    expect(crate).toBeDefined()
    expect(wall).toBeDefined()

    const cx = crate!.x + crate!.w / 2
    const cy = crate!.y + crate!.h / 2
    splashDamage(world, cx, cy, 40, 20, 0, null)
    expect(crate!.hp).toBeLessThan(crate!.maxHp)

    splashDamage(world, cx, cy, 40, 100, 0, null)
    expect(crate!.alive).toBe(false)
    expect(world.obstacles.includes(crate!)).toBe(true)
    expect(world.grid.queryRect(crate!).includes(crate!)).toBe(false)

    splashDamage(world, wall!.x + wall!.w / 2, wall!.y + wall!.h / 2, 50, 500, 0, null)
    expect(wall!.alive).toBe(true)
  })
})

describe('isEnemy', () => {
  it('uses team assignment rather than player index', () => {
    const world = makeWorld()
    const blue = addPlayer(world, 0)
    const amber = addPlayer(world, 1)
    const red = addBot(world, 200, 200)
    expect(isEnemy(blue, red)).toBe(true)
    expect(isEnemy(blue, amber)).toBe(true)
    expect(isEnemy(red, red)).toBe(false)
  })
})