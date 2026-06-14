import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

type Role = 'host' | 'controller'

// Localtunnel has WebSocket upgrade issues; cloudflared supports WS natively
function preferredTransports(hostname: string): string[] {
  if (hostname.endsWith('.loca.lt')) return ['polling']
  return ['websocket', 'polling']  // websocket first — much lower latency
}

export function useSocket(sessionId: string, role: Role) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: preferredTransports(window.location.hostname),
      reconnection: true,
      reconnectionAttempts: Infinity,   // never give up
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
      // Ping every 10s so the tunnel doesn't kill the connection on idle
      pingInterval: 10000,
      pingTimeout: 5000,
    })
    socketRef.current = socket

    const joinSession = () => {
      setConnected(true)
      setError('')
      socket.emit('join', { sessionId, role })
    }

    socket.on('connect', joinSession)
    socket.on('reconnect', joinSession)   // re-join after reconnect
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => {
      setConnected(false)
      setError(err.message)
    })

    if (socket.connected) joinSession()

    return () => {
      socket.off('connect', joinSession)
      socket.off('reconnect', joinSession)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [sessionId, role])

  return { connected, error, socketRef }
}
