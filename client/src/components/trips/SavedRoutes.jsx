import { useCallback, useEffect, useState } from 'react';
import { useRoutes, routeSignature } from '../../context/RoutesContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { loadTrips, saveTrip, deleteTrip as apiDeleteTrip } from '../../services/trips';
import { track } from '../../services/analytics';

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
  return `${(m / 1000).toFixed(1)} km`;
}

function formatMin(s) {
  if (s == null) return null;
  const min = Math.round(s / 60);
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}

// A server trip (from /api/trips) reshaped to look like a locally stored route,
// so one list can render both. It has no geometry, so reopening recomputes it.
function fromServerTrip(t) {
  let places = [];
  try {
    places = typeof t.places === 'string' ? JSON.parse(t.places) : (t.places || []);
  } catch (_) { places = []; }
  return {
    id: `srv-${t.id}`,
    serverId: t.id,
    city: t.city || 'la zona',
    country: t.country || '',
    origin_lat: t.origin_lat,
    origin_lng: t.origin_lng,
    transport: t.transport_mode || 'walking',
    places,
    distance: t.route_distance ?? null,
    duration: t.route_duration ?? null,
    geometry: null,
    createdAt: t.created_at ? new Date(t.created_at).getTime() : 0,
    remote: true,
  };
}

// The "Rutas" tab. Local routes are the source of truth (they carry geometry and
// work offline); when signed in, server routes from other devices are merged in.
export default function SavedRoutes({ onOpenRoute, onExplore }) {
  const { routes, removeRoute, markSynced } = useRoutes();
  const { authEnabled, isAuthenticated, getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [remote, setRemote] = useState([]);

  // Pull routes saved from other devices.
  useEffect(() => {
    if (!isAuthenticated) { setRemote([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const data = await loadTrips(token);
        if (!cancelled) setRemote(Array.isArray(data) ? data.map(fromServerTrip) : []);
      } catch (_) { /* the local list still works */ }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, getAccessToken]);

  // Push local routes up the first time the user signs in, so creating an account
  // never loses what they already built. Only routes with no server id are sent.
  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = routes.filter((r) => !r.syncedId);
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        for (const r of pending) {
          if (cancelled) return;
          try {
            const saved = await saveTrip({
              city: r.city,
              country: r.country,
              origin_lat: r.origin_lat,
              origin_lng: r.origin_lng,
              theme: 'mixed',
              transport_mode: r.transport,
              places: r.places,
              route_distance: r.distance,
              route_duration: r.duration,
            }, token);
            if (!cancelled) markSynced(r.id, saved?.id ?? true);
          } catch (_) { /* retry on a later mount */ }
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, routes.length]);

  const handleDelete = useCallback(async (route) => {
    if (route.remote) {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await apiDeleteTrip(route.serverId, token);
        setRemote((prev) => prev.filter((r) => r.id !== route.id));
        showToast('Ruta eliminada', 'success');
      } catch (_) {
        showToast('No se pudo eliminar la ruta', 'error');
      }
      return;
    }
    removeRoute(route.id);
    showToast('Ruta eliminada', 'success');
  }, [getAccessToken, removeRoute, showToast]);

  // Merge: a local copy always wins over the same route fetched from the server.
  const localSignatures = new Set(routes.map(routeSignature));
  const merged = [
    ...routes,
    ...remote.filter((r) => r.places.length >= 2 && !localSignatures.has(routeSignature(r))),
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (merged.length === 0) {
    return (
      <section className="saved-view">
        <h2 className="saved-view-title">Tus rutas</h2>
        <div className="saved-empty">
          <div className="saved-empty-icon" aria-hidden="true">🧭</div>
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
        {authEnabled && !isAuthenticated && ' Inicia sesión para tenerlas en todos tus dispositivos.'}
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
