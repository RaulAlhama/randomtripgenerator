// Mobile-app style bottom tab bar. Four sections: explore (home), routes
// (saved trips), saved (favourited places/restaurants) and profile.
function Icon({ name }) {
  const common = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true,
  };
  switch (name) {
    case 'explorar':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
        </svg>
      );
    case 'rutas':
      return (
        <svg {...common}>
          <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" />
          <path d="M8 19h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6" />
        </svg>
      );
    case 'guardados':
      return (
        <svg {...common}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      );
    case 'perfil':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    default:
      return null;
  }
}

const TABS = [
  { id: 'explorar', label: 'Explorar' },
  { id: 'rutas', label: 'Rutas' },
  { id: 'guardados', label: 'Guardados' },
  { id: 'perfil', label: 'Perfil' },
];

export default function BottomNav({ active, onChange, savedCount = 0 }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {TABS.map((t) => {
        const isOn = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`bottom-nav-item${isOn ? ' is-on' : ''}`}
            aria-current={isOn ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            <span className="bottom-nav-icon">
              <Icon name={t.id} />
              {t.id === 'guardados' && savedCount > 0 && (
                <span className="bottom-nav-badge">{savedCount > 99 ? '99+' : savedCount}</span>
              )}
            </span>
            <span className="bottom-nav-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
