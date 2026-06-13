import { useEffect, useRef, useState } from 'react'
import { emptySmoothedMotion, smoothMotion } from '../lib/motionSmoothing'
import type { MotionData } from '../types/motion'

export function useSmoothedMotion(target: MotionData | null, factor = 0.18) {
  const currentRef = useRef<MotionData>(emptySmoothedMotion())
  const targetRef = useRef<MotionData | null>(null)
  const [display, setDisplay] = useState<MotionData | null>(null)

  targetRef.current = target

  useEffect(() => {
    let frame = 0

    const tick = () => {
      const nextTarget = targetRef.current
      if (!nextTarget) {
        currentRef.current = emptySmoothedMotion()
        setDisplay(null)
      } else {
        currentRef.current = smoothMotion(currentRef.current, nextTarget, factor)
        setDisplay({ ...currentRef.current })
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [factor])

  return display
}
