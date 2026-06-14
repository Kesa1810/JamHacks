import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ChooseMapPage.css'

const ALL_MAPS = [
  { key: 'beauty-and-a-beat', title: 'Beauty And A Beat', artist: 'Justin Bieber', diff: 'Easy',   emoji: '🌸', bpm: 130 },
  { key: 'animals',           title: 'Animals',           artist: 'Martin Garrix', diff: 'Hard',   emoji: '🦊', bpm: 128 },
]

interface Props {
  currentMap: string
  onSelect: (key: string) => void
}

export function ChooseMapPage({ currentMap, onSelect }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const results = ALL_MAPS.filter((m) => {
    const q = query.toLowerCase()
    return !q || m.title.toLowerCase().includes(q) || m.artist.toLowerCase().includes(q)
  })

  const handleSelect = (key: string) => {
    onSelect(key)
    navigate('/')
  }

  return (
    <div className="cmp-page">
      <button className="cmp-back" onClick={() => navigate('/')} type="button">← back</button>
      <h1 className="cmp-title">Choose a Map</h1>

      <div className="cmp-search-wrap">
        <span className="cmp-search-icon">🔍</span>
        <input
          className="cmp-search"
          type="text"
          placeholder="Search songs or artists…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
        />
        {query && (
          <button className="cmp-clear" onClick={() => setQuery('')} type="button" aria-label="Clear">✕</button>
        )}
      </div>

      <p className="cmp-results-label">
        {results.length === 0
          ? 'No songs found'
          : `${results.length} song${results.length !== 1 ? 's' : ''}`}
      </p>

      <div className="cmp-list">
        {results.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`cmp-row ${currentMap === m.key ? 'cmp-row--active' : ''}`}
            onClick={() => handleSelect(m.key)}
          >
            <span className="cmp-emoji">{m.emoji}</span>
            <div className="cmp-info">
              <p className="cmp-song">{m.title}</p>
              <p className="cmp-artist">{m.artist}</p>
            </div>
            <div className="cmp-meta">
              <span className={`cmp-diff cmp-diff--${m.diff.toLowerCase()}`}>{m.diff}</span>
              <span className="cmp-bpm">{m.bpm} BPM</span>
            </div>
            {currentMap === m.key && <span className="cmp-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
