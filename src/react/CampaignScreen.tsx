import { CAMPAIGN } from '../data/campaign'
import type { LevelDef } from '../data/campaign'
import { getMap } from '../data/maps'
import { DIFFICULTY_LABEL } from '../data/balance'
import type { Difficulty } from '../engine/types'
import type { Progress } from '../settings'
import { MapPreview } from './MapPreview'
import { OBJECTIVE_LABEL, formatScore } from './labels'

interface Props {
  progress: Progress
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  onStart: (level: LevelDef) => void
  onBack: () => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'veteran']

const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  easy: 'Slower, less accurate hostiles. Good for learning the maps.',
  normal: 'The intended campaign pace. Enemies flank and use cover.',
  hard: 'Tougher armour, faster reactions and more aggressive pushes.',
  veteran: 'War Hero. Ruthless aim, heavy armour and no second chances.',
}

export function CampaignScreen({
  progress,
  difficulty,
  onDifficultyChange,
  onStart,
  onBack,
}: Props) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Campaign</h2>
        <div className="spacer" />
        <span className="context-tag">10 operations</span>
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>Ten operations</h1>
        <p className="sub" style={{ color: 'var(--muted)', marginTop: 6, fontSize: 13 }}>
          Clear each sector to unlock the next. The difficulty you choose applies to every
          operation and levels share the same battlefields.
        </p>
      </div>

      <div className="campaign-difficulty">
        <div>
          <span className="field-label">Campaign difficulty</span>
          <div className="seg">
            {DIFFICULTIES.map((tier) => (
              <button
                key={tier}
                className={difficulty === tier ? 'active' : ''}
                onClick={() => onDifficultyChange(tier)}
              >
                {DIFFICULTY_LABEL[tier]}
              </button>
            ))}
          </div>
        </div>
        <p className="campaign-difficulty-note">{DIFFICULTY_BLURB[difficulty]}</p>
      </div>

      <div className="card-grid">
        {CAMPAIGN.map((level) => {
          const unlocked = level.index < progress.unlocked
          const map = getMap(level.mapId)
          const best = progress.best[`${level.id}:${difficulty}`] ?? progress.best[level.id]
          const boss = getBossLabel(level)
          return (
            <button
              key={level.id}
              className={`level-card ${boss ? 'boss-level' : ''}`}
              disabled={!unlocked}
              onClick={() => onStart(level)}
            >
              <MapPreview map={map} />
              <div className="body">
                <h3>
                  <span style={{ color: 'var(--accent)' }}>{level.index + 1}</span>
                  {level.name}
                  {boss && <span className="boss-tag">BOSS</span>}
                  {!unlocked && <span className="lock">· Locked</span>}
                </h3>
                <p>{level.brief}</p>
                <div className="level-meta">
                  <span className="tag accent">{OBJECTIVE_LABEL[level.objective]}</span>
                  <span className="tag cyan">{DIFFICULTY_LABEL[difficulty]}</span>
                  <span className="tag">Rec. {DIFFICULTY_LABEL[level.recommended]}</span>
                  <span className="tag">{map.name}</span>
                  {best ? <span className="tag cyan">Best {formatScore(best)}</span> : null}
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

function getBossLabel(level: LevelDef): string | null {
  if (!level.bossId) return null
  return level.bossId
}
