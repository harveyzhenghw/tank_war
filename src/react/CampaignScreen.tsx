import { CAMPAIGN } from '../data/campaign'
import type { LevelDef } from '../data/campaign'
import { getMap } from '../data/maps'
import { DIFFICULTY_LABEL } from '../data/balance'
import type { Progress } from '../settings'
import { MapPreview } from './MapPreview'
import { OBJECTIVE_LABEL, formatScore } from './labels'

interface Props {
  progress: Progress
  onStart: (level: LevelDef) => void
  onBack: () => void
}

export function CampaignScreen({ progress, onStart, onBack }: Props) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Campaign</h2>
        <div className="spacer" />
        <span className="context-tag">Operations</span>
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>Five operations</h1>
        <p className="sub" style={{ color: 'var(--muted)', marginTop: 6, fontSize: 13 }}>
          Clear each sector to unlock the next. Progress and best scores are stored on this
          device.
        </p>
      </div>

      <div className="card-grid">
        {CAMPAIGN.map((level) => {
          const unlocked = level.index < progress.unlocked
          const map = getMap(level.mapId)
          return (
            <button
              key={level.id}
              className="level-card"
              disabled={!unlocked}
              onClick={() => onStart(level)}
            >
              <MapPreview map={map} />
              <div className="body">
                <h3>
                  <span style={{ color: 'var(--accent)' }}>{level.index + 1}</span>
                  {level.name}
                  {!unlocked && <span className="lock">· Locked</span>}
                </h3>
                <p>{level.brief}</p>
                <div className="level-meta">
                  <span className="tag accent">{OBJECTIVE_LABEL[level.objective]}</span>
                  <span className="tag">{DIFFICULTY_LABEL[level.difficulty]}</span>
                  <span className="tag">{map.name}</span>
                  {progress.best[level.id] ? (
                    <span className="tag cyan">Best {formatScore(progress.best[level.id])}</span>
                  ) : null}
                </div>
                {!unlocked && (
                  <span className="lock">Win operation {level.index} to unlock</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}