export interface RunRecord {
  score: number
  accuracy: number
  hits: number
  misses: number
  durationMs: number
  timestamp: number
}

const KEY = 'forestBeatsStats'

export function loadStats(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveRun(run: RunRecord) {
  const all = loadStats()
  all.push(run)
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch {}
}

export function clearStats() {
  localStorage.removeItem(KEY)
}

export function computeSummary(runs: RunRecord[]) {
  if (runs.length === 0) return null
  const totalMs   = runs.reduce((s, r) => s + (r.durationMs ?? 0), 0)
  const avgAcc    = Math.round(runs.reduce((s, r) => s + r.accuracy, 0) / runs.length)
  const highAcc   = Math.max(...runs.map((r) => r.accuracy))
  const avgScore  = Math.round(runs.reduce((s, r) => s + r.score, 0)    / runs.length)
  const highScore = Math.max(...runs.map((r) => r.score))
  return { totalMs, avgAcc, highAcc, avgScore, highScore, gamesPlayed: runs.length }
}
