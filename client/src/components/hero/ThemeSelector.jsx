import { useTrip } from '../../context/TripContext';
import { THEMES } from '../../constants/themes';

export default function ThemeSelector() {
  const { selectedTheme, setTheme } = useTrip();

  return (
    <div className="theme-chips">
      {THEMES.map((theme) => (
        <button
          key={theme.key}
          type="button"
          className={`theme-chip${selectedTheme === theme.key ? ' active' : ''}`}
          onClick={() => setTheme(theme.key)}
          aria-pressed={selectedTheme === theme.key}
        >
          <span aria-hidden="true">{theme.icon}</span>
          {theme.label}
        </button>
      ))}
    </div>
  );
}
