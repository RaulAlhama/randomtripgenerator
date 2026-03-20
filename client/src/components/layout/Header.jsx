import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { authEnabled, isAuthenticated, isLoading, user, login, logout } = useAuth();

  return (
    <header className="header">
      <div className="logo">
        <span className="logo-icon">🌍</span>
        <span className="logo-text gradient-text">RandomTrip</span>
      </div>
      <div className="auth-section">
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
          <button className="btn btn-sm btn-outline" onClick={login}>
            Iniciar sesión
          </button>
        ) : (
          <span className="auth-badge">Sin registro necesario</span>
        )}
      </div>
    </header>
  );
}
