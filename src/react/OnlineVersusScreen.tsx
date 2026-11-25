import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { NetMessage } from '../online/protocol'
import { usePeerRoom, formatRoomCode } from '../online/usePeerRoom'
import { useOnlineMatch } from '../online/useOnlineMatch'

interface Props {
  onBack: () => void
}

function secureContextWarning(): string | null {
  if (typeof window === 'undefined') return null
  const localhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  if (window.isSecureContext || localhost) return null
  return 'Online play requires HTTPS or localhost so the browser can open a WebRTC connection.'
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  try {
    const area = document.createElement('textarea')
    area.value = value
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

export function OnlineVersusScreen({ onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const matchMessageRef = useRef<(message: NetMessage) => void>(() => {})
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState<'lobby' | 'menu'>('lobby')
  const copyTimerRef = useRef<number | null>(null)

  const onRoomMessage = useCallback((message: NetMessage) => {
    matchMessageRef.current(message)
  }, [])

  const room = usePeerRoom({ onMessage: onRoomMessage })
  const connected = room.status === 'connected'
  const match = useOnlineMatch({
    canvasRef,
    enabled: connected,
    role: room.role,
    send: room.send,
  })
  matchMessageRef.current = match.handleMessage

  const warning = secureContextWarning()

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      setLeaveConfirm(false)
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      event.preventDefault()
      setLeaveTarget('lobby')
      setLeaveConfirm(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connected])

  const copyRoomCode = async () => {
    if (!room.roomCode) return
    const ok = await copyText(room.roomCode)
    setCopied(ok)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800)
  }

  const submitJoin = (event: FormEvent) => {
    event.preventDefault()
    room.join(joinCode)
  }

  const leaveMatch = (target: 'lobby' | 'menu' = leaveTarget) => {
    setLeaveConfirm(false)
    room.leave()
    if (target === 'menu') onBack()
  }

  const exitToMenu = () => {
    if (connected) {
      setLeaveTarget('menu')
      setLeaveConfirm(true)
      return
    }
    room.leave()
    onBack()
  }

  const playAgain = () => match.playAgain()

  return (
    <div className="screen online-screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={exitToMenu}>
          ← Menu
        </button>
        <h2>Online Duel</h2>
        <span className="spacer" />
        {connected && (
          <span className="online-pill">
            <i />
            Connected · {room.role === 'host' ? 'Host' : 'Guest'}
          </span>
        )}
      </div>

      {warning && <div className="online-warning">{warning}</div>}

      {!connected && (
        <OnlineLobby
          status={room.status}
          role={room.role}
          roomCode={room.roomCode}
          error={room.error}
          joinCode={joinCode}
          copied={copied}
          onJoinCode={setJoinCode}
          onHost={room.host}
          onJoin={submitJoin}
          onCopy={copyRoomCode}
          onCancel={room.leave}
          onMenu={() => {
            room.leave()
            onBack()
          }}
        />
      )}

      {connected && (
        <div className="online-game-wrap">
          <div className="online-game-frame">
            <canvas
              ref={canvasRef}
              className="online-canvas"
              width={800}
              height={600}
              tabIndex={0}
              aria-label="Online tank duel arena"
            />

            {match.roundOver && (
              <div className="overlay">
                <div className="modal">
                  <h1
                    className={
                      match.roundOver.winner === room.role ? 'victory' : 'defeat'
                    }
                  >
                    {match.roundOver.winner === room.role ? 'Round Won' : 'Round Lost'}
                  </h1>
                  <p className="sub">
                    {match.roundOver.winner === 'host' ? 'Host' : 'Guest'} wins the round.
                    First to four hits takes it — positions and health reset for the next
                    round.
                  </p>
                  <div className="result-stats">
                    <div className="result-stat">
                      <small>Host</small>
                      <strong>{match.roundOver.wins.host}</strong>
                    </div>
                    <div className="result-stat">
                      <small>Guest</small>
                      <strong>{match.roundOver.wins.client}</strong>
                    </div>
                  </div>
                  {room.role === 'host' && match.rematchRequested && (
                    <p className="online-rematch-note">
                      Your opponent has requested a rematch.
                    </p>
                  )}
                  {room.role === 'client' && match.rematchRequested && (
                    <p className="online-rematch-note">
                      Rematch requested. Waiting for the host…
                    </p>
                  )}
                  <div className="modal-actions">
                    <button
                      className="btn btn-primary"
                      onClick={playAgain}
                      disabled={room.role === 'client' && match.rematchRequested}
                    >
                      {room.role === 'host'
                        ? 'Play Again'
                        : match.rematchRequested
                          ? 'Rematch Requested'
                          : 'Request Rematch'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setLeaveTarget('lobby')
                        setLeaveConfirm(true)
                      }}
                    >
                      Leave Match
                    </button>
                  </div>
                </div>
              </div>
            )}

            {leaveConfirm && (
              <div className="overlay">
                <div className="modal">
                  <h1>Leave Match?</h1>
                  <p className="sub">
                    The connection will close and this round will be abandoned.
                  </p>
                  <div className="modal-actions">
                    <button className="btn" onClick={() => setLeaveConfirm(false)}>
                      Keep Playing
                    </button>
                    <button className="btn btn-danger" onClick={() => leaveMatch()}>
                      {leaveTarget === 'menu' ? 'Leave to Menu' : 'Leave Match'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="online-game-footer">
            <span>
              <kbd>W</kbd> <kbd>S</kbd> drive · <kbd>A</kbd> <kbd>D</kbd> turn · mouse aim
              · left click fire
            </span>
            <span className="online-footer-hint">Esc to leave</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface LobbyProps {
  status: ReturnType<typeof usePeerRoom>['status']
  role: ReturnType<typeof usePeerRoom>['role']
  roomCode: string | null
  error: string | null
  joinCode: string
  copied: boolean
  onJoinCode: (value: string) => void
  onHost: () => void
  onJoin: (event: FormEvent) => void
  onCopy: () => void
  onCancel: () => void
  onMenu: () => void
}

function OnlineLobby({
  status,
  role,
  roomCode,
  error,
  joinCode,
  copied,
  onJoinCode,
  onHost,
  onJoin,
  onCopy,
  onCancel,
  onMenu,
}: LobbyProps) {
  if (status === 'idle') {
    return (
      <div className="online-lobby">
        <div className="two-col">
          <section className="panel online-panel">
            <div className="panel-title">Create a room</div>
            <h3 className="online-heading">Host the duel</h3>
            <p className="online-copy">
              Generate a short room code, send it to your opponent, and wait for them to
              join. Your browser becomes the match authority — no game server is involved.
            </p>
            <button className="btn btn-primary btn-lg" onClick={onHost}>
              Create Room (Host)
            </button>
            <p className="online-small">
              Both players need this page open. WebRTC works best on home or mobile
              networks.
            </p>
          </section>

          <section className="panel online-panel">
            <div className="panel-title">Join a room</div>
            <h3 className="online-heading">Enter a room code</h3>
            <form onSubmit={onJoin} className="online-join-form">
              <label htmlFor="online-room-code" className="visually-hidden">
                Room code
              </label>
              <input
                id="online-room-code"
                className="online-code-input"
                value={joinCode}
                onChange={(event) => onJoinCode(event.target.value.toUpperCase())}
                placeholder="TW-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={20}
              />
              <button className="btn btn-primary" type="submit">
                Join Room
              </button>
            </form>
            <p className="online-copy">
              Paste the code from the host. Codes are case-insensitive and can be pasted
              with or without separators.
            </p>
          </section>
        </div>

        {error && <div className="online-error">{error}</div>}

        <div className="online-rules">
          <div>
            <strong>100 HP</strong>
            <span>25 damage per hit — four hits wins the round.</span>
          </div>
          <div>
            <strong>Host authoritative</strong>
            <span>The host resolves hits, health and round wins for both players.</span>
          </div>
          <div>
            <strong>Rematch</strong>
            <span>Round wins stay on the board; positions and health reset.</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'hosting' || status === 'waiting') {
    return (
      <div className="online-lobby">
        <section className="panel online-wait-panel">
          <div className="panel-title">
            {status === 'hosting' ? 'Opening room' : 'Waiting for opponent'}
          </div>
          <div className="online-wait-icon" aria-hidden="true">
            {status === 'hosting' ? '…' : '⌁'}
          </div>
          <h3 className="online-heading">
            {status === 'hosting' ? 'Preparing the arena' : 'Share this room code'}
          </h3>
          {roomCode ? (
            <>
              <div className="online-code-box">
                <strong>{formatRoomCode(roomCode)}</strong>
                <button className="btn btn-sm" onClick={onCopy}>
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
              <p className="online-copy online-centred">
                Send this code to your opponent. Keep this window open — you are the host.
              </p>
            </>
          ) : (
            <div className="online-spinner" aria-label="Creating room" />
          )}

          {error && <div className="online-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancel Room
            </button>
            <button className="btn btn-ghost" onClick={onMenu}>
              Main Menu
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (status === 'joining') {
    return (
      <div className="online-lobby">
        <section className="panel online-wait-panel">
          <div className="panel-title">Connecting</div>
          <div className="online-spinner" aria-label="Connecting to room" />
          <h3 className="online-heading">Joining {formatRoomCode(roomCode)}</h3>
          <p className="online-copy online-centred">
            Waiting for the host to answer. This usually takes a few seconds.
          </p>
          {error && <div className="online-error">{error}</div>}
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="online-lobby">
      <section className="panel online-wait-panel">
        <div className="panel-title">{status === 'disconnected' ? 'Disconnected' : 'Room error'}</div>
        <h3 className="online-heading">
          {status === 'disconnected' ? 'The connection ended' : 'The room could not start'}
        </h3>
        <p className="online-copy online-centred">
          {error ?? 'The connection was closed.'}
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onCancel}>
            Back to Lobby
          </button>
          <button className="btn btn-ghost" onClick={onMenu}>
            Main Menu
          </button>
        </div>
        {role === 'host' && <p className="online-small">Your room is closed.</p>}
      </section>
    </div>
  )
}
