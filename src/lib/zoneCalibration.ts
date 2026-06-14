const STORAGE_KEY = 'forest-beats-zone-cal'

export type ZoneCalibration = {
  leftGamma: number    // gamma when phone is comfortably tilted to the left zone
  centerGamma: number  // gamma at neutral center
  rightGamma: number   // gamma when phone is comfortably tilted to the right zone
  centerBeta: number   // beta at neutral (for vertical centering)
}

export function defaultCalibration(): ZoneCalibration {
  return { leftGamma: -40, centerGamma: 0, rightGamma: 40, centerBeta: 0 }
}

export function loadCalibration(): ZoneCalibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultCalibration(), ...JSON.parse(raw) }
  } catch {}
  return defaultCalibration()
}

export function saveCalibration(cal: ZoneCalibration) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cal)) } catch {}
}

export function resetCalibration(): ZoneCalibration {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  return defaultCalibration()
}

/**
 * Map the phone's current tiltX (= dGamma from baseline) to a screen X position (%).
 * Uses the calibrated left/right gamma values as the endpoints (15% - 85%).
 */
export function saberXFromTilt(tiltX: number, cal: ZoneCalibration): number {
  const leftOffset = cal.leftGamma - cal.centerGamma
  const rightOffset = cal.rightGamma - cal.centerGamma
  const range = rightOffset - leftOffset
  if (Math.abs(range) < 10) return 50
  const t = (tiltX - leftOffset) / range
  return Math.max(8, Math.min(92, 15 + t * 70))
}
