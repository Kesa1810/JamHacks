import type { MotionData, SliceDirection } from '../types/motion'

export type SliceTrackerState = {
  prevTiltX: number
  prevTiltY: number
  prevTime: number
  angVelX: number  // smoothed angular velocity deg/s on X axis (left/right)
  angVelY: number  // smoothed angular velocity deg/s on Y axis (up/down)
}

// Default fallback - overridden by adaptive profile at call site
const DEFAULT_ANG_VEL_THRESHOLD = 90

export function createSliceTracker(): SliceTrackerState {
  return {
    prevTiltX: 0,
    prevTiltY: 0,
    prevTime: 0,
    angVelX: 0,
    angVelY: 0,
  }
}

function directionFromAngularVelocity(vx: number, vy: number): SliceDirection {
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? 'right' : 'left'
  }
  return vy > 0 ? 'down' : 'up'
}

export function enrichWithSlice(
  data: MotionData,
  state: SliceTrackerState,
  threshold = DEFAULT_ANG_VEL_THRESHOLD,
): { data: MotionData; state: SliceTrackerState; angSpeed: number } {
  const now = data.timestamp || Date.now()
  const dt = state.prevTime ? Math.max(0.008, (now - state.prevTime) / 1000) : 0.016

  // Angular velocity in degrees/sec from tilt angle changes
  const rawVelX = (data.tiltX - state.prevTiltX) / dt
  const rawVelY = (data.tiltY - state.prevTiltY) / dt

  // Light smoothing (0.4 new + 0.6 previous) - keeps it responsive
  const angVelX = state.angVelX * 0.4 + rawVelX * 0.6
  const angVelY = state.angVelY * 0.4 + rawVelY * 0.6

  const angSpeed = Math.sqrt(angVelX * angVelX + angVelY * angVelY)

  let sliceDirection: SliceDirection = 'none'
  let slicePower = 0

  if (angSpeed > threshold) {
    sliceDirection = directionFromAngularVelocity(angVelX, angVelY)
    slicePower = Math.min(1, (angSpeed - threshold) / 200)
  }

  // Also check raw accelerometer swing as a fallback
  if (data.swingSpeed > 12) {
    const fallbackPower = Math.min(1, (data.swingSpeed - 12) / 14)
    if (fallbackPower > slicePower) {
      slicePower = fallbackPower
      if (sliceDirection === 'none') {
        sliceDirection = directionFromAngularVelocity(angVelX, angVelY)
      }
    }
  }

  const nextState: SliceTrackerState = {
    prevTiltX: data.tiltX,
    prevTiltY: data.tiltY,
    prevTime: now,
    angVelX,
    angVelY,
  }

  return {
    data: {
      ...data,
      velX: angVelX,
      velY: angVelY,
      sliceDirection,
      slicePower,
    },
    state: nextState,
    angSpeed,
  }
}

export function sliceRotation(direction: SliceDirection, power: number) {
  if (power < 0.1 || direction === 'none') {
    return { rotateX: 0, rotateY: 0, rotateZ: 0, extendX: 0, extendY: 0 }
  }
  const p = power
  switch (direction) {
    case 'left':
      return { rotateX: 8 * p, rotateY: -38 * p, rotateZ: -42 * p, extendX: -55 * p, extendY: 0 }
    case 'right':
      return { rotateX: 8 * p, rotateY: 38 * p, rotateZ: 42 * p, extendX: 55 * p, extendY: 0 }
    case 'up':
      return { rotateX: -48 * p, rotateY: 0, rotateZ: 0, extendX: 0, extendY: -55 * p }
    case 'down':
      return { rotateX: 48 * p, rotateY: 0, rotateZ: 0, extendX: 0, extendY: 55 * p }
    default:
      return { rotateX: 0, rotateY: 0, rotateZ: 0, extendX: 0, extendY: 0 }
  }
}
