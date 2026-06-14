import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSettings, saveSettings } from '../lib/settings'
import './SettingsPage.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const init = loadSettings()
  const [swing, setSwing]   = useState(init.swingSensitivity)
  const [tilt,  setTilt]    = useState(init.tiltSensitivity)
  const [saved, setSaved]   = useState(false)

  const handleSave = () => {
    saveSettings({ swingSensitivity: swing, tiltSensitivity: tilt })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="settings-page">
      <button className="settings-back" onClick={() => navigate('/')} type="button">
        ← back
      </button>

      <h1 className="settings-title">Settings</h1>

      <div className="settings-group">
        <label className="setting-label" htmlFor="swing-sens">
          Swing Sensitivity
          <span className="setting-hint">How hard you need to swing to slice a block</span>
        </label>
        <div className="slider-row">
          <span className="slider-tag">gentle</span>
          <input
            id="swing-sens"
            type="range"
            min="0.4"
            max="2.0"
            step="0.1"
            value={swing}
            onChange={(e) => setSwing(parseFloat(e.target.value))}
            className="setting-slider"
          />
          <span className="slider-tag">sharp</span>
        </div>
        <p className="slider-val">{swing.toFixed(1)}×</p>
      </div>

      <div className="settings-group">
        <label className="setting-label" htmlFor="tilt-sens">
          Tilt Sensitivity
          <span className="setting-hint">How much you tilt the phone to switch lanes</span>
        </label>
        <div className="slider-row">
          <span className="slider-tag">subtle</span>
          <input
            id="tilt-sens"
            type="range"
            min="0.4"
            max="2.0"
            step="0.1"
            value={tilt}
            onChange={(e) => setTilt(parseFloat(e.target.value))}
            className="setting-slider"
          />
          <span className="slider-tag">precise</span>
        </div>
        <p className="slider-val">{tilt.toFixed(1)}×</p>
      </div>

      <button className="settings-save" onClick={handleSave} type="button">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
