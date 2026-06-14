import { useState } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { HostPage } from './pages/HostPage'
import { ControllerPage } from './pages/ControllerPage'
import Menu from './Menu'

export interface GameSettings {
  leadTime: number
  hitWindow: number
  volume: number
}

export interface RunStats {
  score: number
  maxCombo: number
  hits: number
  misses: number
  accuracy: number
}

const DEFAULT_SETTINGS: GameSettings = { leadTime: 2.6, hitWindow: 0.35, volume: 0.8 }

function loadStats(): RunStats | null {
  try { return JSON.parse(localStorage.getItem('fb_lastStats') || 'null') } catch { return null }
}

function MenuRoute({ settings, onSettingsChange, lastStats }: {
  settings: GameSettings
  onSettingsChange: (s: GameSettings) => void
  lastStats: RunStats | null
}) {
  const navigate = useNavigate()
  return (
    <Menu
      onPlay={() => navigate('/game')}
      settings={settings}
      onSettingsChange={onSettingsChange}
      lastStats={lastStats}
    />
  )
}

function GameRoute({ settings, onGameEnd }: {
  settings: GameSettings
  onGameEnd: (s: RunStats) => void
}) {
  const navigate = useNavigate()
  return <HostPage settings={settings} onGameEnd={onGameEnd} onExit={() => navigate('/')} />
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [lastStats, setLastStats] = useState<RunStats | null>(loadStats)

  const handleGameEnd = (stats: RunStats) => {
    setLastStats(stats)
    localStorage.setItem('fb_lastStats', JSON.stringify(stats))
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <MenuRoute settings={settings} onSettingsChange={setSettings} lastStats={lastStats} />
        } />
        <Route path="/game" element={
          <GameRoute settings={settings} onGameEnd={handleGameEnd} />
        } />
        <Route path="/controller/:sessionId" element={<ControllerPage />} />
      </Routes>
    </BrowserRouter>
  )
}
