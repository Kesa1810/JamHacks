import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { requestMotionAccess, startMotionSensors } from '../lib/deviceMotion'
import { emptyMotion, withPosition, type MotionData } from '../types/motion'

type Options = {
  enabled: boolean
  connected: boolean
  socketRef: React.RefObject<Socket | null>
}

// Socket emit throttle — 8ms cap (~120Hz). Sensors fire at 60-100Hz so this
// rarely kicks in, but prevents bursts when both orientation+motion events fire
// in the same millisecond.
const MIN_EMIT_MS = 8

export function useMotionStream({ enabled, connected, socketRef }: Options) {
  const latestMotion = useRef<MotionData>(emptyMotion())
  const baseline     = useRef<{ beta: number; gamma: number } | null>(null)
  const connectedRef = useRef(connected)
  const lastEmit     = useRef(0)
  const eventCountRef = useRef(0)

  const [sample, setSample]         = useState<MotionData | null>(null)
  const [eventCount, setEventCount] = useState(0)

  connectedRef.current = connected

  useEffect(() => {
    if (!enabled) {
      baseline.current = null
      latestMotion.current = emptyMotion()
      setSample(null)
      setEventCount(0)
      eventCountRef.current = 0
      return
    }

    let stopSensors: (() => void) | undefined
    let cancelled = false
    let rafId = 0

    startMotionSensors((reading) => {
      if (reading.beta == null && reading.gamma == null) return

      if (!baseline.current && reading.beta != null && reading.gamma != null) {
        baseline.current = { beta: reading.beta, gamma: reading.gamma }
      }

      const base = baseline.current ?? { beta: reading.beta ?? 0, gamma: reading.gamma ?? 0 }
      const data = withPosition(
        {
          ...latestMotion.current,
          alpha: reading.alpha,
          beta:  reading.beta,
          gamma: reading.gamma,
          ax: reading.ax ?? latestMotion.current.ax,
          ay: reading.ay ?? latestMotion.current.ay,
          az: reading.az ?? latestMotion.current.az,
          timestamp: Date.now(),
        },
        base,
      )

      // Always update the ref immediately — zero React overhead
      latestMotion.current = data
      eventCountRef.current += 1

      // Emit to socket directly on sensor event for minimum network latency
      const now = Date.now()
      if (connectedRef.current && now - lastEmit.current >= MIN_EMIT_MS) {
        lastEmit.current = now
        socketRef.current?.emit('motion', data)
      }
    })
      .then((stop) => {
        if (cancelled) stop()
        else stopSensors = stop
      })
      .catch(() => {})

    // RAF loop only updates React state — capped at screen refresh rate (60fps).
    // Keeps renders smooth without causing 120+ re-renders/second.
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const data = latestMotion.current
      if (data.beta == null && data.gamma == null) return
      setSample({ ...data })
      // Sync eventCount to React at 60fps (coarse is fine — just for the "no data" warning)
      setEventCount(eventCountRef.current)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      stopSensors?.()
      cancelAnimationFrame(rafId)
    }
  }, [enabled, socketRef])

  const enable = useCallback(async () => {
    await requestMotionAccess()
  }, [])

  const recalibrate = useCallback(() => {
    const { beta, gamma } = latestMotion.current
    if (beta != null && gamma != null) {
      baseline.current = { beta, gamma }
      latestMotion.current = withPosition(latestMotion.current, baseline.current)
      setSample({ ...latestMotion.current })
    } else {
      baseline.current = { beta: 0, gamma: 0 }
    }
  }, [])

  return { sample, eventCount, enable, recalibrate }
}
