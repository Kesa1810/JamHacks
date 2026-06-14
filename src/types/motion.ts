import {
  getMotionSupport,
  isMotionAvailable,
  motionErrorMessage,
  requestMotionAccess,
} from '../lib/deviceMotion'

export type SliceDirection = 'left' | 'right' | 'up' | 'down' | 'none'

export type MotionData = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  ax: number | null
  ay: number | null
  az: number | null
  posX: number
  posY: number
  // Raw angle offsets from calibration baseline (degrees). Used for 1:1 saber tilt.
  tiltX: number  // dGamma — positive = phone tilted right
  tiltY: number  // -dBeta  — positive = phone tilted back/up
  swingSpeed: number
  timestamp: number
  velX: number
  velY: number
  sliceDirection: SliceDirection
  slicePower: number
}

export type NetworkInfo = {
  ip: string
  port: number
  tunnelUrl?: string | null
  tunnelPending?: boolean
  addresses?: Array<{ name: string; ip: string; virtual: boolean }>
}

export { getMotionSupport, isMotionAvailable, motionErrorMessage, requestMotionAccess }

export function emptyMotion(): MotionData {
  return {
    alpha: null,
    beta: null,
    gamma: null,
    ax: null,
    ay: null,
    az: null,
    posX: 0,
    posY: 0,
    tiltX: 0,
    tiltY: 0,
    swingSpeed: 0,
    timestamp: Date.now(),
    velX: 0,
    velY: 0,
    sliceDirection: 'none',
    slicePower: 0,
  }
}

export function withPosition(
  data: MotionData,
  baseline: { beta: number; gamma: number },
): MotionData {
  const beta = data.beta ?? baseline.beta
  const gamma = data.gamma ?? baseline.gamma
  const dBeta = beta - baseline.beta
  const dGamma = gamma - baseline.gamma

  // tiltX/tiltY are raw degree offsets — used for 1:1 saber rotation
  const tiltX = dGamma           // + = phone tilted right
  const tiltY = -dBeta           // + = phone tilted back (up)

  // posX/posY: exaggerated for legacy position-based calculations
  const ax = data.ax ?? 0
  const ay = data.ay ?? 0
  const az = data.az ?? 0
  const swingX = ax * 10
  const swingY = ay * 10

  return {
    ...data,
    tiltX,
    tiltY,
    posX: Math.max(-180, Math.min(180, tiltX * 5 + swingX)),
    posY: Math.max(-180, Math.min(180, tiltY * 5 + swingY)),
    swingSpeed: Math.sqrt(ax * ax + ay * ay + az * az),
    velX: data.velX ?? 0,
    velY: data.velY ?? 0,
    sliceDirection: data.sliceDirection ?? 'none',
    slicePower: data.slicePower ?? 0,
  }
}
