import { useCallback, useEffect, useState } from 'react'
import { CAMPAIGN } from './data/campaign'
import type { LevelDef } from './data/campaign'
import type { MatchOptions, MatchResult } from './engine/api'
import {
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
} from './settings'
import { MainMenu } from './react/MainMenu'
import { CampaignScreen } from './react/CampaignScreen'
import { SkirmishScreen } from './react/SkirmishScreen'
import { VersusScreen } from './react/VersusScreen'
import { SettingsScreen } from './react/SettingsScreen'
import { ControlsScreen } from './react/ControlsScreen'
import { GameScreen } from './react/GameScreen'
import { StoreScreen } from './react/StoreScreen'
import { randomSeed } from './react/labels'
import {
  buyBooster,
  buySkin,
  buyWeapon,
  equipSkin,
  progressLoadout,
  toggleBooster,
} from './data/store'
import type { BoosterId, SkinId, WeaponId } from './engine/types'

type Screen =
  | { name: 'menu' }
  | { name: 'campaign' }
  | { name: 'skirmish' }
  | { name: 'versus' }
  | { name: 'settings' }
  | { name: 'controls' }
  | { name: 'store' }
  | { name: 'game'; options: MatchOptions }

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function levelOptions(level: LevelDef, progress: Progress): MatchOptions {
  return {
    mode: 'campaign',
    mapId: level.mapId,
    levelId: level.id,
    objective: level.objective,
    difficulty: level.difficulty,
    botCount: level.bots,
    waves: level.waves ?? 1,
    captureSeconds: level.captureSeconds ?? 20,
    players: 1,
    seed: randomSeed(),
    loadout: progressLoadout(progress),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveProgress(progress), [progress])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleComplete = useCallback((result: MatchResult) => {
    setProgress((previous) => {
      const next: Progress = {
        ...previous,
        best: { ...previous.best },
        coins: previous.coins + (result.mode === 'versus' ? 0 : result.coinsEarned),
        totalKills:
          previous.totalKills + (result.mode === 'versus' ? 0 : Math.max(0, result.kills)),
      }
      if (result.mode === 'campaign' && result.levelId && result.victory) {
        const level = CAMPAIGN.find((candidate) => candidate.id === result.levelId)
        if (level) {
          next.best[level.id] = Math.max(previous.best[level.id] ?? 0, result.score)
          next.unlocked = Math.max(
            previous.unlocked,
            Math.min(CAMPAIGN.length, level.index + 2),
          )
        }
      } else if (result.mode === 'skirmish') {
        next.skirmishBest = Math.max(previous.skirmishBest, result.score)
      }
      return next
    })
  }, [])

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    setInstallEvent(null)
  }

  if (screen.name === 'game') {
    const level = screen.options.levelId
      ? CAMPAIGN.find((candidate) => candidate.id === screen.options.levelId)
      : undefined
    const nextLevel = level ? CAMPAIGN[level.index + 1] : undefined
    const nextOptions = nextLevel ? levelOptions(nextLevel, progress) : undefined

    return (
      <GameScreen
        options={screen.options}
        settings={settings}
        coins={progress.coins}
        nextOptions={nextOptions}
        onPlayNext={(options) => setScreen({ name: 'game', options })}
        onExit={() =>
          setScreen(
            screen.options.mode === 'campaign' ? { name: 'campaign' } : { name: 'menu' },
          )
        }
        onComplete={handleComplete}
      />
    )
  }

  if (screen.name === 'campaign') {
    return (
      <CampaignScreen
        progress={progress}
        onStart={(level) => setScreen({ name: 'game', options: levelOptions(level, progress) })}
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  if (screen.name === 'skirmish') {
    return (
      <SkirmishScreen
        onStart={(options) =>
          setScreen({
            name: 'game',
            options: { ...options, loadout: progressLoadout(progress) },
          })
        }
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  if (screen.name === 'versus') {
    return (
      <VersusScreen
        onStart={(options) => setScreen({ name: 'game', options })}
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  if (screen.name === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        onChange={setSettings}
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  if (screen.name === 'controls') {
    return <ControlsScreen onBack={() => setScreen({ name: 'menu' })} />
  }

  if (screen.name === 'store') {
    return (
      <StoreScreen
        progress={progress}
        onBuyWeapon={(id: WeaponId) => setProgress((previous) => buyWeapon(previous, id))}
        onBuySkin={(id: SkinId) => setProgress((previous) => buySkin(previous, id))}
        onEquipSkin={(id: SkinId) => setProgress((previous) => equipSkin(previous, id))}
        onBuyBooster={(id: BoosterId) =>
          setProgress((previous) => buyBooster(previous, id))
        }
        onToggleBooster={(id: BoosterId) =>
          setProgress((previous) => toggleBooster(previous, id))
        }
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  return (
    <MainMenu
      progress={progress}
      canInstall={Boolean(installEvent)}
      onInstall={install}
      onCampaign={() => setScreen({ name: 'campaign' })}
      onSkirmish={() => setScreen({ name: 'skirmish' })}
      onVersus={() => setScreen({ name: 'versus' })}
      onStore={() => setScreen({ name: 'store' })}
      onSettings={() => setScreen({ name: 'settings' })}
      onControls={() => setScreen({ name: 'controls' })}
    />
  )
}