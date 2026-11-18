import { useState } from 'react'
import { MAPS, getMap } from '../data/maps'
import type { MatchOptions } from '../engine/api'
import { MapPreview } from './MapPreview'
import { randomSeed } from './labels'

interface Props {
  onStart: (options: MatchOptions) => void
  onBack: () => void
}

export function VersusScreen({ onStart, onBack }: Props) {
  const [mapId, setMapId] = useState(MAPS[0].id)
  const map = getMap(mapId)

  const start = () => {
    onStart({
      mode: 'versus',
      mapId,
      objective: 'versus',
      difficulty: 'normal',
      botCount: 0,
      players: 2,
      seed: randomSeed(),
    })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Local Versus</h2>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Arena</div>
          <div className="select-grid" style={{ marginBottom: 16 }}>
            {MAPS.map((candidate) => (
              <button
                key={candidate.id}
                className={`select-card ${candidate.id === mapId ? 'active' : ''}`}
                onClick={() => setMapId(candidate.id)}
              >
                <MapPreview map={candidate} />
                <div className="cap">
                  <strong>{candidate.name}</strong>
                </div>
              </button>
            ))}
          </div>
          <div className="panel-title">Controls · Player 2</div>
          <table className="control-table">
            <tbody>
              <tr>
                <td>Move</td>
                <td>
                  <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>
                </td>
              </tr>
              <tr>
                <td>Turret</td>
                <td>
                  <kbd>,</kbd> <kbd>.</kbd>
                </td>
              </tr>
              <tr>
                <td>Fire</td>
                <td>
                  <kbd>/</kbd> or <kbd>Num 0</kbd>
                </td>
              </tr>
              <tr>
                <td>Overdrive</td>
                <td>
                  <kbd>Right Shift</kbd>
                </td>
              </tr>
              <tr>
                <td>Cycle weapon</td>
                <td>
                  <kbd>M</kbd>
                </td>
              </tr>
              <tr>
                <td>Gamepad 2</td>
                <td>Plug in a second pad — auto-detected</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title">Rules</div>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>Last tank standing</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Both tanks start on opposite sides of {map.name}. No respawns, no bots — one
            clean kill decides it. Friendly fire is off.
          </p>
          <div className="level-meta" style={{ marginBottom: 16 }}>
            <span className="tag cyan">P1 · teal</span>
            <span className="tag accent">P2 · amber</span>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={start}>
            Start duel
          </button>
          <p className="pause-note" style={{ marginTop: 12 }}>
            Player 1: WASD + mouse · Player 2: arrows + , . /
          </p>
        </div>
      </div>
    </div>
  )
}