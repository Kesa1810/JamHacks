export interface GameSettings {
  swingSensitivity: number
  tiltSensitivity: number
  chosenBlock: 'face' | 'blue' | 'red'
  blockMode: '3d' | 'flat'
}

const DEFAULTS: GameSettings = {
  swingSensitivity: 1.0,
  tiltSensitivity: 1.0,
  chosenBlock: 'face',
  blockMode: '3d',
}

const KEY = 'forestBeatsSettings'

export function loadSettings(): GameSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Partial<GameSettings>) {
  const current = loadSettings()
  try { localStorage.setItem(KEY, JSON.stringify({ ...current, ...s })) } catch {}
}
