import { useState } from 'react'
import { MAPS, getMap } from '../data/maps'
import { DIFFICULTY_LABEL } from '../data/balance'
import type { Difficulty } from '../engine/types'
import type { MatchOptions } from '../engine/api'
import { MapPreview } from './MapPreview'
import { OBJECTIVE_LABEL, randomSeed } from './labels'

interface Props {
  onStart: (options: MatchOptions) => void
  onBack: () => void
}

type SkirmishObjective = 'elimination' | 'deathmatch'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'veteran']

export function SkirmishScreen({ onStart, onBack }: Props) {
  const [mapId, setMapId] = useState(MAPS[0].id)
  const [bots, setBots] = useState(3)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [objective, setObjective] = useState<SkirmishObjective>('elimination')
  const [targetKills, setTargetKills] = useState(10)

  const map = getMap(mapId)

  const start = () => {
    onStart({
      mode: 'skirmish',
      mapId,
      objective,
      difficulty,
      botCount: bots,
      targetKills,
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
        <h2>Skirmish</h2>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Arena</div>
          <div className="select-grid" style={{ marginBottom: 18 }}>
            {MAPS.map((candidate) => (
              <button
                key={candidate.id}
                className={`select-card ${candidate.id === mapId ? 'active' : ''}`}
                onClick={() => setMapId(candidate.id)}
              >
                <MapPreview map={candidate} />
                <div className="cap">
                  <strong>{candidate.name}</strong>
                  <span>{OBJECTIVE_LABEL.elimination}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="field">
            <span className="field-label">Objective</span>
            <div className="seg">
              <button
                className={objective === 'elimination' ? 'active' : ''}
                onClick={() => setObjective('elimination')}
              >
                Last tank standing
              </button>
              <button
                className={objective === 'deathmatch' ? 'active' : ''}
                onClick={() => setObjective('deathmatch')}
              >
                Deathmatch
              </button>
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

          {objective === 'deathmatch' && (
            <div className="field">
              <span className="field-label">
                Kill target <span style={{ color: 'var(--accent)' }}>{targetKills}</span>
              </span>
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={targetKills}
                onChange={(event) => setTargetKills(Number(event.target.value))}
              />
            </div>
          )}
        </div>

        <div className="panel" style={{ position: 'sticky', top: 20 }}>
          <div className="panel-title">Briefing</div>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>{map.name}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            {map.description}
          </p>
          <div className="level-meta" style={{ marginBottom: 16 }}>
            <span className="tag accent">{OBJECTIVE_LABEL[objective]}</span>
            <span className="tag">{DIFFICULTY_LABEL[difficulty]}</span>
            <span className="tag">{bots} hostiles</span>
            {objective === 'deathmatch' && <span className="tag">First to {targetKills}</span>}
            {objective === 'elimination' && <span className="tag">One life</span>}
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={start}>
            Deploy
          </button>
          <p className="pause-note" style={{ marginTop: 12 }}>
            Esc pauses · R restarts after a match
          </p>
        </div>
      </div>
    </div>
  )
}