import type { MotionData } from '../types/motion'

// =============================================================================
// MOTION → GAME: swing detection + 3-lane tilt detection
// =============================================================================
// Two independent jobs, both driven by the phone's motion stream:
//
//   1) SWING  — did the phone move fast enough to count as a slash? One number
//      (intensity) crossing one threshold, debounced so one physical swing fires
//      exactly once. No direction.
//
//   2) LANE   — where is the player standing (left / center / right)? Read gamma
//      (left/right tilt), smooth it, and compare against calibrated boundaries.
// -----------------------------------------------------------------------------

// --- Tunable constants -------------------------------------------------------
export const SWING_THRESHOLD     = 8     // lower if swings don't register, raise if too sensitive
export const REARM_DEBOUNCE_MS   = 200   // raise if one swing hits multiple blocks
export const GAMMA_SMOOTH_WINDOW  = 4    // moving-average samples for lane detection; lower = snappier lane switching
export const STABLE_THRESHOLD_DEG = 3    // degrees of stability needed for calibration; raise if calibration is too picky

// accelerationIncludingGravity has magnitude ~9.81 at rest in any orientation,
// so we measure acceleration BEYOND gravity: ~0 when still, spikes on a swing.
const GRAVITY = 9.81

// =============================================================================
// SWING DETECTION (direction-agnostic, debounced)
// =============================================================================
//   IDLE ──(intensity > SWING_THRESHOLD)──▶ emit + COOLDOWN
//   COOLDOWN ──(REARM_DEBOUNCE_MS elapsed)──▶ IDLE
// -----------------------------------------------------------------------------

export type SimpleSwingState = { cooldownUntil: number }

export function createSimpleSwingDetector(): SimpleSwingState {
  return { cooldownUntil: 0 }
}

/**
 * Feed one motion frame in. Returns swing=true EXACTLY ONCE per physical swing
 * (then ignores motion for REARM_DEBOUNCE_MS). No direction — any swing counts.
 */
export function detectSwing(
  data: MotionData,
  state: SimpleSwingState,
  threshold = SWING_THRESHOLD,
): { state: SimpleSwingState; swing: boolean; intensity: number } {
  const now = data.timestamp || Date.now()
  const intensity = Math.abs(data.swingSpeed - GRAVITY)

  // COOLDOWN: ignore everything until the debounce window passes.
  if (now < state.cooldownUntil) return { state, swing: false, intensity }

  if (intensity > threshold) {
    state.cooldownUntil = now + REARM_DEBOUNCE_MS
    return { state, swing: true, intensity }
  }
  return { state, swing: false, intensity }
}

// =============================================================================
// LANE CALIBRATION + DETECTION (tilt left / center / right → lane 0 / 1 / 2)
// =============================================================================

export type LaneCalibration = {
  leftAngle: number
  centerAngle: number
  rightAngle: number
  leftBoundary: number
  rightBoundary: number
}

/** Build a calibration from the three recorded gamma angles. */
export function makeCalibration(
  leftAngle: number,
  centerAngle: number,
  rightAngle: number,
): LaneCalibration {
  return {
    leftAngle,
    centerAngle,
    rightAngle,
    leftBoundary: (leftAngle + centerAngle) / 2,
    rightBoundary: (centerAngle + rightAngle) / 2,
  }
}

/**
 * Map a (smoothed) gamma angle to lane 0 (LEFT), 1 (CENTER), or 2 (RIGHT).
 * Direction-aware: on some devices tilting left lowers gamma, on others it
 * raises it. We key off the sign of (left → right) so calibration always works.
 */
export function laneFromGamma(gamma: number, cal: LaneCalibration): 0 | 1 | 2 {
  const leftIsLower = cal.leftAngle <= cal.rightAngle
  if (leftIsLower) {
    if (gamma < cal.leftBoundary) return 0
    if (gamma > cal.rightBoundary) return 2
    return 1
  }
  // Inverted device: left tilt produces the larger gamma.
  if (gamma > cal.leftBoundary) return 0
  if (gamma < cal.rightBoundary) return 2
  return 1
}

// --- Gamma smoother: moving average over the last GAMMA_SMOOTH_WINDOW samples
export type GammaSmoother = { push: (g: number) => number; reset: () => void }

export function createGammaSmoother(window = GAMMA_SMOOTH_WINDOW): GammaSmoother {
  const buf: number[] = []
  return {
    push(g: number): number {
      buf.push(g)
      if (buf.length > window) buf.shift()
      return buf.reduce((a, b) => a + b, 0) / buf.length
    },
    reset() {
      buf.length = 0
    },
  }
}

// =============================================================================
// CALIBRATION STABILITY (gamma held still for a window → record the angle)
// =============================================================================
// "Stable" = gamma has not varied more than STABLE_THRESHOLD_DEG over the last
// `windowMs`. Any movement beyond that resets the window.
// -----------------------------------------------------------------------------

export type StabilityTracker = { samples: Array<{ t: number; g: number }> }

export function createStabilityTracker(): StabilityTracker {
  return { samples: [] }
}

/**
 * Feed one gamma reading. Returns `progress` (0→1, how much of the hold window
 * has elapsed while staying still) and, once a full stable window is held,
 * `angle` (the averaged gamma to record). Movement resets the window.
 */
export function pushStability(
  tracker: StabilityTracker,
  gamma: number,
  now: number,
  windowMs = 1000,
): { angle: number | null; progress: number } {
  tracker.samples.push({ t: now, g: gamma })

  // Drop samples older than the hold window.
  while (tracker.samples.length > 1 && now - tracker.samples[0].t > windowMs) {
    tracker.samples.shift()
  }

  const gs = tracker.samples.map((s) => s.g)
  const range = Math.max(...gs) - Math.min(...gs)

  // Moved too much — restart the hold window from this sample.
  if (range > STABLE_THRESHOLD_DEG) {
    tracker.samples = [{ t: now, g: gamma }]
    return { angle: null, progress: 0 }
  }

  const span = now - tracker.samples[0].t
  const progress = Math.min(span / windowMs, 1)
  if (span >= windowMs) {
    return { angle: gs.reduce((a, b) => a + b, 0) / gs.length, progress: 1 }
  }
  return { angle: null, progress }
}
