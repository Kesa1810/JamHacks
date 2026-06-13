import type { MotionData, SliceDirection } from '../types/motion'

export type SliceTrackerState = {
  prevPosX: number
  prevPosY: number
  prevTime: number
  velX: number
  velY: number
  momentumX: number
  momentumY: number
}

const SLICE_VEL_THRESHOLD = 120

export function createSliceTracker(): SliceTrackerState {
  return {
    prevPosX: 0,
    prevPosY: 0,
    prevTime: 0,
    velX: 0,
    velY: 0,
    momentumX: 0,
    momentumY: 0,
  }
}

function directionFromVelocity(vx: number, vy: number): SliceDirection {
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? 'right' : 'left'
  }
  return vy > 0 ? 'down' : 'up'
}

export function enrichWithSlice(
  data: MotionData,
  state: SliceTrackerState,
): { data: MotionData; state: SliceTrackerState } {
  const now = data.timestamp || Date.now()
  const dt = state.prevTime ? Math.max(0.008, (now - state.prevTime) / 1000) : 0.016

  const instantVelX = (data.posX - state.prevPosX) / dt
  const instantVelY = (data.posY - state.prevPosY) / dt
  const velX = state.velX * 0.5 + instantVelX * 0.5
  const velY = state.velY * 0.5 + instantVelY * 0.5
  const speed = Math.sqrt(velX * velX + velY * velY)

  let sliceDirection: SliceDirection = 'none'
  let slicePower = 0

  if (speed > SLICE_VEL_THRESHOLD) {
    sliceDirection = directionFromVelocity(velX, velY)
    slicePower = Math.min(1, (speed - SLICE_VEL_THRESHOLD) / 320)
  }

  if (data.swingSpeed > 13) {
    slicePower = Math.max(slicePower, Math.min(1, (data.swingSpeed - 13) / 16))
    if (sliceDirection === 'none' && speed > 55) {
      sliceDirection = directionFromVelocity(velX, velY)
    }
  }

  const nextState: SliceTrackerState = {
    prevPosX: data.posX,
    prevPosY: data.posY,
    prevTime: now,
    velX,
    velY,
    momentumX,
    momentumY,
  }

  return {
    data: {
      ...data,
      velX,
      velY,
      sliceDirection,
      slicePower,
    },
    state: nextState,
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
