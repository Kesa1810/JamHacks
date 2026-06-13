import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { requestMotionAccess, startMotionSensors } from '../lib/deviceMotion'
import {
  emptyMotion,
  withPosition,
  type MotionData,
} from '../types/motion'

type Options = {
  enabled: boolean
  connected: boolean
  socketRef: React.RefObject<Socket | null>
}

const EMIT_INTERVAL_MS = 16

export function useMotionStream({ enabled, connected, socketRef }: Options) {
  const latestMotion = useRef<MotionData>(emptyMotion())
  const baseline = useRef<{ beta: number; gamma: number } | null>(null)
  const connectedRef = useRef(connected)
  const [sample, setSample] = useState<MotionData | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const lastEmit = useRef(0)

  connectedRef.current = connected

  useEffect(() => {
    if (!enabled) {
      baseline.current = null
      latestMotion.current = emptyMotion()
      setSample(null)
      setEventCount(0)
      return
    }

    let stopSensors: (() => void) | undefined
    let cancelled = false

    startMotionSensors((reading) => {
      if (reading.beta == null && reading.gamma == null) return

      if (!baseline.current && reading.beta != null && reading.gamma != null) {
        baseline.current = { beta: reading.beta, gamma: reading.gamma }
      }

      const base = baseline.current ?? { beta: reading.beta ?? 0, gamma: reading.gamma ?? 0 }
      latestMotion.current = withPosition(
        {
          ...latestMotion.current,
          alpha: reading.alpha,
          beta: reading.beta,
          gamma: reading.gamma,
          ax: reading.ax ?? latestMotion.current.ax,
          ay: reading.ay ?? latestMotion.current.ay,
          az: reading.az ?? latestMotion.current.az,
          timestamp: Date.now(),
        },
        base,
      )
      setEventCount((n) => n + 1)
    })
      .then((stop) => {
        if (cancelled) stop()
        else stopSensors = stop
      })
      .catch(() => {})

    let frame = 0
    const tick = () => {
      frame = window.requestAnimationFrame(tick)

      const data = latestMotion.current
      if (data.beta == null && data.gamma == null) return

      const now = Date.now()
      if (now - lastEmit.current < EMIT_INTERVAL_MS) return
      lastEmit.current = now

      const frameData = { ...data }
      setSample(frameData)

      if (connectedRef.current) {
        socketRef.current?.emit('motion', frameData)
      }
    }
    frame = window.requestAnimationFrame(tick)

    return () => {
      cancelled = true
      stopSensors?.()
      window.cancelAnimationFrame(frame)
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
