import { clamp } from '../engine/math'
import type {
  BulletState,
  MatchPhase,
  MatchState,
  PlayerInput,
  Role,
  RoundWins,
  TankState,
} from './simulation'
import { ARENA_HEIGHT, ARENA_WIDTH } from './map'

export const PROTOCOL_VERSION = 1

export interface HelloMessage {
  t: 'hello'
  v: typeof PROTOCOL_VERSION
  role: Role
}

export interface InputMessage extends PlayerInput {
  t: 'input'
  v: typeof PROTOCOL_VERSION
}

export interface SnapshotMessage {
  t: 'snap'
  v: typeof PROTOCOL_VERSION
  tick: number
  ack: number
  phase: MatchPhase
  countdown: number
  winner: Role | null
  wins: RoundWins
  host: TankState
  client: TankState
  bullets: BulletState[]
}

export interface RematchMessage {
  t: 'rematch'
  v: typeof PROTOCOL_VERSION
}

export interface LeaveMessage {
  t: 'leave'
  v: typeof PROTOCOL_VERSION
}

export interface PingMessage {
  t: 'ping'
  v: typeof PROTOCOL_VERSION
  id: number
}

export interface PongMessage {
  t: 'pong'
  v: typeof PROTOCOL_VERSION
  id: number
}

export type NetMessage =
  | HelloMessage
  | InputMessage
  | SnapshotMessage
  | RematchMessage
  | LeaveMessage
  | PingMessage
  | PongMessage

export function serializeSnapshot(state: MatchState, ack: number): SnapshotMessage {
  return {
    t: 'snap',
    v: PROTOCOL_VERSION,
    tick: state.tick,
    ack,
    phase: state.phase,
    countdown: state.countdown,
    winner: state.winner,
    wins: { ...state.wins },
    host: { ...state.host },
    client: { ...state.client },
    bullets: state.bullets.map((bullet) => ({ ...bullet })),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRole = (value: unknown): value is Role => value === 'host' || value === 'client'

const isPhase = (value: unknown): value is MatchPhase =>
  value === 'countdown' || value === 'playing' || value === 'roundOver'

const isBool = (value: unknown): value is boolean => typeof value === 'boolean'

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const inRange = (value: unknown, min: number, max: number): value is number =>
  finite(value) && value >= min && value <= max

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

const angle = (value: unknown): value is number =>
  finite(value) && value >= -Math.PI * 8 && value <= Math.PI * 8

function parseTank(value: unknown): TankState | null {
  if (!isRecord(value)) return null
  if (
    !inRange(value.x, -20, ARENA_WIDTH + 20) ||
    !inRange(value.y, -20, ARENA_HEIGHT + 20) ||
    !angle(value.bodyAngle) ||
    !angle(value.turretAngle) ||
    !inRange(value.hp, 0, 1000) ||
    !isBool(value.alive) ||
    !inRange(value.cooldown, 0, 10) ||
    !inRange(value.muzzle, 0, 1) ||
    !inRange(value.hitFlash, 0, 1)
  ) {
    return null
  }
  return {
    x: value.x,
    y: value.y,
    bodyAngle: value.bodyAngle,
    turretAngle: value.turretAngle,
    hp: value.hp,
    alive: value.alive,
    cooldown: value.cooldown,
    muzzle: value.muzzle,
    hitFlash: value.hitFlash,
  }
}

function parseBullet(value: unknown): BulletState | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.id.length < 1 ||
    value.id.length > 64 ||
    !isRole(value.owner) ||
    !inRange(value.x, -50, ARENA_WIDTH + 50) ||
    !inRange(value.y, -50, ARENA_HEIGHT + 50) ||
    !inRange(value.vx, -2000, 2000) ||
    !inRange(value.vy, -2000, 2000) ||
    !inRange(value.life, 0, 10)
  ) {
    return null
  }
  return {
    id: value.id,
    owner: value.owner,
    x: value.x,
    y: value.y,
    vx: value.vx,
    vy: value.vy,
    life: value.life,
  }
}

function parseWins(value: unknown): RoundWins | null {
  if (!isRecord(value)) return null
  if (!integer(value.host, 0, 9999) || !integer(value.client, 0, 9999)) return null
  return { host: value.host, client: value.client }
}

function parseSnapshot(msg: Record<string, unknown>): SnapshotMessage | null {
  if (
    !integer(msg.tick, 0, Number.MAX_SAFE_INTEGER) ||
    !integer(msg.ack, 0, Number.MAX_SAFE_INTEGER) ||
    !isPhase(msg.phase) ||
    !inRange(msg.countdown, 0, 10) ||
    !(msg.winner === null || isRole(msg.winner))
  ) {
    return null
  }
  const wins = parseWins(msg.wins)
  const host = parseTank(msg.host)
  const client = parseTank(msg.client)
  if (!wins || !host || !client || !Array.isArray(msg.bullets) || msg.bullets.length > 96) {
    return null
  }
  const bullets: BulletState[] = []
  for (const item of msg.bullets) {
    const bullet = parseBullet(item)
    if (!bullet) return null
    bullets.push(bullet)
  }
  return {
    t: 'snap',
    v: PROTOCOL_VERSION,
    tick: msg.tick,
    ack: msg.ack,
    phase: msg.phase,
    countdown: msg.countdown,
    winner: msg.winner,
    wins,
    host,
    client,
    bullets,
  }
}

function parseInput(msg: Record<string, unknown>): InputMessage | null {
  if (
    !integer(msg.seq, 0, Number.MAX_SAFE_INTEGER) ||
    !isBool(msg.up) ||
    !isBool(msg.down) ||
    !isBool(msg.left) ||
    !isBool(msg.right) ||
    !isBool(msg.fire) ||
    !finite(msg.aimX) ||
    !finite(msg.aimY)
  ) {
    return null
  }
  return {
    t: 'input',
    v: PROTOCOL_VERSION,
    seq: msg.seq,
    up: msg.up,
    down: msg.down,
    left: msg.left,
    right: msg.right,
    fire: msg.fire,
    aimX: clamp(msg.aimX, -100, ARENA_WIDTH + 100),
    aimY: clamp(msg.aimY, -100, ARENA_HEIGHT + 100),
  }
}

/** Parse and validate an untrusted PeerJS payload. */
export function parseNetMessage(raw: unknown): NetMessage | null {
  let payload: unknown = raw
  if (typeof raw === 'string') {
    if (raw.length > 64_000) return null
    try {
      payload = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(payload)) return null
  if (payload.v !== PROTOCOL_VERSION) return null

  switch (payload.t) {
    case 'hello':
      if (!isRole(payload.role)) return null
      return { t: 'hello', v: PROTOCOL_VERSION, role: payload.role }
    case 'input':
      return parseInput(payload)
    case 'snap':
      return parseSnapshot(payload)
    case 'rematch':
      return { t: 'rematch', v: PROTOCOL_VERSION }
    case 'leave':
      return { t: 'leave', v: PROTOCOL_VERSION }
    case 'ping':
      return integer(payload.id, 0, Number.MAX_SAFE_INTEGER)
        ? { t: 'ping', v: PROTOCOL_VERSION, id: payload.id }
        : null
    case 'pong':
      return integer(payload.id, 0, Number.MAX_SAFE_INTEGER)
        ? { t: 'pong', v: PROTOCOL_VERSION, id: payload.id }
        : null
    default:
      return null
  }
}
