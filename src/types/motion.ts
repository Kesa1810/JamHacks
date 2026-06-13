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

  // Tilt phone right → saber moves right. Tilt up → saber moves up.
  const tiltX = dGamma * 6
  const tiltY = -dBeta * 6
  const swingX = (data.ax ?? 0) * 12
  const swingY = (data.ay ?? 0) * 12

  const ax = data.ax ?? 0
  const ay = data.ay ?? 0
  const az = data.az ?? 0

  return {
    ...data,
    posX: Math.max(-180, Math.min(180, tiltX + swingX)),
    posY: Math.max(-180, Math.min(180, tiltY + swingY)),
    swingSpeed: Math.sqrt(ax * ax + ay * ay + az * az),
    velX: data.velX ?? 0,
    velY: data.velY ?? 0,
    sliceDirection: data.sliceDirection ?? 'none',
    slicePower: data.slicePower ?? 0,
  }
}
