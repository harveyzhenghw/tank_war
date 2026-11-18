import { describe, expect, it } from 'vitest'
import { Game } from '../src/engine/game'
import type { MatchResult } from '../src/engine/api'
import { killTank } from '../src/engine/systems/damage'
import type { Tank } from '../src/engine/types'

const STEP = 1 / 60

function advance(game: Game, seconds: number): void {
  const steps = Math.ceil(seconds / STEP)
  for (let i = 0; i < steps; i++) game.update(STEP)
}

function players(game: Game): Tank[] {
  return game.world.tanks.filter((tank) => tank.playerIndex !== null)
}

describe('versus', () => {
  it('spawns two players and no bots', () => {
    const game = new Game({
      mode: 'versus',
      mapId: 'foundry',
      objective: 'versus',
      difficulty: 'normal',
      players: 2,
      botCount: 0,
      seed: 5,
    })
    expect(players(game)).toHaveLength(2)
    expect(game.world.tanks.some((tank) => tank.isBot)).toBe(false)
    expect(players(game)[0].name).toBe('P1')
    expect(players(game)[1].name).toBe('P2')
  })

  it('ends in victory when player two is destroyed', () => {
    const game = new Game({
      mode: 'versus',
      mapId: 'foundry',
      objective: 'versus',
      difficulty: 'normal',
      players: 2,
      botCount: 0,
      seed: 5,
    })
    let result: MatchResult | null = null
    game.onEnd = (value) => {
      result = value
    }

    advance(game, 3.2)
    const [p1, p2] = players(game)
    killTank(game.world, p2, p1)
    expect(game.finished).toBe(false)

    advance(game, 2)
    expect(result).not.toBeNull()
    expect(result!.victory).toBe(true)
    expect(result!.detail).toContain('P1')
    expect(result!.players).toHaveLength(2)
    expect(game.finished).toBe(true)
  })

  it('ends in defeat when player one is destroyed', () => {
    const game = new Game({
      mode: 'versus',
      mapId: 'foundry',
      objective: 'versus',
      difficulty: 'normal',
      players: 2,
      botCount: 0,
      seed: 6,
    })
    let result: MatchResult | null = null
    game.onEnd = (value) => {
      result = value
    }

    advance(game, 3.2)
    const [p1, p2] = players(game)
    killTank(game.world, p1, p2)
    advance(game, 2)

    expect(result).not.toBeNull()
    expect(result!.victory).toBe(false)
    expect(result!.detail).toContain('P2')
  })
})

describe('capture', () => {
  it('fills the zone and wins while unopposed', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'compound',
      objective: 'capture',
      difficulty: 'easy',
      players: 1,
      botCount: 0,
      captureSeconds: 4,
      seed: 12,
    })
    let result: MatchResult | null = null
    game.onEnd = (value) => {
      result = value
    }

    advance(game, 3.2)
    const zone = game.world.zone!
    const player = players(game)[0]
    player.x = zone.x + zone.w / 2
    player.y = zone.y + zone.h / 2
    player.spawnProtection = 0

    advance(game, 2)
    expect(game.world.zone!.progress).toBeGreaterThan(0.2)
    expect(game.world.zone!.progress).toBeLessThan(1)
    expect(zone.contested).toBe(false)

    advance(game, 6)
    expect(result).not.toBeNull()
    expect(result!.victory).toBe(true)
    expect(result!.detail).toBe('Yard secured')
  })

  it('pauses progress while an enemy contests the zone', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'compound',
      objective: 'capture',
      difficulty: 'easy',
      players: 1,
      botCount: 1,
      captureSeconds: 8,
      seed: 13,
    })

    advance(game, 3.2)
    const zone = game.world.zone!
    const player = players(game)[0]
    player.x = zone.x + zone.w / 2
    player.y = zone.y + zone.h / 2
    player.spawnProtection = 0

    const bot = game.world.tanks.find((tank) => tank.isBot)!
    bot.x = zone.x + 30
    bot.y = zone.y + 30
    bot.ai = null
    bot.spawnProtection = 0

    advance(game, 1.5)
    expect(zone.contested).toBe(true)
    expect(zone.progress).toBe(0)
  })
})

describe('deathmatch', () => {
  it('respawns destroyed bots after the delay', () => {
    const game = new Game({
      mode: 'skirmish',
      mapId: 'dunes',
      objective: 'deathmatch',
      difficulty: 'easy',
      players: 1,
      botCount: 1,
      targetKills: 5,
      seed: 21,
    })
    advance(game, 3.2)

    const player = players(game)[0]
    const bot = game.world.tanks.find((tank) => tank.isBot)!
    killTank(game.world, bot, player)
    expect(bot.alive).toBe(false)
    expect(bot.respawnAt).not.toBeNull()

    advance(game, 1)
    expect(bot.alive).toBe(false)
    advance(game, 2.5)
    expect(bot.alive).toBe(true)
    expect(bot.hp).toBe(bot.maxHp)
  })

  it('ends as soon as the kill target is reached', () => {
    const game = new Game({
      mode: 'skirmish',
      mapId: 'dunes',
      objective: 'deathmatch',
      difficulty: 'easy',
      players: 1,
      botCount: 1,
      targetKills: 3,
      seed: 22,
    })
    let result: MatchResult | null = null
    game.onEnd = (value) => {
      result = value
    }

    advance(game, 3.2)
    const player = players(game)[0]
    const bot = game.world.tanks.find((tank) => tank.isBot)!
    // Credit three kills directly; the objective only reads counters.
    player.kills = 3
    expect(bot.alive).toBe(true)

    advance(game, 2)
    expect(result).not.toBeNull()
    expect(result!.victory).toBe(true)
    expect(result!.detail).toContain('3 kills')
  })
})

describe('survival', () => {
  it('waits between waves and then spawns the next one', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'foundry',
      objective: 'survival',
      difficulty: 'easy',
      players: 1,
      botCount: 1,
      waves: 2,
      seed: 41,
    })
    advance(game, 3.2)
    const player = players(game)[0]
    const firstWave = game.world.tanks.filter((tank) => tank.isBot)
    expect(firstWave).toHaveLength(1)

    killTank(game.world, firstWave[0], player)
    advance(game, 1)
    expect(game.world.wave).toBe(1)
    expect(game.world.tanks.filter((tank) => tank.isBot && tank.alive)).toHaveLength(0)

    advance(game, 3)
    expect(game.world.wave).toBe(2)
    expect(game.world.tanks.filter((tank) => tank.isBot && tank.alive)).toHaveLength(1)
  })
})

describe('hud snapshots', () => {
  it('reports weapons, objectives and finite progress', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'foundry',
      objective: 'elimination',
      difficulty: 'normal',
      players: 1,
      botCount: 2,
      seed: 31,
    })
    const hud = game.getHud()
    expect(hud.players).toHaveLength(1)
    expect(hud.objective).toBe('elimination')
    expect(hud.progress).toBeGreaterThanOrEqual(0)
    expect(hud.progress).toBeLessThanOrEqual(1)
    expect(hud.enemies).toBe(2)
    expect(hud.wavesTotal).toBe(1)

    const weapons = hud.players[0].weapons
    expect(weapons.map((weapon) => weapon.id)).toEqual([
      'cannon',
      'mg',
      'rocket',
      'spread',
      'rail',
      'plasma',
      'flame',
    ])
    expect(weapons.find((weapon) => weapon.id === 'cannon')!.ammo).toBeNull()
    expect(weapons.find((weapon) => weapon.id === 'mg')!.ammo).toBeGreaterThan(0)
    expect(hud.coins).toBe(0)
  })

  it('honours a restricted loadout and reports its weapons', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'foundry',
      objective: 'elimination',
      difficulty: 'normal',
      players: 1,
      botCount: 1,
      seed: 33,
      loadout: {
        weapons: ['cannon', 'mg'],
        skin: 'desert',
        boosters: ['hull', 'shield'],
      },
    })
    const hud = game.getHud()
    expect(hud.players[0].weapons.map((weapon) => weapon.id)).toEqual(['cannon', 'mg'])
    const player = game.world.tanks.find((tank) => tank.playerIndex === 0)!
    expect(player.skin).toBe('desert')
    expect(player.maxHp).toBe(130)
    expect(player.shield).toBe(8)
  })

  it('counts down before combat starts', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'foundry',
      objective: 'elimination',
      difficulty: 'normal',
      players: 1,
      botCount: 1,
      seed: 32,
    })
    expect(game.getHud().countdown).toBeGreaterThan(0)
    advance(game, 2)
    expect(game.getHud().countdown).toBeGreaterThan(0)
    expect(game.world.time).toBe(0)
    advance(game, 1.5)
    expect(game.getHud().countdown).toBe(0)
    expect(game.world.time).toBeGreaterThan(0)
  })
})

describe('long-running simulation', () => {
  it('keeps every entity finite during an idle elimination match', () => {
    const game = new Game({
      mode: 'campaign',
      mapId: 'foundry',
      objective: 'elimination',
      difficulty: 'hard',
      players: 1,
      botCount: 3,
      seed: 77,
    })

    for (let i = 0; i < 60 * 40; i++) {
      game.update(STEP)
      if (game.finished) break
    }

    const world = game.world
    expect(Number.isFinite(world.time)).toBe(true)
    expect(Number.isFinite(world.score)).toBe(true)
    for (const tank of world.tanks) {
      expect(Number.isFinite(tank.x)).toBe(true)
      expect(Number.isFinite(tank.y)).toBe(true)
      expect(Number.isFinite(tank.hp)).toBe(true)
      expect(tank.hp).toBeGreaterThanOrEqual(0)
      expect(tank.x).toBeGreaterThanOrEqual(0)
      expect(tank.x).toBeLessThanOrEqual(world.bounds.w)
      expect(tank.y).toBeGreaterThanOrEqual(0)
      expect(tank.y).toBeLessThanOrEqual(world.bounds.h)
    }
    for (const projectile of world.projectiles) {
      expect(Number.isFinite(projectile.x)).toBe(true)
      expect(Number.isFinite(projectile.y)).toBe(true)
    }
    expect(['playing', 'won', 'lost']).toContain(world.status)
  })
})