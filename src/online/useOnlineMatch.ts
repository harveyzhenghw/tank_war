import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { angleDiff, clamp } from '../engine/math'
import { drawOnlineGame } from './renderer'
import {
  BULLET_LIFETIME,
  FIRE_COOLDOWN,
  FIXED_STEP,
  NEUTRAL_INPUT,
  createInitialState,
  resetRound,
  stepMatch,
  stepTank,
} from './simulation'
import type {
  BulletState,
  MatchState,
  PlayerInput,
  Role,
  RoundWins,
  TankState,
} from './simulation'
import {
  PROTOCOL_VERSION,
  serializeSnapshot,
  type NetMessage,
  type SnapshotMessage,
} from './protocol'
import { ARENA_HEIGHT, ARENA_WIDTH } from './map'

interface Options {
  canvasRef: RefObject<HTMLCanvasElement | null>
  enabled: boolean
  role: Role | null
  send: (message: NetMessage) => void
}

interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
  aimX: number
  aimY: number
}

export interface RoundOverInfo {
  winner: Role
  wins: RoundWins
}

function freshInput(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    aimX: ARENA_WIDTH / 2,
    aimY: ARENA_HEIGHT / 2,
  }
}

function cloneTank(tank: TankState): TankState {
  return { ...tank }
}

function inputFrom(state: InputState, seq: number): PlayerInput {
  return {
    seq,
    up: state.up,
    down: state.down,
    left: state.left,
    right: state.right,
    fire: state.fire,
    aimX: state.aimX,
    aimY: state.aimY,
  }
}

function interpolateAngle(current: number, target: number, factor: number): number {
  return current + angleDiff(current, target) * factor
}

export function useOnlineMatch({ canvasRef, enabled, role, send }: Options) {
  const stateRef = useRef<MatchState>(createInitialState())
  const viewRef = useRef<MatchState>(createInitialState())
  const snapshotRef = useRef<SnapshotMessage | null>(null)
  const snapshotAtRef = useRef(0)
  const predictedRef = useRef<TankState | null>(null)
  const inputRef = useRef<InputState>(freshInput())
  const remoteInputRef = useRef<PlayerInput>({ ...NEUTRAL_INPUT })
  const remoteSeqRef = useRef(-1)
  const seqRef = useRef(0)
  const roundOverRef = useRef<Role | null>(null)
  const pingSentRef = useRef(new Map<number, number>())
  const rttRef = useRef<number | null>(null)
  const sendRef = useRef(send)
  const roleRef = useRef(role)
  const enabledRef = useRef(enabled)
  sendRef.current = send
  roleRef.current = role
  enabledRef.current = enabled

  const [roundOver, setRoundOver] = useState<RoundOverInfo | null>(null)
  const [rematchRequested, setRematchRequested] = useState(false)

  useEffect(() => {
    if (!enabled || !role) return
    const initial = createInitialState()
    stateRef.current = initial
    viewRef.current = createInitialState()
    snapshotRef.current = null
    snapshotAtRef.current = 0
    predictedRef.current = cloneTank(role === 'client' ? initial.client : initial.host)
    remoteInputRef.current = { ...NEUTRAL_INPUT }
    remoteSeqRef.current = -1
    seqRef.current = 0
    inputRef.current = freshInput()
    roundOverRef.current = null
    pingSentRef.current.clear()
    rttRef.current = null
    setRoundOver(null)
    setRematchRequested(false)
  }, [enabled, role])

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const aimFromPointer = (event: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      inputRef.current.aimX = clamp(
        ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
        0,
        ARENA_WIDTH,
      )
      inputRef.current.aimY = clamp(
        ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
        0,
        ARENA_HEIGHT,
      )
    }

    const onKeyDown = (event: KeyboardEvent) => {
      let handled = true
      switch (event.code) {
        case 'KeyW':
          inputRef.current.up = true
          break
        case 'KeyS':
          inputRef.current.down = true
          break
        case 'KeyA':
          inputRef.current.left = true
          break
        case 'KeyD':
          inputRef.current.right = true
          break
        default:
          handled = false
      }
      if (handled) event.preventDefault()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          inputRef.current.up = false
          break
        case 'KeyS':
          inputRef.current.down = false
          break
        case 'KeyA':
          inputRef.current.left = false
          break
        case 'KeyD':
          inputRef.current.right = false
          break
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      aimFromPointer(event)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      aimFromPointer(event)
      inputRef.current.fire = true
      canvas.focus()
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 0) inputRef.current.fire = false
    }

    const onMouseMove = (event: MouseEvent) => {
      // Pointer events are the primary path; this keeps older browsers usable.
      aimFromPointer(event)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      aimFromPointer(event)
      inputRef.current.fire = true
    }

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) inputRef.current.fire = false
    }

    const onContextMenu = (event: Event) => event.preventDefault()

    const sendNeutralInput = () => {
      if (roleRef.current !== 'client') return
      const input = inputFrom(inputRef.current, seqRef.current++)
      sendRef.current({ ...input, t: 'input', v: PROTOCOL_VERSION })
    }

    const releaseInput = () => {
      const input = inputRef.current
      input.up = false
      input.down = false
      input.left = false
      input.right = false
      input.fire = false
      sendNeutralInput()
    }

    const onVisibility = () => {
      if (document.hidden) releaseInput()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', releaseInput)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('contextmenu', onContextMenu)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', releaseInput)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [canvasRef, enabled])

  const applySnapshot = useCallback((snapshot: SnapshotMessage) => {
    snapshotRef.current = snapshot
    snapshotAtRef.current = performance.now()

    if (roundOverRef.current !== snapshot.winner && snapshot.phase === 'roundOver') {
      if (snapshot.winner) {
        roundOverRef.current = snapshot.winner
        setRoundOver({ winner: snapshot.winner, wins: { ...snapshot.wins } })
      }
    } else if (snapshot.phase !== 'roundOver' && roundOverRef.current !== null) {
      roundOverRef.current = null
      setRoundOver(null)
      setRematchRequested(false)
    }

    if (roleRef.current === 'client') {
      const predicted = predictedRef.current
      const authoritative = snapshot.client
      if (!predicted || snapshot.phase !== 'playing' || !authoritative.alive) {
        predictedRef.current = cloneTank(authoritative)
      } else {
        const dx = authoritative.x - predicted.x
        const dy = authoritative.y - predicted.y
        const error = Math.hypot(dx, dy)
        if (error > 36) {
          predicted.x = authoritative.x
          predicted.y = authoritative.y
        } else if (error > 16) {
          predicted.x += dx * 0.08
          predicted.y += dy * 0.08
        }
        const angleError = Math.abs(angleDiff(predicted.bodyAngle, authoritative.bodyAngle))
        if (angleError > 0.12) {
          predicted.bodyAngle = interpolateAngle(
            predicted.bodyAngle,
            authoritative.bodyAngle,
            0.2,
          )
        }
        if (angleError > 1) {
          predicted.bodyAngle = authoritative.bodyAngle
        }
        predicted.turretAngle = interpolateAngle(
          predicted.turretAngle,
          authoritative.turretAngle,
          0.4,
        )
        predicted.hp = authoritative.hp
        predicted.alive = authoritative.alive
        predicted.cooldown = authoritative.cooldown
        predicted.muzzle = Math.max(predicted.muzzle, authoritative.muzzle)
        predicted.hitFlash = Math.max(predicted.hitFlash, authoritative.hitFlash)
      }

      const view = viewRef.current
      view.tick = snapshot.tick
      view.phase = snapshot.phase
      view.countdown = snapshot.countdown
      view.winner = snapshot.winner
      view.wins = { ...snapshot.wins }
      view.host.hp = snapshot.host.hp
      view.host.alive = snapshot.host.alive
      view.host.muzzle = Math.max(view.host.muzzle, snapshot.host.muzzle)
      view.host.hitFlash = Math.max(view.host.hitFlash, snapshot.host.hitFlash)
    }
  }, [])

  const handleMessage = useCallback(
    (message: NetMessage) => {
      if (message.t === 'input') {
        if (roleRef.current !== 'host') return
        if (message.seq <= remoteSeqRef.current) return
        remoteSeqRef.current = message.seq
        remoteInputRef.current = {
          seq: message.seq,
          up: message.up,
          down: message.down,
          left: message.left,
          right: message.right,
          fire: message.fire,
          aimX: message.aimX,
          aimY: message.aimY,
        }
        return
      }

      if (message.t === 'snap') {
        if (roleRef.current !== 'client') return
        applySnapshot(message)
        return
      }

      if (message.t === 'rematch') {
        if (roleRef.current === 'host') setRematchRequested(true)
        return
      }

      if (message.t === 'ping') {
        sendRef.current({ t: 'pong', v: PROTOCOL_VERSION, id: message.id })
        return
      }

      if (message.t === 'pong') {
        const sentAt = pingSentRef.current.get(message.id)
        if (sentAt === undefined) return
        pingSentRef.current.delete(message.id)
        rttRef.current = Math.max(0, performance.now() - sentAt)
      }
    },
    [applySnapshot],
  )

  const playAgain = useCallback(() => {
    if (!enabledRef.current) return
    if (roleRef.current === 'host') {
      resetRound(stateRef.current)
      roundOverRef.current = null
      setRoundOver(null)
      setRematchRequested(false)
      sendRef.current(serializeSnapshot(stateRef.current, remoteSeqRef.current))
    } else if (roleRef.current === 'client') {
      sendRef.current({ t: 'rematch', v: PROTOCOL_VERSION })
      setRematchRequested(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !role) return
    const canvas = canvasRef.current
    if (!canvas) return

    let raf = 0
    let previous = performance.now()
    let hostAccumulator = 0
    let predictionAccumulator = 0
    let lastSnapshotSent = 0
    let lastInputSent = 0
    let lastPingSent = 0

    const sendPing = (now: number) => {
      if (now - lastPingSent < 2000) return
      lastPingSent = now
      const id = Math.floor(now)
      pingSentRef.current.set(id, now)
      if (pingSentRef.current.size > 12) {
        const oldest = pingSentRef.current.keys().next().value
        if (typeof oldest === 'number') pingSentRef.current.delete(oldest)
      }
      sendRef.current({ t: 'ping', v: PROTOCOL_VERSION, id })
    }

    const updateHost = (now: number, dt: number) => {
      const state = stateRef.current
      hostAccumulator = Math.min(0.2, hostAccumulator + dt)
      let steps = 0
      while (hostAccumulator >= FIXED_STEP && steps < 8) {
        const hostInput = inputFrom(inputRef.current, seqRef.current++)
        stepMatch(state, hostInput, remoteInputRef.current, FIXED_STEP)
        hostAccumulator -= FIXED_STEP
        steps += 1
      }

      if (state.phase === 'roundOver' && state.winner && roundOverRef.current !== state.winner) {
        roundOverRef.current = state.winner
        setRoundOver({ winner: state.winner, wins: { ...state.wins } })
      }

      if (now - lastSnapshotSent >= 50) {
        lastSnapshotSent = now
        sendRef.current(serializeSnapshot(state, remoteSeqRef.current))
      }

      drawOnlineGame(canvas, state, {
        localRole: role,
        rtt: rttRef.current,
      })
    }

    const updateClient = (now: number, dt: number) => {
      const snapshot = snapshotRef.current
      const view = viewRef.current

      predictionAccumulator = Math.min(0.2, predictionAccumulator + dt)
      const predicted = predictedRef.current
      const canMove = snapshot?.phase === 'playing'
      while (predictionAccumulator >= FIXED_STEP && predicted) {
        const input = inputFrom(inputRef.current, seqRef.current)
        stepTank(predicted, input, FIXED_STEP, canMove)
        if (canMove && input.fire && predicted.cooldown <= 0 && predicted.alive) {
          predicted.cooldown = FIRE_COOLDOWN
          predicted.muzzle = 0.08
        }
        predictionAccumulator -= FIXED_STEP
      }

      if (snapshot) {
        const target = snapshot.host
        const hostView = view.host
        const dx = target.x - hostView.x
        const dy = target.y - hostView.y
        if (Math.hypot(dx, dy) > 90) {
          hostView.x = target.x
          hostView.y = target.y
          hostView.bodyAngle = target.bodyAngle
          hostView.turretAngle = target.turretAngle
        } else {
          const factor = 1 - Math.exp(-15 * dt)
          hostView.x += dx * factor
          hostView.y += dy * factor
          hostView.bodyAngle = interpolateAngle(hostView.bodyAngle, target.bodyAngle, factor)
          hostView.turretAngle = interpolateAngle(
            hostView.turretAngle,
            target.turretAngle,
            factor,
          )
        }
        hostView.hp = target.hp
        hostView.alive = target.alive
        hostView.muzzle = Math.max(0, hostView.muzzle - dt)
        hostView.hitFlash = Math.max(0, hostView.hitFlash - dt)

        const elapsed = Math.min(0.14, (now - snapshotAtRef.current) / 1000)
        view.bullets = snapshot.bullets.map((bullet) => {
          const advanced = Math.max(0, bullet.life - elapsed)
          return {
            ...bullet,
            x: bullet.x + bullet.vx * elapsed,
            y: bullet.y + bullet.vy * elapsed,
            life: Math.min(BULLET_LIFETIME, advanced),
          } satisfies BulletState
        })
        view.phase = snapshot.phase
        view.countdown = Math.max(0, snapshot.countdown - elapsed)
        view.winner = snapshot.winner
        view.wins = { ...snapshot.wins }
      }

      if (predicted) view.client = cloneTank(predicted)

      if (now - lastInputSent >= 33) {
        lastInputSent = now
        const input = inputFrom(inputRef.current, seqRef.current++)
        sendRef.current({ ...input, t: 'input', v: PROTOCOL_VERSION })
      }

      drawOnlineGame(canvas, view, {
        localRole: role,
        rtt: rttRef.current,
      })
    }

    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000))
      previous = now
      sendPing(now)
      if (role === 'host') updateHost(now, dt)
      else updateClient(now, dt)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [applySnapshot, canvasRef, enabled, role])

  return {
    roundOver,
    rematchRequested,
    handleMessage,
    playAgain,
  }
}
