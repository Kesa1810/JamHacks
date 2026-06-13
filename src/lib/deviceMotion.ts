export type MotionSupport = {
  hasOrientation: boolean
  hasMotion: boolean
  needsPermission: boolean
  isSecureContext: boolean
  platform: 'ios' | 'android' | 'other'
}

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

type MotionCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

type SensorReading = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  ax: number | null
  ay: number | null
  az: number | null
}

function getPlatform(): MotionSupport['platform'] {
  if (typeof navigator === 'undefined') return 'other'
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return 'other'
}

export function getMotionSupport(): MotionSupport {
  if (typeof window === 'undefined') {
    return {
      hasOrientation: false,
      hasMotion: false,
      needsPermission: false,
      isSecureContext: false,
      platform: 'other',
    }
  }

  const hasOrientation = 'DeviceOrientationEvent' in window
  const hasMotion = 'DeviceMotionEvent' in window
  let needsPermission = false

  if (hasOrientation) {
    const OrientationEvent = window.DeviceOrientationEvent as OrientationCtor
    needsPermission = typeof OrientationEvent.requestPermission === 'function'
  }

  return {
    hasOrientation,
    hasMotion,
    needsPermission,
    isSecureContext: window.isSecureContext,
    platform: getPlatform(),
  }
}

export function isMotionAvailable(support: MotionSupport) {
  if (!support.isSecureContext) return false
  return support.hasOrientation || support.hasMotion
}

export async function requestMotionAccess(): Promise<void> {
  const support = getMotionSupport()

  if (!support.isSecureContext) {
    throw new Error('insecure')
  }

  if (!isMotionAvailable(support)) {
    throw new Error('not_supported')
  }

  if (support.hasOrientation && support.needsPermission) {
    const OrientationEvent = window.DeviceOrientationEvent as OrientationCtor
    const result = await OrientationEvent.requestPermission!()
    if (result !== 'granted') {
      throw new Error('blocked')
    }
  }

  if (support.hasMotion) {
    const MotionEvent = window.DeviceMotionEvent as MotionCtor
    if (typeof MotionEvent.requestPermission === 'function') {
      const result = await MotionEvent.requestPermission()
      if (result !== 'granted') {
        throw new Error('blocked')
      }
    }
  }
}

export async function startMotionSensors(onReading: (reading: SensorReading) => void) {
  const support = getMotionSupport()
  const cleanups: Array<() => void> = []
  const latest: SensorReading = {
    alpha: null,
    beta: null,
    gamma: null,
    ax: null,
    ay: null,
    az: null,
  }

  const emit = () => onReading({ ...latest })

  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta == null && e.gamma == null) return
    latest.alpha = e.alpha
    latest.beta = e.beta
    latest.gamma = e.gamma
    emit()
  }

  const onDeviceMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc) return
    latest.ax = acc.x
    latest.ay = acc.y
    latest.az = acc.z
    emit()
  }

  if (support.hasOrientation) {
    window.addEventListener('deviceorientation', onOrientation, true)
    cleanups.push(() => window.removeEventListener('deviceorientation', onOrientation, true))
  }

  if (support.hasMotion) {
    window.addEventListener('devicemotion', onDeviceMotion, true)
    cleanups.push(() => window.removeEventListener('devicemotion', onDeviceMotion, true))
  }

  return () => cleanups.forEach((fn) => fn())
}

export function motionErrorMessage(code: string, platform: MotionSupport['platform']) {
  switch (code) {
    case 'not_supported':
      return 'Use Safari on iPhone or Chrome on Android with the https tunnel link.'
    case 'insecure':
      return 'Open the https tunnel link from your computer — motion does not work on http.'
    case 'blocked':
      return platform === 'ios'
        ? 'Tap Allow when asked. If blocked, follow the iPhone steps below, then try again.'
        : 'Tap Allow when asked. If blocked, enable Motion sensors for this site in Chrome settings.'
    default:
      return 'Could not start motion sensors. Follow the steps below and tap Allow again.'
  }
}

export const IOS_MOTION_STEPS = [
  'Open iPhone Settings → Safari',
  'Turn ON Motion & Orientation Access',
  'Also check Settings → Privacy & Security → Motion & Fitness → Fitness Tracking ON',
  'Force-close Safari completely, reopen this link',
  'Tap Allow Motion & Orientation when the popup appears',
]

export const ANDROID_MOTION_STEPS = [
  'When the popup appears, tap Allow for motion sensors',
  'If blocked: Chrome ⋮ → Settings → Site settings → Motion sensors → Allowed',
  'Or: Android Settings → Apps → Chrome → Permissions → Physical activity / Sensors → Allow',
  'Reload this page and tap Allow Motion & Orientation again',
]
