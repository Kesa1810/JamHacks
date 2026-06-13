import {
  ANDROID_MOTION_STEPS,
  IOS_MOTION_STEPS,
  type MotionSupport,
} from '../lib/deviceMotion'
import './MotionSettingsHelp.css'

type Props = {
  support: MotionSupport
  showAlways?: boolean
  errorKind?: string | null
}

export function MotionSettingsHelp({ support, showAlways, errorKind }: Props) {
  const showIos = support.platform === 'ios' && (showAlways || errorKind === 'blocked')
  const showAndroid = support.platform === 'android' && (showAlways || errorKind === 'blocked')
  const showGeneric = support.platform === 'other' && (showAlways || errorKind)

  if (!showIos && !showAndroid && !showGeneric && !showAlways) {
    return null
  }

  const steps =
    support.platform === 'ios'
      ? IOS_MOTION_STEPS
      : support.platform === 'android'
        ? ANDROID_MOTION_STEPS
        : [
            'Use Safari on iPhone or Chrome on Android for best results',
            'Allow motion/orientation when the browser asks',
            'If blocked, check browser site permissions for sensors',
          ]

  return (
    <div className="motion-settings-help">
      <p className="help-title">How to turn on motion sensing</p>
      {!support.isSecureContext && (
        <p className="help-warning">
          This page must load over <strong>https</strong> for motion to work. Use the tunnel link
          from your computer.
        </p>
      )}
      {!support.hasOrientation && !support.hasMotion && (
        <p className="help-warning">
          Your browser does not expose motion APIs here. Try Safari on iPhone or Chrome on
          Android over the https tunnel link.
        </p>
      )}
      <ol className="help-steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
