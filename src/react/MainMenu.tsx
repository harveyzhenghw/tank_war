import { CAMPAIGN } from '../data/campaign'
import type { Progress } from '../settings'

interface Props {
  progress: Progress
  canInstall: boolean
  onInstall: () => void
  onCampaign: () => void
  onSkirmish: () => void
  onVersus: () => void
  onSettings: () => void
  onControls: () => void
}

export function MainMenu({
  progress,
  canInstall,
  onInstall,
  onCampaign,
  onSkirmish,
  onVersus,
  onSettings,
  onControls,
}: Props) {
  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-inner">
          <h1 className="title">
            TANK <span>WAR</span>
          </h1>
          <div className="rule" />
          <p className="tagline">Armoured combat · 2D · offline</p>

          <div className="menu-grid">
            <button className="menu-tile primary" onClick={onCampaign}>
              <strong>Campaign</strong>
              <small>
                Five operations across the foundry, dunes, crossroads, compound and
                ashfield.
              </small>
            </button>
            <button className="menu-tile" onClick={onSkirmish}>
              <strong>Skirmish</strong>
              <small>Pick a map, dial in the bot count and settle it in one match.</small>
            </button>
            <button className="menu-tile" onClick={onVersus}>
              <strong>Local Versus</strong>
              <small>Two players, one arena, last tank standing. Shared keyboard or pads.</small>
            </button>
            <button className="menu-tile" onClick={onSettings}>
              <strong>Settings</strong>
              <small>Audio, colourblind palette, touch controls and key bindings.</small>
            </button>
            <button className="menu-tile" onClick={onControls}>
              <strong>Controls</strong>
              <small>Keyboard, mouse, gamepad and dual-stick touch reference.</small>
            </button>
          </div>

          <div className="footer-note" style={{ marginTop: 22 }}>
            <span>
              Campaign {Math.min(progress.unlocked, CAMPAIGN.length)}/{CAMPAIGN.length}
            </span>
            <span>·</span>
            <span>Best skirmish {progress.skirmishBest}</span>
            {canInstall && (
              <>
                <span>·</span>
                <button className="btn btn-sm btn-ghost" onClick={onInstall}>
                  Install app
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}