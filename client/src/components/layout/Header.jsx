import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from './Logo';

export default function Header() {
  const { authEnabled, isAuthenticated, isLoading, user, login, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the mobile menu on outside click, Escape, or when the viewport grows
  // back to desktop width (where the inline bar takes over).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onResize = () => { if (window.innerWidth > 640) setMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const renderAuthAction = (sm) => {
    if (isLoading) return null;
    if (authEnabled && isAuthenticated) {
      return (
        <div className="user-info">
          {user?.picture && (
            <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
          )}
          <span className="user-name">{user?.name || user?.email || 'Usuario'}</span>
          <button className={`btn ${sm ? 'btn-sm ' : ''}btn-outline`} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      );
    }
    if (authEnabled && !isAuthenticated) {
      return (
        <button className={`btn ${sm ? 'btn-sm ' : ''}btn-primary`} onClick={login}>
          Iniciar sesión
        </button>
      );
    }
    return (
      <span className="auth-badge">
        <span className="auth-badge-dot" aria-hidden="true" />
        Sin registro
      </span>
    );
  };

  return (
    <header className="header">
      <Logo />

      <nav className="header-nav" aria-label="Secciones">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#inspiracion">Inspiración</a>
      </nav>

      {/* Desktop: inline theme toggle + auth action */}
      <div className="header-actions">
        <ThemeToggle />
        {renderAuthAction(false)}
      </div>

      {/* Mobile: single button that opens a config panel */}
      <div className="header-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="header-menu-btn"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>

        {menuOpen && (
          <div className="header-menu" role="menu">
            <a href="#como-funciona" role="menuitem" onClick={() => setMenuOpen(false)}>
              Cómo funciona
            </a>
            <a href="#inspiracion" role="menuitem" onClick={() => setMenuOpen(false)}>
              Inspiración
            </a>
            <div className="header-menu-divider" />
            <button type="button" className="header-menu-item" role="menuitem" onClick={toggleTheme}>
              {isDark ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <div className="header-menu-auth">{renderAuthAction(false)}</div>
          </div>
        )}
      </div>
    </header>
  );
}
