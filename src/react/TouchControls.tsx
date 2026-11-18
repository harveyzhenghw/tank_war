import { useRef, useState } from 'react'
import type { InputManager } from '../engine/input'

interface Props {
  getInput: () => InputManager | null
}

export function TouchControls({ getInput }: Props) {
  return (
    <div className="touch-layer">
      <Stick
        side="left"
        label="Drive"
        onChange={(x, y) => getInput()?.setTouch({ moveX: x, moveY: y })}
      />
      <Stick
        side="right"
        label="Aim / Fire"
        onChange={(x, y, active) =>
          getInput()?.setTouch({ aimX: x, aimY: y, aimActive: active, fire: active })
        }
      />
      <div className="touch-actions">
        <button
          className="touch-btn"
          aria-label="Cycle weapon"
          onPointerDown={(event) => {
            event.preventDefault()
            getInput()?.pulseCycle(1)
          }}
        >
          SWAP
        </button>
        <button
          className="touch-btn"
          aria-label="Overdrive"
          onPointerDown={(event) => {
            event.preventDefault()
            getInput()?.setTouch({ overdrive: true })
          }}
          onPointerUp={() => getInput()?.setTouch({ overdrive: false })}
          onPointerCancel={() => getInput()?.setTouch({ overdrive: false })}
          onPointerLeave={() => getInput()?.setTouch({ overdrive: false })}
        >
          BOOST
        </button>
      </div>
    </div>
  )
}

interface StickProps {
  side: 'left' | 'right'
  label: string
  onChange: (x: number, y: number, active: boolean) => void
}

function Stick({ side, label, onChange }: StickProps) {
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const activePointer = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const update = (clientX: number, clientY: number) => {
    const zone = zoneRef.current
    if (!zone) return
    const rect = zone.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const max = rect.width / 2 - 18
    let dx = clientX - cx
    let dy = clientY - cy
    const magnitude = Math.hypot(dx, dy)
    if (magnitude > max) {
      dx = (dx / magnitude) * max
      dy = (dy / magnitude) * max
    }
    setKnob({ x: dx, y: dy })
    const nx = dx / max
    const ny = dy / max
    const active = Math.hypot(nx, ny) > 0.16
    onChange(active ? nx : 0, active ? ny : 0, active)
  }

  const release = () => {
    activePointer.current = null
    setKnob({ x: 0, y: 0 })
    onChange(0, 0, false)
  }

  return (
    <div
      ref={zoneRef}
      className={`stick-zone ${side}`}
      onPointerDown={(event) => {
        event.preventDefault()
        activePointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (activePointer.current !== event.pointerId) return
        update(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        if (activePointer.current !== event.pointerId) return
        release()
      }}
      onPointerCancel={release}
      onPointerLeave={(event) => {
        if (activePointer.current === event.pointerId && event.buttons === 0) release()
      }}
    >
      <div className="stick" />
      <div
        className="stick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
      <div className="stick-label">{label}</div>
    </div>
  )
}