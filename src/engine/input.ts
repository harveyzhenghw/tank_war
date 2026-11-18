import type { PlayerControls, WeaponId } from './types'
import type { View } from './math'
import { screenToWorld } from './math'

export interface KeyBinds {
  up: string
  down: string
  left: string
  right: string
  fire: string
  overdrive: string
  cycle: string
}

export const DEFAULT_BINDS: KeyBinds = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  fire: 'Space',
  overdrive: 'ShiftLeft',
  cycle: 'Tab',
}

export const BIND_LABELS: Array<{ key: keyof KeyBinds; label: string }> = [
  { key: 'up', label: 'Move up' },
  { key: 'down', label: 'Move down' },
  { key: 'left', label: 'Move left' },
  { key: 'right', label: 'Move right' },
  { key: 'fire', label: 'Fire' },
  { key: 'overdrive', label: 'Overdrive' },
  { key: 'cycle', label: 'Cycle weapon' },
]

const DIGIT_WEAPONS: Record<string, WeaponId> = {
  Digit1: 'cannon',
  Digit2: 'mg',
  Digit3: 'rocket',
  Digit4: 'spread',
}

const BLOCKED_KEYS = new Set([
  'Space',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Slash',
])

export interface TouchState {
  moveX: number
  moveY: number
  aimX: number
  aimY: number
  aimActive: boolean
  fire: boolean
  overdrive: boolean
}

const EMPTY_TOUCH: TouchState = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  aimActive: false,
  fire: false,
  overdrive: false,
}

const EMPTY_CONTROLS: PlayerControls = {
  moveX: 0,
  moveY: 0,
  aimAngle: null,
  aimTarget: null,
  turretTurn: 0,
  fire: false,
  overdrive: false,
  cycle: 0,
  selectWeapon: null,
}

export class InputManager {
  touch: TouchState = { ...EMPTY_TOUCH }
  private keys = new Set<string>()
  private pressed = new Set<string>()
  private mouse = { x: 0, y: 0, left: false, right: false, movedAt: -1 }
  private view: View | null = null
  private padPrev: boolean[][] = [[], []]
  private now = 0
  private cyclePulse = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onPause: () => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
  }

  setView(view: View): void {
    this.view = view
  }

  setTouch(patch: Partial<TouchState>): void {
    this.touch = { ...this.touch, ...patch }
  }

  /** Queues a single weapon-cycle step (used by the touch HUD). */
  pulseCycle(dir = 1): void {
    this.cyclePulse = dir
  }

  resetTouch(): void {
    this.touch = { ...EMPTY_TOUCH }
  }

  endFrame(now: number): void {
    this.now = now
    this.pressed.clear()
    this.cyclePulse = 0
    this.padPrev[0] = this.snapshotPad(0)
    this.padPrev[1] = this.snapshotPad(1)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      if (BLOCKED_KEYS.has(event.code)) event.preventDefault()
      return
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      this.onPause()
      event.preventDefault()
      return
    }
    if (BLOCKED_KEYS.has(event.code)) event.preventDefault()
    this.keys.add(event.code)
    this.pressed.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
    this.pressed.clear()
    this.mouse.left = false
    this.mouse.right = false
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = event.clientX
    this.mouse.y = event.clientY
    this.mouse.movedAt = performance.now()
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.mouse.left = true
    if (event.button === 2) this.mouse.right = true
  }

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.mouse.left = false
    if (event.button === 2) this.mouse.right = false
  }

  private onContextMenu = (event: Event): void => {
    event.preventDefault()
  }

  samplePlayer(index: number, binds: KeyBinds): PlayerControls {
    if (index === 0) {
      const controls = this.sampleKeyboard(binds)
      const pad = this.pad(0)
      if (pad && this.padHasInput(pad)) {
        const gamepadControls = this.sampleGamepad(pad, 0)
        gamepadControls.moveX ||= controls.moveX
        gamepadControls.moveY ||= controls.moveY
        const merged = gamepadControls
        if (merged.aimAngle === null && controls.aimTarget) merged.aimTarget = controls.aimTarget
        merged.fire = merged.fire || controls.fire
        merged.overdrive = merged.overdrive || controls.overdrive
        merged.cycle = merged.cycle || controls.cycle
        merged.selectWeapon = merged.selectWeapon ?? controls.selectWeapon
        this.applyTouch(merged)
        return merged
      }
      this.applyTouch(controls)
      return controls
    }

    const padOne = this.pad(1)
    if (padOne && this.padHasInput(padOne)) return this.sampleGamepad(padOne, 1)
    return this.samplePlayerTwo()
  }

  private applyTouch(controls: PlayerControls): void {
    const t = this.touch
    const moveMag = Math.hypot(t.moveX, t.moveY)
    if (moveMag > 0.08) {
      controls.moveX = t.moveX
      controls.moveY = t.moveY
    }
    if (t.aimActive) {
      controls.aimAngle = Math.atan2(t.aimY, t.aimX)
      controls.aimTarget = null
      controls.fire = true
    }
    if (t.fire) controls.fire = true
    if (t.overdrive) controls.overdrive = true
  }

  private sampleKeyboard(binds: KeyBinds): PlayerControls {
    const controls: PlayerControls = { ...EMPTY_CONTROLS }
    controls.moveX = (this.keys.has(binds.right) ? 1 : 0) - (this.keys.has(binds.left) ? 1 : 0)
    controls.moveY = (this.keys.has(binds.down) ? 1 : 0) - (this.keys.has(binds.up) ? 1 : 0)
    controls.fire = this.mouse.left || this.keys.has(binds.fire)
    controls.overdrive = this.mouse.right || this.keys.has(binds.overdrive)
    controls.turretTurn = (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0)

    if (this.keys.has(binds.cycle)) controls.cycle = 1
    if (this.cyclePulse !== 0) controls.cycle = this.cyclePulse
    for (const [code, weapon] of Object.entries(DIGIT_WEAPONS)) {
      if (this.pressed.has(code)) controls.selectWeapon = weapon
    }

    const recentMouse = performance.now() - this.mouse.movedAt < 4000
    if (recentMouse && this.view) {
      const rect = this.canvas.getBoundingClientRect()
      const sx = this.mouse.x - rect.left
      const sy = this.mouse.y - rect.top
      if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
        controls.aimTarget = screenToWorld(this.view, sx, sy)
      }
    }
    return controls
  }

  private samplePlayerTwo(): PlayerControls {
    const controls: PlayerControls = { ...EMPTY_CONTROLS }
    controls.moveX = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0)
    controls.moveY = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0)
    controls.turretTurn =
      (this.keys.has('Period') ? 1 : 0) - (this.keys.has('Comma') ? 1 : 0)
    controls.fire = this.keys.has('Slash') || this.keys.has('Numpad0')
    controls.overdrive = this.keys.has('ShiftRight')
    if (this.pressed.has('KeyM')) controls.cycle = 1
    return controls
  }

  private pad(index: number): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
    const pads = navigator.getGamepads()
    return pads[index] ?? null
  }

  private padHasInput(pad: Gamepad): boolean {
    if (Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.18) return true
    if (Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0) > 0.25) return true
    return pad.buttons.some((b) => b.pressed)
  }

  private sampleGamepad(pad: Gamepad, padIndex: number): PlayerControls {
    const controls: PlayerControls = { ...EMPTY_CONTROLS }
    let mx = pad.axes[0] ?? 0
    let my = pad.axes[1] ?? 0
    if (pad.buttons[12]?.pressed) my -= 1
    if (pad.buttons[13]?.pressed) my += 1
    if (pad.buttons[14]?.pressed) mx -= 1
    if (pad.buttons[15]?.pressed) mx += 1
    const mag = Math.hypot(mx, my)
    if (mag > 0.16) {
      const scale = Math.min(1, mag)
      controls.moveX = (mx / (mag || 1)) * scale
      controls.moveY = (my / (mag || 1)) * scale
    }

    const ax = pad.axes[2] ?? 0
    const ay = pad.axes[3] ?? 0
    if (Math.hypot(ax, ay) > 0.3) controls.aimAngle = Math.atan2(ay, ax)

    controls.fire = Boolean(pad.buttons[0]?.pressed || pad.buttons[7]?.pressed)
    controls.overdrive = Boolean(pad.buttons[1]?.pressed)

    const prev = this.padPrev[padIndex] ?? []
    const nowPressed = (i: number) => Boolean(pad.buttons[i]?.pressed) && !prev[i]
    if (nowPressed(5)) controls.cycle = 1
    if (nowPressed(4)) controls.cycle = -1
    if (nowPressed(2)) controls.selectWeapon = 'cannon'
    if (nowPressed(3)) controls.selectWeapon = 'mg'
    return controls
  }

  private snapshotPad(index: number): boolean[] {
    const pad = this.pad(index)
    if (!pad) return []
    return pad.buttons.map((b) => b.pressed)
  }

  /** Exposed for the HUD / debug. */
  get nowMs(): number {
    return this.now
  }
}