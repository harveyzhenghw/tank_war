import type {
  HudSnapshot,
  MatchOptions,
  MatchResult,
  PlayerHud,
  ResolvedMatchOptions,
  WeaponHud,
} from './api'
import type { PlayerControls, SfxName, Tank, World } from './types'
import { EMPTY_CONTROLS } from './types'
import { getMap } from '../data/maps'
import { DIFFICULTY } from '../data/balance'
import { WEAPON_ORDER } from '../data/weapons'
import {
  addPickup,
  createWorld,
  isPointFree,
  pickBotSpawn,
  randomPickupKind,
  resetTank,
  spawnBot,
  spawnPlayer,
} from './world'
import { applyControls, tickTank } from './systems/movement'
import { updateFiring } from './systems/weapons'
import { stepTanks } from './systems/collision'
import { updateProjectiles } from './systems/projectiles'
import { updatePickups } from './systems/pickups'
import { ring, updateParticles } from './systems/particles'
import { sampleBot } from './ai'
import { pointInRect } from './math'

function resolveOptions(options: MatchOptions): ResolvedMatchOptions {
  return {
    mode: options.mode,
    mapId: options.mapId,
    levelId: options.levelId,
    objective: options.objective,
    difficulty: options.difficulty,
    botCount: options.botCount ?? 3,
    waves: options.waves ?? 1,
    captureSeconds: options.captureSeconds ?? 20,
    targetKills: options.targetKills ?? 10,
    players: options.players ?? 1,
    seed: options.seed ?? Math.floor(Math.random() * 1e9),
  }
}

export class Game {
  readonly world: World
  readonly options: ResolvedMatchOptions
  paused = false
  finished = false
  onHud: ((hud: HudSnapshot) => void) | null = null
  onEnd: ((result: MatchResult) => void) | null = null
  onSfx: ((name: SfxName) => void) | null = null

  private controls = new Map<number, PlayerControls>()
  private hudTimer = 0
  private pendingResult: MatchResult | null = null
  private endDelay = 0
  private botCounter = 0
  private initialEnemies = 0

  constructor(options: MatchOptions) {
    this.options = resolveOptions(options)
    const map = getMap(this.options.mapId)

    this.world = createWorld(map, {
      objective: this.options.objective,
      difficulty: this.options.difficulty,
      seed: this.options.seed,
      waves: this.options.waves,
      captureSeconds: this.options.captureSeconds,
    })

    if (this.options.objective === 'deathmatch') {
      this.world.respawn = true
      this.world.respawnDelay = 2.5
      this.world.respawnPlayers = true
    } else if (this.options.objective === 'capture') {
      this.world.respawn = true
      this.world.respawnDelay = 7
      this.world.respawnPlayers = false
    }

    this.setupMatch()
  }

  private setupMatch(): void {
    const w = this.world
    const spawns = w.map.playerSpawns

    spawnPlayer(w, 0, spawns[0])
    if (this.options.players === 2) {
      spawnPlayer(w, 1, spawns[1] ?? spawns[0])
    }

    if (this.options.objective !== 'versus') {
      this.spawnBots(this.options.botCount)
    }

    // Guarantee one repair and one ammo crate so every arena opens with recoverable resources.
    const guaranteed = ['health', 'ammo'] as const
    w.map.pickupPoints.forEach((point, index) => {
      const kind = guaranteed[index] ?? randomPickupKind(w)
      addPickup(w, kind, point.x, point.y)
    })

    this.initialEnemies = w.tanks.filter((t) => t.isBot).length

    if (w.objective === 'capture') {
      w.message = 'CAPTURE THE YARD'
      w.messageTimer = 3
    } else if (w.objective === 'survival') {
      w.message = 'WAVE 1'
      w.messageTimer = 2.5
    } else if (w.objective === 'versus') {
      w.message = 'LAST TANK STANDING'
      w.messageTimer = 2.5
    }
  }

  private spawnBots(count: number): void {
    const w = this.world
    const profile = DIFFICULTY[this.options.difficulty]
    for (let i = 0; i < count; i++) {
      const point = pickBotSpawn(w)
      spawnBot(w, this.options.difficulty, point, profile, this.botCounter++)
    }
  }

  setControls(index: number, controls: PlayerControls): void {
    this.controls.set(index, controls)
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.emitHud()
  }

  update(dtRaw: number): void {
    if (this.paused || this.finished) return
    const w = this.world
    const dt = Math.min(0.05, Math.max(0, dtRaw))

    w.shake = Math.max(0, w.shake - dt * 24)
    w.hitFlash = Math.max(0, w.hitFlash - dt * 1.6)
    w.messageTimer = Math.max(0, w.messageTimer - dt)
    if (w.messageTimer === 0) w.message = ''

    if (w.countdown > 0) {
      w.countdown = Math.max(0, w.countdown - dt)
      if (w.countdown === 0) {
        w.message = 'ENGAGE'
        w.messageTimer = 1
      }
      updateParticles(w, dt)
      this.emitHudMaybe(dt)
      return
    }

    w.time += dt

    for (const tank of w.tanks) {
      if (!tank.alive) {
        tickTank(tank, dt)
        continue
      }
      const controls =
        tank.playerIndex !== null
          ? this.controls.get(tank.playerIndex) ?? EMPTY_CONTROLS
          : sampleBot(w, tank, dt)
      applyControls(w, tank, controls, dt)
      if (controls.fire) updateFiring(w, tank, controls)
    }

    stepTanks(w, dt)
    updateProjectiles(w, dt)
    updatePickups(w, dt)
    updateParticles(w, dt)
    this.updatePickupSpawner(dt)
    this.updateMode(dt)
    this.updateRespawns()
    this.updatePendingEnd(dt)
    this.emitSfx()
    this.emitHudMaybe(dt)
  }

  private updateMode(dt: number): void {
    const w = this.world
    if (this.pendingResult) return

    const players = w.tanks.filter((t) => t.playerIndex !== null)
    const alivePlayers = players.filter((t) => t.alive)
    const enemies = w.tanks.filter((t) => t.isBot && t.alive)

    if (w.objective !== 'deathmatch' && players.length > 0 && alivePlayers.length === 0) {
      this.finish(false, 'Your tank was destroyed')
      return
    }

    switch (w.objective) {
      case 'elimination': {
        if (enemies.length === 0) this.finish(true, 'All hostiles destroyed')
        break
      }
      case 'survival': {
        if (enemies.length === 0) {
          if (w.wave >= w.wavesTotal) {
            this.finish(true, 'All waves repelled')
          } else {
            w.waveTimer -= dt
            if (w.waveTimer <= 0) {
              w.wave += 1
              this.spawnBots(this.options.botCount)
              w.waveTimer = 3
              w.message = `WAVE ${w.wave} INCOMING`
              w.messageTimer = 2.2
              w.events.push('wave')
            }
          }
        } else {
          w.waveTimer = 3
        }
        break
      }
      case 'capture': {
        const zone = w.zone
        const player = players[0]
        if (!zone || !player) break
        const inZone = player.alive && pointInRect(player.x, player.y, zone)
        const enemyInside = enemies.some((e) => pointInRect(e.x, e.y, zone))
        zone.contested = Boolean(inZone && enemyInside)
        if (inZone && !enemyInside) {
          zone.progress = Math.min(1, zone.progress + dt / zone.duration)
        }
        if (zone.progress >= 1) {
          this.finish(true, 'Yard secured')
        }
        break
      }
      case 'deathmatch': {
        const player = players[0]
        const target = this.options.targetKills
        if (!player) break
        if (player.kills >= target) {
          this.finish(true, `${target} kills reached`)
        } else if (enemies.some((e) => e.kills >= target)) {
          this.finish(false, 'Hostiles reached the kill target')
        }
        break
      }
      case 'versus': {
        const [a, b] = players
        if (!a || !b) break
        if (!a.alive && !b.alive) this.finish(false, 'Mutual destruction')
        else if (!b.alive) this.finish(true, `${a.name} wins`)
        else if (!a.alive) this.finish(false, `${b.name} wins`)
        break
      }
    }
  }

  private updatePickupSpawner(dt: number): void {
    const w = this.world
    w.pickupTimer -= dt
    if (w.pickupTimer > 0) return
    w.pickupTimer = 9
    if (w.pickups.length >= 7) return

    const points = w.map.pickupPoints
    for (let attempt = 0; attempt < 6; attempt++) {
      const point = points[Math.floor(w.rng.next() * points.length)]
      if (!isPointFree(w, point.x, point.y, 22)) continue
      const occupied = w.pickups.some(
        (p) => Math.hypot(p.x - point.x, p.y - point.y) < 26,
      )
      if (occupied) continue
      addPickup(w, randomPickupKind(w), point.x, point.y)
      return
    }
  }

  private updateRespawns(): void {
    const w = this.world
    for (const tank of w.tanks) {
      if (tank.alive || tank.respawnAt === null || w.time < tank.respawnAt) continue
      const point =
        tank.playerIndex !== null
          ? w.map.playerSpawns[tank.playerIndex % w.map.playerSpawns.length]
          : pickBotSpawn(w, 200)
      resetTank(tank, point)
      ring(w, tank.x, tank.y, 34, tank.color, 0.5)
    }
  }

  private updatePendingEnd(dt: number): void {
    if (!this.pendingResult) return
    this.endDelay -= dt
    if (this.endDelay <= 0) {
      this.finished = true
      const result = this.pendingResult
      this.onEnd?.(result)
    }
  }

  private finish(victory: boolean, detail: string): void {
    if (this.pendingResult) return
    const w = this.world
    const players = w.tanks.filter((t) => t.playerIndex !== null)
    const timeBonus = victory ? Math.max(0, Math.round(400 - w.time * 3)) : 0
    const healthBonus = victory
      ? players.reduce((sum, p) => sum + Math.max(0, Math.round(p.hp)), 0)
      : 0

    w.status = victory ? 'won' : 'lost'
    w.victoryDetail = detail
    w.message = victory ? 'VICTORY' : 'DEFEAT'
    w.messageTimer = 3
    w.events.push(victory ? 'win' : 'lose')

    this.pendingResult = {
      victory,
      score: w.score + (victory ? 100 : 0) + timeBonus + healthBonus,
      kills: w.kills,
      deaths: players.reduce((sum, p) => sum + p.deaths, 0),
      time: w.time,
      levelId: this.options.levelId,
      mode: this.options.mode,
      detail,
      players: players.map((p) => ({
        name: p.name,
        color: p.color,
        kills: p.kills,
        deaths: p.deaths,
        alive: p.alive,
      })),
    }
    this.endDelay = 1.15
  }

  private detailText(): string {
    const w = this.world
    const enemies = w.tanks.filter((t) => t.isBot && t.alive).length
    switch (w.objective) {
      case 'elimination':
        return enemies === 0 ? 'Sector clear' : `${enemies} hostiles remaining`
      case 'survival':
        return `Wave ${w.wave} / ${w.wavesTotal} · ${enemies} hostiles`
      case 'capture': {
        const pct = Math.round((w.zone?.progress ?? 0) * 100)
        return w.zone?.contested ? `${pct}% · ZONE CONTESTED` : `${pct}% captured`
      }
      case 'deathmatch': {
        const player = w.tanks.find((t) => t.playerIndex === 0)
        return `${player?.kills ?? 0} / ${this.options.targetKills} kills`
      }
      case 'versus': {
        const a = w.tanks.find((t) => t.playerIndex === 0)
        const b = w.tanks.find((t) => t.playerIndex === 1)
        return `${a?.name ?? 'P1'} vs ${b?.name ?? 'P2'}`
      }
    }
  }

  private progress(): number {
    const w = this.world
    const enemies = w.tanks.filter((t) => t.isBot && t.alive).length
    switch (w.objective) {
      case 'elimination':
        return this.initialEnemies === 0
          ? 1
          : 1 - enemies / Math.max(1, this.initialEnemies)
      case 'survival': {
        const cleared = Math.max(0, w.wave - 1)
        const current = w.wave > 0 ? 1 - Math.min(1, enemies / Math.max(1, this.options.botCount)) : 1
        return Math.min(1, (cleared + current) / Math.max(1, w.wavesTotal))
      }
      case 'capture':
        return w.zone?.progress ?? 0
      case 'deathmatch': {
        const player = w.tanks.find((t) => t.playerIndex === 0)
        return Math.min(1, (player?.kills ?? 0) / Math.max(1, this.options.targetKills))
      }
      case 'versus':
        return 0
    }
  }

  private playerHud(tank: Tank): PlayerHud {
    const weapons: WeaponHud[] = WEAPON_ORDER.map((id) => ({
      id,
      ammo: Number.isFinite(tank.ammo[id]) ? tank.ammo[id] : null,
    }))
    return {
      index: tank.playerIndex ?? 0,
      name: tank.name,
      color: tank.color,
      hp: Math.max(0, Math.round(tank.hp)),
      maxHp: tank.maxHp,
      alive: tank.alive,
      weapon: tank.weapon,
      ammo: Number.isFinite(tank.ammo[tank.weapon]) ? tank.ammo[tank.weapon] : null,
      weapons,
      overdrive: tank.overdriveCooldown <= 0 ? 1 : 1 - tank.overdriveCooldown / 6.5,
      kills: tank.kills,
      shield: tank.shield > 0,
      damageBoost: tank.damageBoost > 0,
      speedBoost: tank.speedBoost > 0,
      armorBoost: tank.armorBoost > 0,
    }
  }

  getHud(): HudSnapshot {
    const w = this.world
    const players = w.tanks.filter((t) => t.playerIndex !== null)
    return {
      status: w.status,
      paused: this.paused,
      countdown: w.countdown,
      objective: w.objective,
      detail: this.detailText(),
      progress: Math.max(0, Math.min(1, this.progress())),
      time: w.time,
      enemies: w.tanks.filter((t) => t.isBot && t.alive).length,
      wave: w.wave,
      wavesTotal: w.wavesTotal,
      message: w.messageTimer > 0 && w.message !== '' ? w.message : null,
      players: players.map((p) => this.playerHud(p)),
      score: w.score,
      kills: w.kills,
    }
  }

  private emitHudMaybe(dt: number): void {
    this.hudTimer -= dt
    if (this.hudTimer > 0) return
    this.hudTimer = 0.1
    this.emitHud()
  }

  private emitHud(): void {
    this.onHud?.(this.getHud())
  }

  private emitSfx(): void {
    const w = this.world
    if (this.onSfx) {
      for (const event of w.events) this.onSfx(event)
    }
    w.events.length = 0
  }

  destroy(): void {
    this.onHud = null
    this.onEnd = null
    this.onSfx = null
    this.controls.clear()
    this.finished = true
  }
}