import type { MotionData } from '../types/motion'

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export function smoothToward(current: number, target: number, factor: number) {
  return current + (target - current) * factor
}

export function smoothMotion(
  current: MotionData,
  target: MotionData,
  factor: number,
): MotionData {
  const dx = target.posX - current.posX
  const dy = target.posY - current.posY
  const delta = Math.sqrt(dx * dx + dy * dy)
  // Slow when still (reduces jitter), faster on deliberate moves.
  const adaptive =
    delta < 8 ? Math.min(0.22, factor) : Math.min(0.42, factor + delta * 0.0015)

  return {
    ...target,
    posX: smoothToward(current.posX, target.posX, adaptive),
    posY: smoothToward(current.posY, target.posY, adaptive),
    velX: smoothToward(current.velX, target.velX, adaptive),
    velY: smoothToward(current.velY, target.velY, adaptive),
    sliceDirection: target.slicePower >= current.slicePower ? target.sliceDirection : current.sliceDirection,
    slicePower: smoothToward(current.slicePower, target.slicePower, Math.min(0.9, adaptive * 1.6)),
    swingSpeed: smoothToward(current.swingSpeed, target.swingSpeed, Math.min(0.9, adaptive * 1.4)),
  }
}

export function emptySmoothedMotion(): MotionData {
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
    velX: 0,
    velY: 0,
    sliceDirection: 'none',
    slicePower: 0,
    swingSpeed: 0,
    timestamp: 0,
  }
}

export { clamp }
