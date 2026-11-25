import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import {
  PROTOCOL_VERSION,
  parseNetMessage,
  type NetMessage,
} from './protocol'
import type { Role } from './simulation'

export type RoomStatus =
  | 'idle'
  | 'hosting'
  | 'waiting'
  | 'joining'
  | 'connected'
  | 'disconnected'
  | 'error'

interface Options {
  onMessage: (message: NetMessage) => void
}

interface PeerLikeError {
  type?: string
  message?: string
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]

function iceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_PEER_ICE_SERVERS
  if (typeof configured !== 'string' || configured.trim().length === 0) {
    return DEFAULT_ICE_SERVERS
  }
  try {
    const parsed: unknown = JSON.parse(configured)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (server): server is RTCIceServer =>
          typeof server === 'object' &&
          server !== null &&
          'urls' in server &&
          (typeof (server as { urls?: unknown }).urls === 'string' ||
            Array.isArray((server as { urls?: unknown }).urls)),
      )
      if (valid.length > 0) return valid
    }
  } catch {
    // Fall back to the public STUN list if the environment value is malformed.
  }
  return DEFAULT_ICE_SERVERS
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeRoomCode(): string {
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let code = 'TW'
  for (const byte of bytes) code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length]
  return code
}

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatRoomCode(value: string | null): string {
  if (!value) return ''
  if (value.length <= 2) return value
  const rest = value.slice(2)
  return `${value.slice(0, 2)}-${rest.slice(0, 4)}-${rest.slice(4)}`
}

function errorText(error: PeerLikeError): string {
  switch (error.type) {
    case 'peer-unavailable':
      return 'That room could not be found. Check the code and make sure the host is still online.'
    case 'network':
      return 'The PeerJS signalling server could not be reached. Check your connection and try again.'
    case 'server-error':
      return 'The PeerJS signalling server returned an error. Try again in a moment.'
    case 'browser-incompatible':
      return 'This browser does not support the WebRTC features required for online play.'
    case 'webrtc':
      return 'The peer-to-peer connection could not be established. A restrictive network or firewall may be blocking WebRTC.'
    default:
      return error.message
        ? `Connection error: ${error.message}`
        : 'The connection failed. Try again.'
  }
}

/**
 * Owns the PeerJS peer and the single data connection for an online room.
 * Explicit start/leave actions keep React StrictMode from creating duplicate
 * peers, while the mount cleanup destroys anything still alive.
 */
export function usePeerRoom({ onMessage }: Options) {
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [role, setRole] = useState<Role | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)
  const roleRef = useRef<Role | null>(null)
  const generationRef = useRef(0)
  const mountedRef = useRef(true)
  const retryTimerRef = useRef<number | null>(null)
  const joinTimerRef = useRef<number | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (joinTimerRef.current !== null) {
      window.clearTimeout(joinTimerRef.current)
      joinTimerRef.current = null
    }
  }, [])

  const destroyTransport = useCallback(() => {
    generationRef.current += 1
    clearTimers()

    const connection = connRef.current
    connRef.current = null
    if (connection) {
      try {
        connection.removeAllListeners()
        connection.close()
      } catch {
        // The underlying peer may already be gone.
      }
    }

    const peer = peerRef.current
    peerRef.current = null
    if (peer) {
      try {
        peer.removeAllListeners()
        peer.destroy()
      } catch {
        // Destroying an already-closed peer is harmless.
      }
    }
  }, [clearTimers])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      destroyTransport()
    }
  }, [destroyTransport])

  const fail = useCallback(
    (message: string) => {
      destroyTransport()
      if (!mountedRef.current) return
      setError(message)
      setStatus('error')
      setRole(null)
      setRoomCode(null)
      roleRef.current = null
    },
    [destroyTransport],
  )

  const attachConnection = useCallback(
    (connection: DataConnection, generation: number) => {
      connRef.current = connection

      const sendHello = () => {
        if (generation !== generationRef.current) return
        try {
          connection.send({
            t: 'hello',
            v: PROTOCOL_VERSION,
            role: roleRef.current,
          })
        } catch {
          fail('The data channel opened but the handshake could not be sent.')
        }
      }

      connection.on('open', sendHello)
      // The connection can already be open by the time the host receives it.
      if (connection.open) sendHello()

      connection.on('data', (raw: unknown) => {
        if (generation !== generationRef.current) return
        const message = parseNetMessage(raw)
        if (!message) {
          if (
            typeof raw === 'object' &&
            raw !== null &&
            'v' in raw &&
            (raw as { v?: unknown }).v !== PROTOCOL_VERSION
          ) {
            fail('The other player is running a different version of Tank War.')
          }
          return
        }

        if (message.t === 'hello') {
          if (!roleRef.current || message.role === roleRef.current) {
            fail('The room handshake was invalid.')
            return
          }
          if (mountedRef.current) {
            clearTimers()
            setStatus('connected')
            setError(null)
          }
          return
        }

        if (message.t === 'leave') {
          if (roleRef.current === 'host') {
            connRef.current = null
            setStatus('waiting')
            setError('The other player left. Waiting for a new opponent.')
          } else {
            connRef.current = null
            setStatus('disconnected')
            setError('The host left the match.')
          }
          return
        }

        onMessageRef.current(message)
      })

      connection.on('close', () => {
        if (generation !== generationRef.current) return
        connRef.current = null
        if (!mountedRef.current) return
        if (roleRef.current === 'host') {
          setStatus('waiting')
          setError('The other player disconnected. Waiting for a new opponent.')
        } else {
          setStatus('disconnected')
          setError('The host disconnected.')
        }
      })

      connection.on('error', (err: PeerLikeError) => {
        if (generation !== generationRef.current) return
        fail(errorText(err))
      })
    },
    [clearTimers, fail],
  )

  const host = useCallback(() => {
    destroyTransport()
    const generation = generationRef.current
    roleRef.current = 'host'
    setRole('host')
    setRoomCode(null)
    setError(null)
    setStatus('hosting')

    let attempts = 0

    const openPeer = () => {
      if (generation !== generationRef.current) return
      const code = makeRoomCode()
      const peer = new Peer(code, {
        debug: 0,
        config: { iceServers: iceServers() },
      })
      peerRef.current = peer

      peer.on('open', (id: string) => {
        if (generation !== generationRef.current) return
        if (!mountedRef.current) return
        setRoomCode(id)
        setStatus('waiting')
        setError(null)
      })

      peer.on('connection', (connection: DataConnection) => {
        if (generation !== generationRef.current) return
        if (connRef.current) {
          try {
            connection.close()
          } catch {
            // Ignore a rejected second connection.
          }
          return
        }
        attachConnection(connection, generation)
      })

      peer.on('error', (err: PeerLikeError) => {
        if (generation !== generationRef.current) return
        if (err.type === 'unavailable-id' && attempts < 4) {
          attempts += 1
          try {
            peer.removeAllListeners()
            peer.destroy()
          } catch {
            // Ignore cleanup failure and retry with a fresh code.
          }
          if (peerRef.current === peer) peerRef.current = null
          retryTimerRef.current = window.setTimeout(openPeer, 250)
          return
        }
        fail(errorText(err))
      })

      peer.on('close', () => {
        if (generation !== generationRef.current) return
        if (peerRef.current === peer) peerRef.current = null
      })
    }

    openPeer()
  }, [attachConnection, destroyTransport, fail])

  const join = useCallback(
    (input: string) => {
      const code = normalizeRoomCode(input)
      if (code.length < 4) {
        setError('Enter a valid room code.')
        setStatus('error')
        return
      }

      destroyTransport()
      const generation = generationRef.current
      roleRef.current = 'client'
      setRole('client')
      setRoomCode(code)
      setError(null)
      setStatus('joining')

      joinTimerRef.current = window.setTimeout(() => {
        if (generation !== generationRef.current) return
        fail(
          'The room did not respond. Check the code and make sure the host is still online.',
        )
      }, 15_000)

      const peer = new Peer({
        debug: 0,
        config: { iceServers: iceServers() },
      })
      peerRef.current = peer

      peer.on('open', () => {
        if (generation !== generationRef.current) return
        const connection = peer.connect(code, {
          reliable: true,
          serialization: 'json',
        })
        attachConnection(connection, generation)
      })

      peer.on('error', (err: PeerLikeError) => {
        if (generation !== generationRef.current) return
        fail(errorText(err))
      })

      peer.on('close', () => {
        if (generation !== generationRef.current) return
        if (peerRef.current === peer) peerRef.current = null
      })
    },
    [attachConnection, destroyTransport, fail],
  )

  const send = useCallback((message: NetMessage) => {
    const connection = connRef.current
    if (!connection || !connection.open) return
    try {
      connection.send(message)
    } catch {
      // A close event will follow if the transport has gone away.
    }
  }, [])

  const leave = useCallback(() => {
    const connection = connRef.current
    if (connection && connection.open) {
      try {
        connection.send({ t: 'leave', v: PROTOCOL_VERSION })
      } catch {
        // Closing below still cleans up.
      }
    }
    destroyTransport()
    if (!mountedRef.current) return
    roleRef.current = null
    setRole(null)
    setRoomCode(null)
    setError(null)
    setStatus('idle')
  }, [destroyTransport])

  return {
    status,
    role,
    roomCode,
    error,
    host,
    join,
    leave,
    send,
  }
}
