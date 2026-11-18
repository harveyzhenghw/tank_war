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
import { randomSeed } from './react/labels'

type Screen =
  | { name: 'menu' }
  | { name: 'campaign' }
  | { name: 'skirmish' }
  | { name: 'versus' }
  | { name: 'settings' }
  | { name: 'controls' }
  | { name: 'game'; options: MatchOptions }

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function levelOptions(level: LevelDef): MatchOptions {
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
      const next: Progress = { ...previous, best: { ...previous.best } }
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
    const nextOptions = nextLevel ? levelOptions(nextLevel) : undefined

    return (
      <GameScreen
        options={screen.options}
        settings={settings}
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
        onStart={(level) => setScreen({ name: 'game', options: levelOptions(level) })}
        onBack={() => setScreen({ name: 'menu' })}
      />
    )
  }

  if (screen.name === 'skirmish') {
    return (
      <SkirmishScreen
        onStart={(options) => setScreen({ name: 'game', options })}
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

  return (
    <MainMenu
      progress={progress}
      canInstall={Boolean(installEvent)}
      onInstall={install}
      onCampaign={() => setScreen({ name: 'campaign' })}
      onSkirmish={() => setScreen({ name: 'skirmish' })}
      onVersus={() => setScreen({ name: 'versus' })}
      onSettings={() => setScreen({ name: 'settings' })}
      onControls={() => setScreen({ name: 'controls' })}
    />
  )
}