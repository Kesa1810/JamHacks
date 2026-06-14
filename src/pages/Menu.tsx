import React from 'react';
import './Menu.css';

interface MenuProps {
  selectedMap: string
  onPlay: () => void
  onStats: () => void
  onSettings: () => void
  onChooseBlocks: () => void
  onChooseMap: () => void
}

const MAP_LABELS: Record<string, string> = {
  'beauty-and-a-beat': 'Beauty And A Beat',
  'animals': 'Animals',
}

const Menu: React.FC<MenuProps> = ({ selectedMap, onPlay, onStats, onSettings, onChooseBlocks, onChooseMap }) => {
  const sparkles = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    top: `${4 + (index * 5) % 86}%`,
    left: `${5 + (index * 9) % 88}%`,
    size: 4 + (index % 4) * 2,
    delay: `${(index % 6) * 0.25}s`,
    opacity: 0.3 + (index % 5) * 0.08,
    tint: ['#b8d898', '#f5c842', '#f4a8c4', '#78c1f3'][index % 4],
  }));

  const menuItems: { label: string; action: () => void; sub?: string }[] = [
    { label: 'play',          action: onPlay },
    { label: 'choose map',    action: onChooseMap,    sub: MAP_LABELS[selectedMap] ?? selectedMap },
    { label: 'choose blocks', action: onChooseBlocks },
    { label: 'settings',      action: onSettings },
    { label: 'stats',         action: onStats },
  ]

  return (
    <div className="menu-container">
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
          <p className="eyebrow">rhythm game · swing your phone</p>
          <h1 className="game-title">Rhythm Crossing</h1>
          <p className="game-subtitle">slice blocks with your phone. don't miss.</p>
        </header>

        <nav className="button-group" aria-label="main menu">
          {menuItems.map(({ label, action, sub }) => (
            <button
              key={label}
              className="menu-button"
              onClick={action}
              type="button"
            >
              <span className="menu-button-label">{label}</span>
              {sub && <span className="menu-button-sub">{sub}</span>}
            </button>
          ))}
        </nav>

        <footer className="menu-footer">
          <p>v1.0.0 · initial release</p>
        </footer>
      </main>
    </div>
  );
};

export default Menu;
