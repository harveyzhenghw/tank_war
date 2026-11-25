import { describe, expect, it } from 'vitest'
import {
  FIXED_STEP,
  FIRE_COOLDOWN,
  createInitialState,
  resetRound,
  stepMatch,
  stepTank,
  type MatchState,
  type PlayerInput,
} from '../src/online/simulation'
import {
  PROTOCOL_VERSION,
  parseNetMessage,
  serializeSnapshot,
} from '../src/online/protocol'

function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    seq: 1,
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    aimX: 800,
    aimY: 300,
    ...overrides,
  }
}

function readyState(): MatchState {
  const state = createInitialState()
  state.phase = 'playing'
  state.countdown = 0
  return state
}

describe('online duel simulation', () => {
  it('starts with a countdown and freezes hull movement until it ends', () => {
    const state = createInitialState()
    const startX = state.host.x

    stepMatch(state, input({ up: true }), input(), FIXED_STEP)

    expect(state.phase).toBe('countdown')
    expect(state.host.x).toBe(startX)

    for (let i = 0; i < 200; i++) {
      stepMatch(state, input(), input(), FIXED_STEP)
    }

    expect(state.phase).toBe('playing')
    expect(state.countdown).toBe(0)
  })

  it('drives along the hull and turns with A/D', () => {
    const state = readyState()
    const startX = state.host.x

    for (let i = 0; i < 60; i++) {
      stepMatch(state, input({ up: true }), input(), FIXED_STEP)
    }

    expect(state.host.x).toBeGreaterThan(startX + 100)
    expect(state.host.y).toBeCloseTo(300, 0)

    const angle = state.host.bodyAngle
    for (let i = 0; i < 30; i++) {
      stepMatch(state, input({ right: true }), input(), FIXED_STEP)
    }
    expect(state.host.bodyAngle).toBeGreaterThan(angle)
  })

  it('blocks tanks against arena walls', () => {
    const state = readyState()
    state.host.x = 280
    state.host.y = 300
    state.host.bodyAngle = 0

    for (let i = 0; i < 180; i++) {
      stepMatch(state, input({ up: true }), input(), FIXED_STEP)
    }

    expect(state.host.x).toBeLessThanOrEqual(313)
    expect(state.host.y).toBeGreaterThan(200)
  })

  it('fires at most once per cooldown window', () => {
    const state = readyState()
    state.host.turretAngle = Math.PI / 2

    stepMatch(state, input({ fire: true, aimX: 110, aimY: 600 }), input(), FIXED_STEP)
    expect(state.bullets).toHaveLength(1)
    expect(state.host.cooldown).toBeCloseTo(FIRE_COOLDOWN, 2)

    stepMatch(state, input({ fire: true, aimX: 110, aimY: 600 }), input(), FIXED_STEP)
    expect(state.bullets).toHaveLength(1)

    for (let i = 0; i < 40; i++) {
      stepMatch(state, input({ aimX: 110, aimY: 600 }), input(), FIXED_STEP)
    }
    stepMatch(state, input({ fire: true, aimX: 110, aimY: 600 }), input(), FIXED_STEP)
    expect(state.bullets.length).toBeGreaterThanOrEqual(1)
  })

  it('deals 25 damage and declares the shooter the round winner at 0 HP', () => {
    const state = readyState()
    state.host.x = 110
    state.host.y = 300
    state.host.turretAngle = 0
    state.client.x = 250
    state.client.y = 300
    state.client.hp = 25

    stepMatch(state, input({ fire: true, aimX: 250, aimY: 300 }), input(), FIXED_STEP)
    expect(state.bullets).toHaveLength(1)

    for (let i = 0; i < 30 && state.phase === 'playing'; i++) {
      stepMatch(state, input({ aimX: 250, aimY: 300 }), input(), FIXED_STEP)
    }

    expect(state.client.hp).toBe(0)
    expect(state.client.alive).toBe(false)
    expect(state.phase).toBe('roundOver')
    expect(state.winner).toBe('host')
    expect(state.wins.host).toBe(1)
  })

  it('preserves round wins while resetting positions and health', () => {
    const state = readyState()
    state.client.hp = 0
    state.client.alive = false
    state.phase = 'roundOver'
    state.winner = 'host'
    state.wins.host = 3
    state.bullets.push({
      id: 'host-1',
      owner: 'host',
      x: 400,
      y: 300,
      vx: 480,
      vy: 0,
      life: 1,
    })

    resetRound(state)

    expect(state.phase).toBe('countdown')
    expect(state.winner).toBeNull()
    expect(state.wins.host).toBe(3)
    expect(state.host.hp).toBe(100)
    expect(state.client.hp).toBe(100)
    expect(state.client.alive).toBe(true)
    expect(state.host.x).toBe(110)
    expect(state.client.x).toBe(690)
    expect(state.bullets).toHaveLength(0)
  })

  it('rotates the turret toward the aim target', () => {
    const state = readyState()
    state.host.turretAngle = 0

    for (let i = 0; i < 30; i++) {
      stepTank(state.host, input({ aimX: 110, aimY: 600 }), FIXED_STEP, false)
    }

    expect(state.host.turretAngle).toBeGreaterThan(Math.PI / 4)
  })

  it('is deterministic for identical inputs', () => {
    const a = readyState()
    const b = readyState()
    const inputs = Array.from({ length: 90 }, (_, i) =>
      input({
        seq: i,
        up: i < 30,
        right: i >= 30 && i < 50,
        fire: i % 20 === 0,
        aimX: 300 + (i % 100),
        aimY: 300,
      }),
    )

    for (const frame of inputs) {
      stepMatch(a, frame, input({ aimX: 400, aimY: 300 }), FIXED_STEP)
      stepMatch(b, frame, input({ aimX: 400, aimY: 300 }), FIXED_STEP)
    }

    expect(b).toEqual(a)
  })
})

describe('online protocol', () => {
  it('round-trips a snapshot', () => {
    const state = createInitialState()
    state.phase = 'playing'
    state.host.muzzle = 0.05

    const snapshot = serializeSnapshot(state, 42)
    const parsed = parseNetMessage(snapshot)

    expect(parsed).toEqual(snapshot)
  })

  it('rejects malformed, wrong-version and oversized messages', () => {
    expect(parseNetMessage(null)).toBeNull()
    expect(parseNetMessage('{not json')).toBeNull()
    expect(
      parseNetMessage({ t: 'input', v: 99, seq: 1, up: false, down: false, left: false, right: false, fire: false, aimX: 1, aimY: 1 }),
    ).toBeNull()
    expect(
      parseNetMessage({ t: 'input', v: PROTOCOL_VERSION, seq: -1, up: false, down: false, left: false, right: false, fire: false, aimX: 1, aimY: 1 }),
    ).toBeNull()
  })

  it('validates and clamps input messages', () => {
    const parsed = parseNetMessage({
      t: 'input',
      v: PROTOCOL_VERSION,
      seq: 7,
      up: true,
      down: false,
      left: false,
      right: false,
      fire: true,
      aimX: 10_000,
      aimY: -10_000,
    })

    expect(parsed?.t).toBe('input')
    if (parsed?.t === 'input') {
      expect(parsed.seq).toBe(7)
      expect(parsed.aimX).toBe(900)
      expect(parsed.aimY).toBe(-100)
    }
  })

  it('rejects snapshots with invalid tanks or too many bullets', () => {
    const state = createInitialState()
    const snapshot = serializeSnapshot(state, 1)
    const badTank = { ...snapshot, host: { ...snapshot.host, hp: -10 } }
    expect(parseNetMessage(badTank)).toBeNull()

    const tooMany = {
      ...snapshot,
      bullets: Array.from({ length: 97 }, (_, i) => ({
        id: `b-${i}`,
        owner: 'host' as const,
        x: 100,
        y: 100,
        vx: 1,
        vy: 1,
        life: 1,
      })),
    }
    expect(parseNetMessage(tooMany)).toBeNull()
  })
})
