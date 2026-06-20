import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSaved } from '../../context/SavedContext';

export default function ProfileView() {
  const { authEnabled, isAuthenticated, user, login, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { saved } = useSaved();

  const places = saved.filter((s) => s.kind !== 'restaurant').length;
  const restaurants = saved.length - places;

  return (
    <section className="profile-view">
      <h2 className="profile-title">Perfil</h2>

      <div className="profile-card">
        {authEnabled && isAuthenticated ? (
          <div className="profile-account">
            {user?.picture && (
              <img src={user.picture} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
            )}
            <div className="profile-account-text">
              <span className="profile-name">{user?.name || 'Tu cuenta'}</span>
              {user?.email && <span className="profile-email">{user.email}</span>}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        ) : authEnabled ? (
          <div className="profile-account profile-account--guest">
            <div className="profile-account-text">
              <span className="profile-name">Estás explorando sin cuenta</span>
              <span className="profile-email">Inicia sesión para sincronizar tus rutas guardadas.</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={login}>
              Iniciar sesión
            </button>
          </div>
        ) : (
          <div className="profile-account profile-account--guest">
            <div className="profile-account-text">
              <span className="profile-name">Sin registro</span>
              <span className="profile-email">Usas la app libremente. Tus guardados se quedan en este dispositivo.</span>
            </div>
          </div>
        )}
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

        <a className="profile-row" href="#como-funciona">
          <span className="profile-row-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 1.8-2.5 3.7M12 17h.01" /></svg>
          </span>
          <span className="profile-row-label">Cómo funciona</span>
          <span className="profile-row-chevron" aria-hidden="true">›</span>
        </a>
      </div>
    </section>
  );
}
