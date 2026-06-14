import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStats, clearStats, computeSummary } from '../lib/stats'
import './StatsPage.css'

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function StatsPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState(() => loadStats())
  const summary = computeSummary(runs)

  const handleClear = () => {
    clearStats()
    setRuns([])
  }

  return (
    <div className="stats-page">
      <button className="stats-back" onClick={() => navigate('/')} type="button">
        ← back
      </button>

      <h1 className="stats-title">Your Stats</h1>

      {!summary ? (
        <p className="stats-empty">No games played yet. Swing your phone!</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Average Accuracy</p>
              <p className="stat-value">{summary.avgAcc}%</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Highest Accuracy</p>
              <p className="stat-value">{summary.highAcc}%</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Average Score</p>
              <p className="stat-value">{summary.avgScore.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Highest Score</p>
              <p className="stat-value">{summary.highScore.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Total Time Playing</p>
              <p className="stat-value">{formatDuration(summary.totalMs)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Games Played</p>
              <p className="stat-value">{summary.gamesPlayed}</p>
            </div>
          </div>

          <div className="stats-history">
            <p className="stats-history-label">Recent games</p>
            {[...runs].reverse().slice(0, 10).map((r, i) => (
              <div key={i} className="history-row">
                <span className="history-date">{new Date(r.timestamp).toLocaleDateString()}</span>
                <span className="history-score">{r.score.toLocaleString()} pts</span>
                <span className="history-acc">{r.accuracy}%</span>
                <span className="history-time">{formatDuration(r.durationMs)}</span>
              </div>
            ))}
          </div>

          <button className="stats-clear" onClick={handleClear} type="button">
            Clear all stats
          </button>
        </>
      )}
    </div>
  )
}
