import React, { useState } from 'react';
import './Menu.css';

interface MenuProps {
  onPlay: (mapKey: string) => void
}

const MAPS = [
  { key: 'beauty-and-a-beat', label: 'Beauty And A Beat' },
  { key: 'animals',           label: 'Animals' },
]

const Menu: React.FC<MenuProps> = ({ onPlay }) => {
  const [selectedMap, setSelectedMap] = useState('beauty-and-a-beat')
  const [showMapPicker, setShowMapPicker] = useState(false)

  const handleAction = (action: string) => {
    if (action === 'play / resume') { onPlay(selectedMap); return; }
    if (action === 'choose map') { setShowMapPicker((v) => !v); return; }
    console.log(`${action} clicked`);
  };

  const menuOptions = ['play / resume', 'choose map', 'settings', 'stats', 'exit'];
  const sparkles = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    top: `${4 + (index * 5) % 86}%`,
    left: `${5 + (index * 9) % 88}%`,
    size: 4 + (index % 4) * 2,
    delay: `${(index % 6) * 0.25}s`,
    opacity: 0.3 + (index % 5) * 0.08,
    tint: ['#b8d898', '#f5c842', '#f4a8c4', '#78c1f3'][index % 4],
  }));

  return (
    <div className="menu-container">
      <div className="ambient-layer" aria-hidden="true">
        <span className="ambient-orb orb-one" />
        <span className="ambient-orb orb-two" />
        <span className="ambient-orb orb-three" />
      </div>
      <div className="sparkle-layer" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="sparkle"
            style={{
              top: sparkle.top,
              left: sparkle.left,
              width: sparkle.size,
              height: sparkle.size,
              opacity: sparkle.opacity,
              animationDelay: sparkle.delay,
              background: sparkle.tint,
            }}
          />
        ))}
      </div>

      <main className="menu-card">
        <header className="title-section">
          <p className="eyebrow">rhythm game * swing your phone</p>
          <h1 className="game-title">forest beats</h1>
          <p className="game-subtitle">slice blocks with your phone. don't miss.</p>
        </header>

        <nav className="button-group" aria-label="main menu">
          {menuOptions.map((option) => (
            <button
              key={option}
              className="menu-button"
              onClick={() => handleAction(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </nav>

        {showMapPicker && (
          <div className="map-picker">
            <p className="map-picker-label">select map</p>
            {MAPS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`map-option${selectedMap === m.key ? ' map-option--selected' : ''}`}
                onClick={() => setSelectedMap(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <footer className="menu-footer">
          <p>v0.1.0 - glowing forest mode</p>
        </footer>
      </main>
    </div>
  );
};

export default Menu;
