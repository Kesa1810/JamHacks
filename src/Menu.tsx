import React, { useState } from 'react'
import type { GameSettings, RunStats } from './App'
import './Menu.css'

interface MenuProps {
  onPlay: () => void
  settings: GameSettings
  onSettingsChange: (s: GameSettings) => void
  lastStats: RunStats | null
}

const Menu: React.FC<MenuProps> = ({ onPlay, settings, onSettingsChange, lastStats }) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const sparkles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    top: `${4 + (i * 5) % 86}%`,
    left: `${5 + (i * 9) % 88}%`,
    size: 4 + (i % 4) * 2,
    delay: `${(i % 6) * 0.25}s`,
    opacity: 0.35 + (i % 5) * 0.11,
    tint: ['#fff7c8', '#b7f2ff', '#ffd9ef', '#c9ffdf'][i % 4],
  }))

  const handleAction = (action: string) => {
    if (action === 'play / resume') { onPlay(); return }
    if (action === 'settings') { setSettingsOpen(true); return }
    if (action === 'stats') { setStatsOpen(true); return }
  }

  const menuOptions = ['play / resume', 'settings', 'stats', 'choose map', 'credits', 'exit']

  // Block speed slider: higher value = faster (lower leadTime)
  // slider range 1–4: speed=1 → leadTime=4.0 (slow), speed=4 → leadTime=1.0 (fast)
  const speedValue = parseFloat((5 - settings.leadTime).toFixed(1))

  return (
    <div className="menu-container">
      <div className="sparkle-layer" aria-hidden="true">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="sparkle"
            style={{
              top: s.top, left: s.left,
              width: s.size, height: s.size,
              opacity: s.opacity, animationDelay: s.delay,
              background: `linear-gradient(135deg, #ffffff, ${s.tint})`,
            }}
          />
        ))}
      </div>

      <main className="menu-card">
        <button
          className="menu-hamburger"
          onClick={() => { setSettingsOpen(o => !o); setStatsOpen(false) }}
          aria-label="settings"
          type="button"
        >
          ☰
        </button>

        <header className="title-section">
          <p className="eyebrow">rhythm game ✦ swing your phone</p>
          <h1 className="game-title">forest beats</h1>
          <p className="game-subtitle">slice blocks with your phone. don't miss.</p>
        </header>

        <nav className="button-group" aria-label="main menu">
          {menuOptions.map((option) => (
            <button
              key={option}
              className={`menu-button${option === 'play / resume' ? ' menu-button--primary' : ''}`}
              onClick={() => handleAction(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </nav>
      </main>

      {/* Settings overlay */}
      {settingsOpen && (
        <div className="menu-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="menu-overlay-card" onClick={e => e.stopPropagation()}>
            <div className="overlay-header">
              <span className="overlay-title">settings</span>
              <button className="overlay-close" onClick={() => setSettingsOpen(false)} type="button">✕</button>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>block speed</span>
                <span className="setting-value">{speedValue.toFixed(1)}</span>
              </div>
              <div className="slider-track">
                <span className="slider-hint">slow</span>
                <input
                  type="range" min={1} max={4} step={0.1}
                  value={speedValue}
                  onChange={e => onSettingsChange({
                    ...settings,
                    leadTime: parseFloat((5 - Number(e.target.value)).toFixed(2)),
                  })}
                />
                <span className="slider-hint">fast</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>hit window</span>
                <span className="setting-value">{settings.hitWindow.toFixed(2)}s</span>
              </div>
              <div className="slider-track">
                <span className="slider-hint">strict</span>
                <input
                  type="range" min={0.1} max={0.6} step={0.01}
                  value={settings.hitWindow}
                  onChange={e => onSettingsChange({ ...settings, hitWindow: Number(e.target.value) })}
                />
                <span className="slider-hint">forgiving</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span>volume</span>
                <span className="setting-value">{Math.round(settings.volume * 100)}%</span>
              </div>
              <div className="slider-track">
                <span className="slider-hint">0%</span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={settings.volume}
                  onChange={e => onSettingsChange({ ...settings, volume: Number(e.target.value) })}
                />
                <span className="slider-hint">100%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats overlay */}
      {statsOpen && (
        <div className="menu-overlay" onClick={() => setStatsOpen(false)}>
          <div className="menu-overlay-card" onClick={e => e.stopPropagation()}>
            <div className="overlay-header">
              <span className="overlay-title">last run</span>
              <button className="overlay-close" onClick={() => setStatsOpen(false)} type="button">✕</button>
            </div>

            {lastStats ? (
              <div className="stats-grid">
                <div className="stat-item"><span>score</span><strong>{lastStats.score.toLocaleString()}</strong></div>
                <div className="stat-item"><span>max combo</span><strong>{lastStats.maxCombo}×</strong></div>
                <div className="stat-item"><span>accuracy</span><strong>{lastStats.accuracy}%</strong></div>
                <div className="stat-item"><span>hits</span><strong>{lastStats.hits}</strong></div>
                <div className="stat-item"><span>misses</span><strong>{lastStats.misses}</strong></div>
              </div>
            ) : (
              <p className="no-stats">no runs yet — play a song first!</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Menu
