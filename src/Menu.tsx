import React from 'react';
import './Menu.css';

interface MenuProps {
  onPlay: () => void
}

const Menu: React.FC<MenuProps> = ({ onPlay }) => {
  const handleAction = (action: string) => {
    if (action === 'play / resume') { onPlay(); return; }
    console.log(`${action} clicked`);
  };

  const menuOptions = ['play / resume', 'choose map', 'settings', 'stats', 'credits', 'exit'];
  const sparkles = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    top: `${4 + (index * 5) % 86}%`,
    left: `${5 + (index * 9) % 88}%`,
    size: 4 + (index % 4) * 2,
    delay: `${(index % 6) * 0.25}s`,
    opacity: 0.25 + (index % 5) * 0.08,
    tint: ['#d4e8b0', '#c8d8a8', '#e8dcc8', '#b8c898'][index % 4],
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
              background: `radial-gradient(circle, #e8f0d0, ${sparkle.tint})`,
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

        <footer className="menu-footer">
          <p>v0.1.0 - glowing forest mode</p>
        </footer>
      </main>
    </div>
  );
};

export default Menu;
