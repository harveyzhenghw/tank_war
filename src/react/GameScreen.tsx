import { useEffect, useRef, useState } from 'react'
import type { MatchOptions, MatchResult, HudSnapshot } from '../engine/api'
import { Game } from '../engine/game'
import { InputManager } from '../engine/input'
import { Renderer } from '../render/renderer'
import { AudioEngine } from '../audio/synth'
import type { Settings } from '../settings'
import { prefersTouch } from '../settings'
import { Hud } from './Hud'
import { TouchControls } from './TouchControls'
import { formatScore, formatTime } from './labels'
import { DIFFICULTY_LABEL } from '../data/balance'

interface Props {
  options: MatchOptions
  settings: Settings
  coins: number
  nextOptions?: MatchOptions
  onPlayNext: (options: MatchOptions) => void
  onExit: () => void
  onComplete: (result: MatchResult) => void
}

const MODE_LABEL: Record<MatchResult['mode'], string> = {
  campaign: 'Campaign',
  skirmish: 'Skirmish',
  versus: 'Local Versus',
  ctf: 'Capture the Flag',
}

export function GameScreen({
  options,
  settings,
  coins,
  nextOptions,
  onPlayNext,
  onExit,
  onComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<Game | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const inputRef = useRef<InputManager | null>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [runKey, setRunKey] = useState(0)

  const touchEnabled =
    settings.touch === 'on' || (settings.touch === 'auto' && prefersTouch())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gameOptions: MatchOptions =
      runKey === 0
        ? options
        : { ...options, seed: ((options.seed ?? 1) + runKey * 7919) % 1_000_000_000 }

    const game = new Game(gameOptions)
    gameRef.current = game

    const renderer = new Renderer(canvas, settingsRef.current.palette)
    renderer.setShakeEnabled(settingsRef.current.shake)
    rendererRef.current = renderer

    const input = new InputManager(canvas, () => {
      if (game.finished) return
      setPaused((current) => !current)
    })
    inputRef.current = input

    const audio = new AudioEngine({
      master: settingsRef.current.master,
      sfx: settingsRef.current.sfx,
      music: settingsRef.current.music,
    })
    audioRef.current = audio
    audio.ensure()
    audio.startMusic()

    game.onHud = (snapshot) => setHud(snapshot)
    game.onSfx = (name) => audio.play(name)
    game.onEnd = (matchResult) => {
      setPaused(false)
      setResult(matchResult)
      completeRef.current(matchResult)
      audio.stopMusic()
      audio.play(matchResult.victory ? 'win' : 'lose')
    }
    setHud(game.getHud())

    const resumeAudio = () => audio.ensure()
    window.addEventListener('pointerdown', resumeAudio)

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      input.setView(renderer.view)
      game.setControls(0, input.samplePlayer(0, settingsRef.current.binds))
      if ((options.players ?? 1) === 2) {
        game.setControls(1, input.samplePlayer(1, settingsRef.current.binds))
      }
      game.update(dt)
      renderer.draw(game.world)
      input.endFrame(now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', resumeAudio)
      game.destroy()
      input.destroy()
      renderer.destroy()
      audio.destroy()
      gameRef.current = null
      rendererRef.current = null
      inputRef.current = null
      audioRef.current = null
    }
  }, [options, runKey])

  useEffect(() => {
    gameRef.current?.setPaused(paused)
  }, [paused])

  useEffect(() => {
    audioRef.current?.setVolumes({
      master: settings.master,
      sfx: settings.sfx,
      music: settings.music,
    })
    rendererRef.current?.setPalette(settings.palette)
    rendererRef.current?.setShakeEnabled(settings.shake)
  }, [settings])

  const restart = () => {
    setResult(null)
    setPaused(false)
    setHud(null)
    setRunKey((key) => key + 1)
  }

  const exit = () => {
    audioRef.current?.stopMusic()
    onExit()
  }

  useEffect(() => {
    if (!result) return
    const handler = (event: KeyboardEvent) => {
      if (event.code === 'KeyR') {
        event.preventDefault()
        restart()
      } else if (event.code === 'Enter' && result.victory && nextOptions) {
        event.preventDefault()
        onPlayNext(nextOptions)
      } else if (event.code === 'Escape') {
        event.preventDefault()
        exit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [result, nextOptions])

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {hud && <Hud hud={hud} onPause={() => setPaused((current) => !current)} />}

      {touchEnabled && !result && !paused && (
        <TouchControls getInput={() => inputRef.current} />
      )}

      {paused && !result && (
        <div className="overlay">
          <div className="modal">
            <h1>Paused</h1>
            <p className="sub">
              The match is frozen. Resume when you are ready — Esc toggles this menu during
              play.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setPaused(false)}>
                Resume
              </button>
              <button className="btn" onClick={restart}>
                Restart
              </button>
              <button className="btn btn-ghost" onClick={exit}>
                Quit to menu
              </button>
            </div>
            <p className="pause-note">Esc resume · turret aims with the mouse</p>
          </div>
        </div>
      )}

      {result && (
        <div className="overlay">
          <div className="modal wide">
            <h1 className={result.victory ? 'victory' : 'defeat'}>
              {result.victory ? 'Victory' : 'Defeat'}
            </h1>
            <p className="sub">{result.detail}</p>

            <div className="level-meta" style={{ justifyContent: 'center', marginBottom: 18 }}>
              <span className="tag accent">{MODE_LABEL[result.mode]}</span>
              <span className="tag cyan">{DIFFICULTY_LABEL[result.difficulty]}</span>
              {result.mode === 'ctf' && <span className="tag">First capture wins</span>}
            </div>

            <div className="result-stats">
              <div className="result-stat">
                <small>Score</small>
                <strong>{formatScore(result.score)}</strong>
              </div>
              <div className="result-stat">
                <small>Kills</small>
                <strong>{result.kills}</strong>
              </div>
              <div className="result-stat">
                <small>Time</small>
                <strong>{formatTime(result.time)}</strong>
              </div>
              <div className="result-stat coin-stat">
                <small>Coins earned</small>
                <strong>+{result.coinsEarned}</strong>
              </div>
            </div>

            <p className="result-balance">
              {result.mode === 'versus'
                ? 'Local versus does not earn coins'
                : `Balance: ${coins} coins`}
            </p>

            {result.players.length > 1 && (
              <div className="result-stats">
                {result.players.map((player) => (
                  <div className="result-stat" key={player.name}>
                    <small style={{ color: player.color }}>{player.name}</small>
                    <strong>
                      {player.kills}K / {player.deaths}D
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={restart}>
                Retry
              </button>
              {result.victory && nextOptions && (
                <button className="btn" onClick={() => onPlayNext(nextOptions)}>
                  Next operation
                </button>
              )}
              <button className="btn btn-ghost" onClick={exit}>
                Menu
              </button>
            </div>
            <p className="pause-note">
              R retry{result.victory && nextOptions ? ' · Enter next operation' : ''} · Esc
              menu
            </p>
          </div>
        </div>
      )}
    </div>
  )
}