import { useEffect, useState } from 'react'
import type { KeyBinds } from '../engine/input'
import { BIND_LABELS } from '../engine/input'
import type { Settings } from '../settings'
import { DEFAULT_SETTINGS } from '../settings'
import type { PaletteSetting, TouchSetting } from '../settings'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}

function prettyKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return code.replace('Arrow', '')
  if (code === 'ShiftLeft') return 'L Shift'
  if (code === 'ShiftRight') return 'R Shift'
  if (code === 'Space') return 'Space'
  if (code === 'Tab') return 'Tab'
  if (code === 'Slash') return '/'
  return code
}

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  const [listening, setListening] = useState<keyof KeyBinds | null>(null)

  useEffect(() => {
    if (!listening) return
    const handler = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.code === 'Escape') {
        setListening(null)
        return
      }
      onChange({
        ...settings,
        binds: { ...settings.binds, [listening]: event.code },
      })
      setListening(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [listening, settings, onChange])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Settings</h2>
      </div>

      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-title">Audio</div>
            {(
              [
                ['master', 'Master volume'],
                ['sfx', 'Effects'],
                ['music', 'Music'],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <span className="field-label">{label}</span>
                <div className="slider-row">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings[key]}
                    onChange={(event) => set(key, Number(event.target.value))}
                  />
                  <span className="value">{Math.round(settings[key] * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-title">Gameplay</div>
            <div className="toggle">
              <span>Screen shake</span>
              <button
                className={`switch ${settings.shake ? 'on' : ''}`}
                aria-pressed={settings.shake}
                aria-label="Screen shake"
                onClick={() => set('shake', !settings.shake)}
              />
            </div>
            <div className="toggle" style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: 8 }}>Colour palette</span>
              <div className="seg">
                {(['default', 'contrast'] as PaletteSetting[]).map((value) => (
                  <button
                    key={value}
                    className={settings.palette === value ? 'active' : ''}
                    onClick={() => set('palette', value)}
                  >
                    {value === 'default' ? 'Standard' : 'High contrast'}
                  </button>
                ))}
              </div>
            </div>
            <div className="toggle" style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: 8 }}>Touch controls</span>
              <div className="seg">
                {(
                  [
                    ['auto', 'Auto'],
                    ['on', 'Always'],
                    ['off', 'Off'],
                  ] as Array<[TouchSetting, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={settings.touch === value ? 'active' : ''}
                    onClick={() => set('touch', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Player 1 bindings</div>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
            Turret aims with the mouse. Q/E rotate it manually, 1–4 pick a weapon, right
            mouse triggers overdrive.
          </p>
          {BIND_LABELS.map(({ key, label }) => (
            <div className="keybind" key={key}>
              <span style={{ flex: 1, fontSize: 12.5 }}>{label}</span>
              <button
                className={`key ${listening === key ? 'listening' : ''}`}
                onClick={() => setListening(key)}
              >
                {listening === key ? 'Press a key…' : prettyKey(settings.binds[key])}
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() =>
              onChange({ ...settings, binds: { ...DEFAULT_SETTINGS.binds } })
            }
          >
            Reset bindings
          </button>
        </div>
      </div>
    </div>
  )
}