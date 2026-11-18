import type { HudSnapshot, PlayerHud } from '../engine/api'
import { WEAPONS } from '../data/weapons'
import { OBJECTIVE_LABEL, formatScore, formatTime } from './labels'

interface Props {
  hud: HudSnapshot
  onPause: () => void
}

export function Hud({ hud, onPause }: Props) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          {hud.players.map((player) => (
            <PlayerPanel key={player.index} player={player} />
          ))}
        </div>

        <div className="hud-centre">
          <div className="objective-chip">
            <strong>
              {OBJECTIVE_LABEL[hud.objective]}
              {hud.wavesTotal > 1 ? ` · Wave ${hud.wave}/${hud.wavesTotal}` : ''}
            </strong>
            <span>{hud.detail}</span>
          </div>
          <div className="progress">
            <i style={{ width: `${Math.round(hud.progress * 100)}%` }} />
          </div>
        </div>

        <div className="hud-right">
          <div className="stat-chip time">
            <small>Time</small>
            <strong>{formatTime(hud.time)}</strong>
          </div>
          <div className="stat-chip coins">
            <small>Coins</small>
            <strong>+{hud.coins}</strong>
          </div>
          <div className="stat-chip">
            <small>Score</small>
            <strong>{formatScore(hud.score)}</strong>
          </div>
          <button className="icon-btn" onClick={onPause} aria-label="Pause">
            ❚❚
          </button>
        </div>
      </div>

      {hud.message && (
        <div className="hud-message" key={hud.message}>
          {hud.message}
        </div>
      )}

      {hud.countdown > 0 && (
        <div className="countdown">
          <span key={Math.ceil(hud.countdown)}>{Math.ceil(hud.countdown)}</span>
        </div>
      )}
    </div>
  )
}

function PlayerPanel({ player }: { player: PlayerHud }) {
  const hpFraction = Math.max(0, player.hp / player.maxHp)
  const low = hpFraction < 0.3 && player.alive
  const buffs = [
    player.shield && 'SHD',
    player.damageBoost && 'DMG',
    player.speedBoost && 'SPD',
    player.armorBoost && 'ARM',
  ].filter(Boolean) as string[]

  return (
    <div
      className="player-panel"
      style={{ opacity: player.alive ? 1 : 0.55 }}
    >
      <div className="name">
        <span style={{ color: player.color }}>{player.name}</span>
        <span>{player.alive ? `${player.hp}` : 'DESTROYED'}</span>
      </div>
      <div className={`bar hp ${low ? 'low' : ''}`}>
        <i style={{ width: `${Math.round(hpFraction * 100)}%` }} />
      </div>
      <div className="bar overdrive">
        <i style={{ width: `${Math.round(player.overdrive * 100)}%` }} />
      </div>
      <div className="weapon-row">
        {player.weapons.map((weapon) => {
          const def = WEAPONS[weapon.id]
          const empty = weapon.ammo !== null && weapon.ammo <= 0
          return (
            <span
              key={weapon.id}
              className={`weapon-chip ${player.weapon === weapon.id ? 'active' : ''} ${
                empty ? 'empty' : ''
              }`}
              title={def.name}
            >
              {def.short}
              {weapon.ammo === null ? ' ∞' : ` ${weapon.ammo}`}
            </span>
          )
        })}
      </div>
      {buffs.length > 0 && (
        <div className="buffs">
          {buffs.map((buff) => (
            <span key={buff} className="buff">
              {buff}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}