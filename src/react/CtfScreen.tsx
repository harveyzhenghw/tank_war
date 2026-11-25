import { useState } from 'react'
import { getMap } from '../data/maps'
import { DIFFICULTY_LABEL } from '../data/balance'
import type { Difficulty } from '../engine/types'
import type { MatchOptions } from '../engine/api'
import { MapPreview } from './MapPreview'
import { OBJECTIVE_LABEL, randomSeed } from './labels'

interface Props {
  onStart: (options: MatchOptions) => void
  onBack: () => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'veteran']

export function CtfScreen({ onStart, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [bots, setBots] = useState(4)
  const map = getMap('frontier')

  const start = () => {
    onStart({
      mode: 'ctf',
      mapId: map.id,
      objective: 'ctf',
      difficulty,
      botCount: bots,
      players: 1,
      seed: randomSeed(),
    })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Capture the Flag</h2>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Arena</div>
          <div className="ctf-map">
            <MapPreview map={map} />
            <div>
              <h3>{map.name}</h3>
              <p>{map.description}</p>
              <div className="level-meta">
                <span className="tag accent">{map.gridCols} × {map.gridRows}</span>
                <span className="tag">Follow camera</span>
                <span className="tag">Dead ends & shortcuts</span>
              </div>
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              Hostiles <span style={{ color: 'var(--accent)' }}>{bots}</span>
            </span>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={bots}
              onChange={(event) => setBots(Number(event.target.value))}
            />
          </div>

          <div className="field">
            <span className="field-label">Difficulty</span>
            <div className="seg">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  className={difficulty === level ? 'active' : ''}
                  onClick={() => setDifficulty(level)}
                >
                  {DIFFICULTY_LABEL[level]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ position: 'sticky', top: 20 }}>
          <div className="panel-title">Rules</div>
          <ul className="ctf-rules">
            <li>Find the enemy flag through the switchback maze.</li>
            <li>Drive over it to pick it up, then bring it back to your base.</li>
            <li>Crate barricades can be blasted open for risky shortcuts.</li>
            <li>If the enemy takes your flag, stop the carrier and recover it.</li>
            <li>A dropped flag returns home after 18 seconds.</li>
            <li>First flag captured wins. Destroyed tanks respawn after 6 seconds.</li>
          </ul>
          <div className="level-meta" style={{ margin: '14px 0 16px' }}>
            <span className="tag accent">{OBJECTIVE_LABEL.ctf}</span>
            <span className="tag">{DIFFICULTY_LABEL[difficulty]}</span>
            <span className="tag">{bots} hostiles</span>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={start}>
            Deploy
          </button>
          <p className="pause-note" style={{ marginTop: 12 }}>
            The minimap only marks the enemy flag after you spot it.
          </p>
        </div>
      </div>
    </div>
  )
}
