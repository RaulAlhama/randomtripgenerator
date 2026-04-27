import { useTrip } from '../../context/TripContext';
import { THEMES } from '../../constants/themes';

export default function ThemeSelector() {
  const { selectedTheme, setTheme } = useTrip();

  return (
    <div className="theme-selector">
      <div className="theme-grid">
        {THEMES.map((theme) => {
          const isActive = selectedTheme === theme.key;
          return (
            <button
              key={theme.key}
              type="button"
              className={`theme-card${isActive ? ' active' : ''}`}
              style={{ '--theme-accent': theme.accent }}
              onClick={() => setTheme(theme.key)}
              aria-pressed={isActive}
            >
              <span className="theme-icon" aria-hidden="true">{theme.icon}</span>
              <span className="theme-text">
                <span className="theme-name">{theme.label}</span>
                <span className="theme-desc">{theme.description}</span>
              </span>
              {isActive && (
                <span className="theme-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
