import {
  ANDROID_MOTION_STEPS,
  IOS_MOTION_STEPS,
  type MotionSupport,
} from '../lib/deviceMotion'
import './MotionPermissionModal.css'

type Props = {
  open: boolean
  loading: boolean
  errorKind: string | null
  support: MotionSupport
  connected: boolean
  onAllow: () => void
}

export function MotionPermissionModal({
  open,
  loading,
  errorKind,
  support,
  connected,
  onAllow,
}: Props) {
  if (!open) return null

  const steps = support.platform === 'ios' ? IOS_MOTION_STEPS : ANDROID_MOTION_STEPS

  return (
    <div className="motion-modal-backdrop">
      <div className="motion-modal" role="dialog" aria-labelledby="motion-modal-title">
        <p className="modal-eyebrow">Permission required</p>
        <h2 id="motion-modal-title">Allow Motion &amp; Orientation</h2>
        <p className="modal-body">
          SaberSync uses your phone&apos;s <strong>gyroscope</strong> and{' '}
          <strong>accelerometer</strong> so you can swing a lightsaber on your computer.
        </p>

        {!support.isSecureContext && (
          <p className="modal-warning">
            This page must load over <strong>https</strong>. Use the tunnel link from your
            computer.
          </p>
        )}

        {errorKind === 'blocked' && (
          <p className="modal-warning">
            Motion was blocked. Follow these steps, then tap the button again:
          </p>
        )}

        <ol className="modal-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <button
          type="button"
          className="modal-allow-btn"
          onClick={onAllow}
          disabled={loading || !support.isSecureContext}
        >
          {loading ? 'Requesting...' : 'Allow Motion & Orientation'}
        </button>

        {!connected && support.isSecureContext && (
          <p className="modal-hint">Connecting to host... you can allow motion now.</p>
        )}

        {errorKind && errorKind !== 'blocked' && (
          <p className="modal-hint">If nothing happens, try Safari on iPhone or Chrome on Android.</p>
        )}
      </div>
    </div>
  )
}
