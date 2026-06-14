import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MotionPermissionModal } from '../components/MotionPermissionModal'
import { MotionSettingsHelp } from '../components/MotionSettingsHelp'
import {
  getMotionSupport,
  isMotionAvailable,
  motionErrorMessage,
} from '../lib/deviceMotion'
import { useSocket } from '../hooks/useSocket'
import { useMotionStream } from '../hooks/useMotionStream'
import { useWakeLock } from '../hooks/useWakeLock'
import './ControllerPage.css'

export function ControllerPage() {
  const { sessionId = '' } = useParams()
  const { connected, error: socketError, socketRef } = useSocket(sessionId, 'controller')
  const support = useMemo(() => getMotionSupport(), [])
  const motionAvailable = isMotionAvailable(support)

  const [motionActive, setMotionActive] = useState(false)
  const [showModal, setShowModal] = useState(true)
  const [errorKind, setErrorKind] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const motion = useMotionStream({
    enabled: motionActive,
    connected,
    socketRef,
  })

  // Keep the phone screen on during gameplay so it never locks + disconnects.
  const wakeLockActive = useWakeLock(motionActive)

  // Stop the phone from reloading/closing this tab — pull-to-refresh, overscroll,
  // and accidental back/close all reset the session mid-game.
  useEffect(() => {
    const root = document.documentElement
    const prevHtml = root.style.overscrollBehavior
    const prevBody = document.body.style.overscrollBehavior
    root.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      root.style.overscrollBehavior = prevHtml
      document.body.style.overscrollBehavior = prevBody
    }
  }, [])

  // While actively controlling, warn before an accidental unload/close so a
  // stray swipe or tap can't silently kill the live session.
  useEffect(() => {
    if (!motionActive) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [motionActive])

  // Haptic feedback — host emits 'haptic' after a hit, we vibrate the phone.
  // Silent-fail: navigator.vibrate is undefined on iOS and some browsers.
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const onHaptic = ({ type }: { type: string }) => {
      try {
        if (!navigator.vibrate) return
        if (type === 'perfect') {
          navigator.vibrate([80, 40, 80])
        } else {
          navigator.vibrate(60)
        }
      } catch {}
    }
    socket.on('haptic', onHaptic)
    return () => { socket.off('haptic', onHaptic) }
  }, [socketRef, connected])

  const startMotion = async () => {
    setErrorKind(null)
    setStarting(true)
    try {
      await motion.enable()
      setMotionActive(true)
      setShowModal(false)
    } catch (err) {
      setMotionActive(false)
      const code = err instanceof Error ? err.message : 'unknown'
      setErrorKind(code)
    } finally {
      setStarting(false)
    }
  }

  const onLocaLt = typeof window !== 'undefined' && window.location.hostname.endsWith('.loca.lt')

  if (!sessionId) {
    return (
      <div className="controller-page">
        <div className="controller-card">
          <h1>Invalid link</h1>
          <p className="hint-label">Scan the QR code on your computer to get a valid session link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="controller-page controller-fullscreen">
      <MotionPermissionModal
        open={showModal && !motionActive}
        loading={starting}
        errorKind={errorKind}
        support={support}
        connected={connected}
        onAllow={startMotion}
      />

      <header className="controller-top">
        <div>
          <p className="eyebrow">SaberSync - Motion Controller</p>
          <p className="session-code">{sessionId}</p>
        </div>
        <div className={`status-pill ${connected ? 'online' : ''}`}>
          <span className="status-dot" />
          {connected ? 'Connected' : 'Connecting...'}
        </div>
      </header>

      {onLocaLt && (
        <p className="hint-label loca-lt-hint">
          If you see a loca.lt welcome page first, tap <strong>Continue</strong> to open the
          controller.
        </p>
      )}

      {socketError && <p className="error-label">{socketError}</p>}

      {!motionAvailable && (
        <p className="error-label">
          Motion sensors not detected. Use Safari on iPhone or Chrome on Android with the https
          tunnel link.
        </p>
      )}

      {errorKind && motionActive === false && !showModal && (
        <>
          <p className="error-label">{motionErrorMessage(errorKind, support.platform)}</p>
          <MotionSettingsHelp support={support} errorKind={errorKind} />
          <button type="button" className="enable-btn" onClick={() => setShowModal(true)}>
            Open permission popup again
          </button>
        </>
      )}

      {motionActive && (
        <div className="motion-active-panel">
          <p className="active-label">Swing your phone - saber follows on the computer</p>
          <div className="motion-actions">
            <button type="button" className="recalibrate-btn" onClick={motion.recalibrate}>
              Reset center
            </button>
            <button type="button" className="recalibrate-btn" onClick={() => setShowModal(true)}>
              Motion settings
            </button>
          </div>
          {motion.eventCount === 0 && (
            <p className="hint-label">
              No sensor data yet - tap Motion settings and allow access.
            </p>
          )}
          {wakeLockActive && (
            <p className="wakelock-label">Screen stay-awake: ON</p>
          )}
        </div>
      )}

      {motion.sample && (
        <div className="motion-preview">
          <div className="preview-crosshair" />
          <div
            className="phone-saber"
            style={{
              transform: `
                translate(${motion.sample.posX}px, ${motion.sample.posY}px)
                rotateY(${motion.sample.posX * 0.2}deg)
                rotateX(${-motion.sample.posY * 0.2}deg)
              `,
            }}
          />
        </div>
      )}

      {motion.sample && (
        <footer className="controller-footer">
          <span>X {motion.sample.posX.toFixed(0)}</span>
          <span>Y {motion.sample.posY.toFixed(0)}</span>
          <span>Swing {motion.sample.swingSpeed?.toFixed(1) ?? '0'}</span>
          <span>{connected ? 'Live' : 'Offline'}</span>
        </footer>
      )}
    </div>
  )
}
