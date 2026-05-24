import { useTrip } from '../../context/TripContext';
import { THEMES } from '../../constants/themes';
import Icon from '../ui/Icon';

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
          <Icon name={theme.iconName} size={15} />
          {theme.label}
        </button>
      ))}
    </div>
  );
}
