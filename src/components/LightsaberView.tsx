import { useMemo } from 'react'
import type { MotionData } from '../types/motion'
import './LightsaberView.css'

type Props = {
  motion: MotionData | null
  connected: boolean
  beatMode?: boolean
}

export function LightsaberView({ motion, connected, beatMode = false }: Props) {
  const transform = useMemo(() => {
    if (!motion) {
      return 'translate3d(0px, 0px, 0px) rotateX(-10deg)'
    }

    const posX = motion.posX ?? 0
    const posY = motion.posY ?? 0
    const swing = motion.swingSpeed ?? 0

    return `
      translate3d(${posX}px, ${posY}px, ${Math.min(swing * 8, 80)}px)
      rotateY(${posX * 0.15}deg)
      rotateX(${-posY * 0.15}deg)
    `
  }, [motion])

  const glow = motion ? 28 + Math.min((motion.swingSpeed ?? 0) * 10, 60) : 28

  return (
    <div className={`lightsaber-scene ${beatMode ? 'beat-mode' : ''}`}>
      <div className="grid-floor" />

      {beatMode && (
        <>
          <div className="beat-hud">
            <p className="beat-title">Beat Saber Mode</p>
            <p className="beat-subtitle">Swing your phone — saber follows on screen</p>
          </div>

          <div className="lane lane-left">
            <span className="lane-label">L</span>
          </div>
          <div className="lane lane-center">
            <span className="lane-label">C</span>
          </div>
          <div className="lane lane-right">
            <span className="lane-label">R</span>
          </div>

          <div className="beat-spawn-line" />
        </>
      )}

      {!beatMode && (
        <>
          <div className="lane lane-left" />
          <div className="lane lane-center" />
          <div className="lane lane-right" />
        </>
      )}

      <div className="saber-stage">
        {!connected && (
          <div className="idle-message">
            <p>Scan the QR code with your phone</p>
            <p className="small">Your phone becomes the lightsaber</p>
          </div>
        )}

        {connected && !motion && (
          <div className="idle-message">
            <p>Phone connected — allow motion on your phone</p>
            <p className="small">Hold phone steady, then swing from center</p>
          </div>
        )}

        {(connected || motion) && (
          <div className="saber-rig" style={{ transform }}>
            <div className="saber-handle" />
            <div className="saber-guard" />
            <div className="saber-blade">
              <div className="blade-core" style={{ boxShadow: `0 0 ${glow}px #00e5ff` }} />
              <div
                className="blade-glow"
                style={{ opacity: 0.5 + Math.min((motion?.swingSpeed ?? 0) / 20, 0.5) }}
              />
            </div>
          </div>
        )}
      </div>

      {!beatMode && (
        <p className="coming-soon">Beat blocks coming soon — slice through the lanes</p>
      )}
    </div>
  )
}
