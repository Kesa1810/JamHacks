/**
 * Adaptive motion profile - learns each user's swing style over time and
 * adjusts the detection threshold to match. Persists to localStorage so the
 * calibration carries across sessions.
 *
 * How it works:
 *  - Every confirmed hit records the angular velocity that triggered it.
 *  - The threshold is kept at ~60% of the user's average hit speed, so weaker
 *    swings still register without false-positives.
 *  - Every "near-miss" (raw accel spike but no trigger) nudges the threshold
 *    down slightly so the system becomes more sensitive over time.
 *  - Clamps between MIN and MAX so it never becomes unusable.
 */

const STORAGE_KEY = 'fb_motion_profile_v1'
const DEFAULT_THRESHOLD = 90    // deg/s starting point
const MIN_THRESHOLD     = 35    // never lower than this
const MAX_THRESHOLD     = 180   // never higher than this
const EMA_ALPHA         = 0.25  // weight of each new observation (higher = adapts faster)
const MISS_NUDGE        = 3     // deg/s drop per near-miss

export type MotionProfile = {
  threshold: number         // current angular velocity threshold (deg/s)
  avgHitSpeed: number       // EMA of angular velocity at hit time
  hitCount: number          // total confirmed hits recorded
  nearMissCount: number     // total near-misses recorded
  lastUpdated: number       // timestamp ms
}

function defaultProfile(): MotionProfile {
  return {
    threshold: DEFAULT_THRESHOLD,
    avgHitSpeed: DEFAULT_THRESHOLD * 1.5,
    hitCount: 0,
    nearMissCount: 0,
    lastUpdated: Date.now(),
  }
}

export function loadProfile(): MotionProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProfile()
    const parsed = JSON.parse(raw) as Partial<MotionProfile>
    return { ...defaultProfile(), ...parsed }
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(profile: MotionProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // storage not available - ignore
  }
}

/**
 * Call this when a swing was successfully detected and matched a note.
 * speed = the angular velocity (deg/s) that produced the hit.
 */
export function updateOnHit(profile: MotionProfile, speed: number): MotionProfile {
  const newAvg = profile.avgHitSpeed * (1 - EMA_ALPHA) + speed * EMA_ALPHA
  // Threshold = 60% of average hit speed.  Gives room for weaker swings.
  const newThreshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, newAvg * 0.6))
  return {
    ...profile,
    avgHitSpeed: newAvg,
    threshold: newThreshold,
    hitCount: profile.hitCount + 1,
    lastUpdated: Date.now(),
  }
}

/**
 * Call this when the phone moved fast (swingSpeed > accel threshold) but no
 * swing was registered - the user probably tried to swing and we missed it.
 */
export function updateOnNearMiss(profile: MotionProfile): MotionProfile {
  const newThreshold = Math.max(MIN_THRESHOLD, profile.threshold - MISS_NUDGE)
  return {
    ...profile,
    threshold: newThreshold,
    nearMissCount: profile.nearMissCount + 1,
    lastUpdated: Date.now(),
  }
}

/** Reset to factory defaults (useful for debug / new user). */
export function resetProfile(): MotionProfile {
  const p = defaultProfile()
  saveProfile(p)
  return p
}

// --- Server-side collective learning -----------------------------------------

type GlobalProfile = {
  recommendedThreshold: number | null
  dataPoints: number
  totalSwings: number
}

/**
 * Fetch the crowd-sourced global profile from the server and blend it into
 * the local profile. Only overrides the threshold if the server has enough
 * real data (dataPoints >= MIN_CROWD_SESSIONS) AND the local profile hasn't
 * been calibrated from real play yet.
 *
 * The blend weight favours local calibration once the user has swings recorded,
 * so a veteran player is never forced back to the crowd average.
 */
const MIN_CROWD_SESSIONS = 5  // need at least this many sessions before trusting global

export async function blendGlobalProfile(local: MotionProfile): Promise<MotionProfile> {
  try {
    const res = await fetch('/api/motion-profile')
    if (!res.ok) return local
    const global: GlobalProfile = await res.json()

    if (!global.recommendedThreshold || global.dataPoints < MIN_CROWD_SESSIONS) {
      return local  // not enough crowd data yet - stay local
    }

    // Blend: if user has no personal history, use crowd fully.
    // As they accumulate hits, their own calibration takes over.
    const localWeight  = Math.min(1, local.hitCount / 20)   // 0->1 over 20 hits
    const crowdWeight  = 1 - localWeight

    const blendedThreshold =
      local.threshold  * localWeight +
      global.recommendedThreshold * crowdWeight

    const blendedSpeed =
      local.avgHitSpeed * localWeight +
      (global.recommendedThreshold / 0.6) * crowdWeight  // reverse-engineer avgHitSpeed

    return {
      ...local,
      threshold:    Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, blendedThreshold)),
      avgHitSpeed:  blendedSpeed,
    }
  } catch {
    return local  // server unreachable - fall back to local
  }
}

/**
 * Submit this session's calibration data to the server so future players
 * benefit from it. Only submits if the session had enough real swings.
 */
export async function submitSessionToServer(profile: MotionProfile): Promise<void> {
  if (profile.hitCount < 8) return  // too few hits to be trustworthy

  try {
    await fetch('/api/motion-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avgHitSpeed: profile.avgHitSpeed,
        threshold:   profile.threshold,
        hitCount:    profile.hitCount,
      }),
    })
  } catch {
    // non-fatal - just don't contribute this session
  }
}
