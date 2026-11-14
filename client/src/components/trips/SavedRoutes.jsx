import { useCallback } from 'react';
import { useRoutes } from '../../context/RoutesContext';
import { useToast } from '../../context/ToastContext';
import { track } from '../../services/analytics';
import { formatKm as kmLabel } from '../../lib/format';
import Icon from '../ui/Icon';

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `hoy, ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatKm(m) {
  if (m == null) return null;
  return kmLabel(m);
}

function formatMin(s) {
  if (s == null) return null;
  const min = Math.round(s / 60);
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}

// The "Rutas" tab: the routes built on this device (they carry geometry and
// reopen without any request).
export default function SavedRoutes({ onOpenRoute, onExplore }) {
  const { routes, removeRoute } = useRoutes();
  const { showToast } = useToast();

  const handleDelete = useCallback((route) => {
    removeRoute(route.id);
    showToast('Ruta eliminada', 'success');
  }, [removeRoute, showToast]);

  const merged = [...routes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (merged.length === 0) {
    return (
      <section className="saved-view">
        <h2 className="saved-view-title">Tus rutas</h2>
        <div className="saved-empty">
          <div className="saved-empty-icon"><Icon name="route" size={30} /></div>
          <p className="saved-empty-title">Aún no has creado ninguna ruta</p>
          <p className="saved-empty-sub">
            Genera una ruta a pie con los mejores sitios a tu alrededor y se guardará aquí sola.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onExplore('sitios')}>
            Generar mi ruta
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="saved-view">
      <h2 className="saved-view-title">Tus rutas</h2>
      <p className="saved-view-sub">
        Se guardan en este dispositivo, sin necesidad de cuenta.
      </p>

      <ul className="rt-list">
        {merged.map((route) => {
          const km = formatKm(route.distance);
          const min = formatMin(route.duration);
          const when = formatWhen(route.createdAt);
          const preview = route.places.slice(0, 3).map((p) => p.name).join(' · ');
          return (
            <li key={route.id} className="rt-item">
              <button
                type="button"
                className="rt-open"
                onClick={() => {
                  track('saved_route_opened', { city: route.city, stops: route.places.length });
                  onOpenRoute(route);
                }}
              >
                <span className="rt-city">{route.city}</span>
                <span className="rt-meta">
                  {[`${route.places.length} paradas`, km, min].filter(Boolean).join(' · ')}
                  {when && <span className="rt-when"> · {when}</span>}
                </span>
                <span className="rt-preview">{preview}</span>
              </button>
              <button
                type="button"
                className="rt-delete btn-icon"
                onClick={() => handleDelete(route)}
                aria-label={`Eliminar la ruta por ${route.city}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
