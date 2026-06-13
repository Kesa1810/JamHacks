import type { MotionData } from '../types/motion'

export type TranslationState = {
  posX: number
  posY: number
  velX: number
  velY: number
  refAlpha: number
  refBeta: number
  refGamma: number
  calibrated: boolean
}

const FRICTION = 0.88
const CENTER_SPRING = 0.95
const ACCEL_GAIN = 9
const MAX_ACCEL = 7
const MAX_POS = 160
const MAX_VEL = 240

export function createTranslationState(): TranslationState {
  return {
    posX: 0,
    posY: 0,
    velX: 0,
    velY: 0,
    refAlpha: 0,
    refBeta: 0,
    refGamma: 0,
    calibrated: false,
  }
}

/** W3C device orientation rotation matrix (alpha Z, beta X, gamma Y). */
function orientationMatrix(alpha: number, beta: number, gamma: number): number[][] {
  const d = Math.PI / 180
  const a = alpha * d
  const b = beta * d
  const g = gamma * d
  const cA = Math.cos(a)
  const sA = Math.sin(a)
  const cB = Math.cos(b)
  const sB = Math.sin(b)
  const cG = Math.cos(g)
  const sG = Math.sin(g)

  return [
    [cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG],
    [sA * cG + cA * sB * sG, cA * cB, sA * sG - cA * sB * cG],
    [-cB * sG, sB, cB * cG],
  ]
}

function matTranspose(m: number[][]): number[][] {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ]
}

function matMul(a: number[][], b: number[][]): number[][] {
  const out = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
    }
  }
  return out
}

function matVec(m: number[][], v: [number, number, number]): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

/** Map device linear accel into the frame locked at calibration. */
function accelInReferenceFrame(
  ax: number,
  ay: number,
  az: number,
  alpha: number,
  beta: number,
  gamma: number,
  state: TranslationState,
): [number, number, number] {
  const cur = orientationMatrix(alpha, beta, gamma)
  const ref = orientationMatrix(state.refAlpha, state.refBeta, state.refGamma)
  const refToCur = matMul(matTranspose(ref), cur)
  return matVec(refToCur, [ax, ay, az])
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function calibrateTranslation(
  _state: TranslationState,
  alpha: number,
  beta: number,
  gamma: number,
): TranslationState {
  return {
    posX: 0,
    posY: 0,
    velX: 0,
    velY: 0,
    refAlpha: alpha,
    refBeta: beta,
    refGamma: gamma,
    calibrated: true,
  }
}

type SensorInput = {
  ax: number
  ay: number
  az: number
  alpha: number
  beta: number
  gamma: number
  timestamp: number
}

export function integrateTranslation(
  input: SensorInput,
  state: TranslationState,
): { state: TranslationState; motion: Pick<MotionData, 'posX' | 'posY' | 'swingSpeed'> } {
  let next = state

  if (!state.calibrated) {
    next = calibrateTranslation(state, input.alpha, input.beta, input.gamma)
  }

  const dt = 0.016
  const [sx, sy, sz] = accelInReferenceFrame(
    input.ax,
    input.ay,
    input.az,
    input.alpha,
    input.beta,
    input.gamma,
    next,
  )

  const ax = clamp(sx, -MAX_ACCEL, MAX_ACCEL)
  const ay = clamp(sy, -MAX_ACCEL, MAX_ACCEL)

  // Reference X = left/right, reference Y = up/down (whole-phone movement).
  let velX = next.velX + ax * ACCEL_GAIN * dt
  let velY = next.velY + ay * ACCEL_GAIN * dt

  velX *= FRICTION
  velY *= FRICTION
  velX = clamp(velX, -MAX_VEL, MAX_VEL)
  velY = clamp(velY, -MAX_VEL, MAX_VEL)

  let posX = clamp(next.posX + velX * dt, -MAX_POS, MAX_POS)
  let posY = clamp(next.posY + velY * dt, -MAX_POS, MAX_POS)

  posX *= CENTER_SPRING
  posY *= CENTER_SPRING

  const swingSpeed = Math.sqrt(sx * sx + sy * sy + sz * sz)

  next = { ...next, posX, posY, velX, velY }

  return {
    state: next,
    motion: { posX, posY, swingSpeed },
  }
}
