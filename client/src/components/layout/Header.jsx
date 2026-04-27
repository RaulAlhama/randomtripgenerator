import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from './Logo';

export default function Header() {
  const { authEnabled, isAuthenticated, isLoading, user, login, logout } = useAuth();

  return (
    <header className="header">
      <Logo />
      <nav className="header-nav" aria-label="Secciones">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#inspiracion">Inspiración</a>
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        {isLoading ? null : authEnabled && isAuthenticated ? (
          <div className="user-info">
            {user?.picture && (
              <img
                src={user.picture}
                alt=""
                className="user-avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="user-name">{user?.name || user?.email || 'Usuario'}</span>
            <button className="btn btn-sm btn-outline" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        ) : authEnabled && !isAuthenticated ? (
          <button className="btn btn-sm btn-primary" onClick={login}>
            Iniciar sesión
          </button>
        ) : (
          <span className="auth-badge">
            <span className="auth-badge-dot" aria-hidden="true" />
            Sin registro
          </span>
        )}
      </div>
    </header>
  );
}
