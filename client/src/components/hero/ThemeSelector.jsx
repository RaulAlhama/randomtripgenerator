import { useTrip } from '../../context/TripContext';
import { THEMES } from '../../constants/themes';

export default function ThemeSelector() {
  const { selectedTheme, setTheme } = useTrip();

  return (
    <div className="theme-selector">
      <div className="theme-grid">
        {THEMES.map((theme) => (
          <button
            key={theme.key}
            className={`theme-card${selectedTheme === theme.key ? ' active' : ''}`}
            style={{ '--theme-bg': theme.bg, '--theme-hover': theme.bgHover }}
            onClick={() => setTheme(theme.key)}
          >
            <span className="theme-icon">{theme.icon}</span>
            <span className="theme-name">{theme.label}</span>
            {selectedTheme === theme.key && <span className="theme-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
