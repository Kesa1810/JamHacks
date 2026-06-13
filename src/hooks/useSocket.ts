import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

type Role = 'host' | 'controller'

export function useSocket(sessionId: string, role: Role) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const usePollingOnly =
      window.location.hostname.endsWith('.trycloudflare.com') ||
      window.location.hostname.endsWith('.loca.lt')

    const socket = io(window.location.origin, {
      transports: usePollingOnly ? ['polling'] : ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
    })
    socketRef.current = socket

    const onConnect = () => {
      setConnected(true)
      setError('')
      socket.emit('join', { sessionId, role })
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => {
      setConnected(false)
      setError(err.message)
    })

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [sessionId, role])

  return { connected, error, socketRef }
}
