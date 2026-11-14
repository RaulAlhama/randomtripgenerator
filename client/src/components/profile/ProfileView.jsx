import { useTheme } from '../../context/ThemeContext';
import { useSaved } from '../../context/SavedContext';

export default function ProfileView() {
  const { isDark, toggleTheme } = useTheme();
  const { saved } = useSaved();

  const places = saved.filter((s) => s.kind !== 'restaurant').length;
  const restaurants = saved.length - places;

  return (
    <section className="profile-view">
      <h2 className="profile-title">Perfil</h2>

      <div className="profile-card">
        <div className="profile-account">
          <div className="profile-account-text">
            <span className="profile-name">Sin registro</span>
            <span className="profile-email">Usas la app libremente. Tus guardados se quedan en este dispositivo.</span>
          </div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-num">{places}</span>
          <span className="profile-stat-label">Sitios guardados</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-num">{restaurants}</span>
          <span className="profile-stat-label">Restaurantes</span>
        </div>
      </div>

      <div className="profile-list">
        <button type="button" className="profile-row" onClick={toggleTheme}>
          <span className="profile-row-icon" aria-hidden="true">
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
            )}
          </span>
          <span className="profile-row-label">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
          <span className="profile-row-chevron" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}
