import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

// Built routes live in localStorage so the app keeps them for EVERYONE, with no
// sign-up — same promise as SavedContext favourites. Before this, a route was
// only persisted when authenticated, so an anonymous user could build one and
// then be told in the "Rutas" tab that they had none.
//
// The stored copy includes the route geometry, which makes reopening a saved
// route instant and completely free: no /api/generate-trip (Google Places), no
// /api/route (OpenRouteService quota) — it renders straight from the device.
const STORAGE_KEY = 'randomtrip:routes';
const MAX_ROUTES = 20;

const RoutesContext = createContext(null);

// Identity of a route: same city + same stops in the same order = same route, so
// rebuilding an identical route refreshes the existing entry instead of piling up
// duplicates.
export function routeSignature(route) {
  const stops = (route.places || []).map((p) => `${p.name}|${p.lat}|${p.lng}`).join('>');
  return `${(route.city || '').toLowerCase()}::${stops}`;
}

function loadRoutes() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && Array.isArray(r.places) && r.places.length) : [];
  } catch (_) {
    return [];
  }
}

export function RoutesProvider({ children }) {
  const [allRoutes, setAllRoutes] = useState(loadRoutes);
  const { user } = useAuth();
  // Auth0 `sub`, which is also the user_id the backend stores. null = built while
  // signed out.
  const currentOwner = user?.sub || null;
  const setRoutes = setAllRoutes;

  // What the current identity may see. A route built while signed out (ownerId
  // null) belongs to the device and stays visible; a route built under an account
  // is only shown to that account. Without this, a second person signing in on a
  // shared browser saw — and silently uploaded — the previous person's routes,
  // which carry the coordinates they were standing at.
  const routes = useMemo(
    () => allRoutes.filter((r) => !r.ownerId || r.ownerId === currentOwner),
    [allRoutes, currentOwner]
  );

  useEffect(() => {
    // Always persist the FULL list, not the filtered view, so signing out doesn't
    // destroy another account's saved routes.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allRoutes));
    } catch (_) {
      // Quota exceeded or private mode: keep the in-memory list working rather
      // than breaking the tab. Geometry is the bulky part, so drop it and retry
      // once — a route without geometry still reopens (it just recomputes).
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(allRoutes.map((r) => ({ ...r, geometry: null })))
        );
      } catch (_) { /* give up silently */ }
    }
  }, [allRoutes]);

  // Called automatically whenever a route is built. `trip` is the TripContext
  // shape; we keep only what's needed to render it again.
  const saveRoute = useCallback((trip, extra = {}) => {
    if (!trip || !Array.isArray(trip.places) || trip.places.length < 2) return null;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      city: trip.city || 'la zona',
      country: trip.country || '',
      origin_lat: trip.origin_lat,
      origin_lng: trip.origin_lng,
      transport: trip.transport || 'walking',
      places: trip.places,
      distance: extra.distance ?? trip.route_distance ?? null,
      duration: extra.duration ?? trip.route_duration ?? null,
      geometry: extra.geometry ?? null,
      shareSlug: trip.shareSlug || null,
      createdAt: Date.now(),
      syncedId: null,
      // Who built it: the signed-in account, or null when signed out. Gates both
      // visibility and what may be uploaded to an account.
      ownerId: currentOwner,
    };
    const sig = routeSignature(entry);
    setRoutes((prev) => {
      // Only collapse against a route this identity can see, so two accounts on
      // one device don't overwrite each other's copy of the same city walk.
      const visible = (r) => !r.ownerId || r.ownerId === currentOwner;
      const existing = prev.find((r) => visible(r) && routeSignature(r) === sig);
      // Rebuilt the same route: refresh it in place (keeping any server id) and
      // move it to the top instead of adding a duplicate.
      const kept = prev.filter((r) => r !== existing);
      const merged = existing
        ? { ...entry, id: existing.id, syncedId: existing.syncedId, shareSlug: entry.shareSlug || existing.shareSlug }
        : entry;
      return [merged, ...kept].slice(0, MAX_ROUTES);
    });
    return entry;
  }, [currentOwner]);

  const removeRoute = useCallback((id) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // On a successful upload, record the server id AND bind the route to the
  // account that now holds it, so it is never offered to a different account.
  const markSynced = useCallback((id, syncedId, ownerId) => {
    setRoutes((prev) => prev.map((r) => (
      r.id === id ? { ...r, syncedId, ownerId: ownerId ?? r.ownerId ?? null } : r
    )));
  }, []);

  const setShareSlug = useCallback((id, slug) => {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, shareSlug: slug } : r)));
  }, []);

  return (
    <RoutesContext.Provider value={{ routes, saveRoute, removeRoute, markSynced, setShareSlug }}>
      {children}
    </RoutesContext.Provider>
  );
}

export function useRoutes() {
  const ctx = useContext(RoutesContext);
  if (!ctx) throw new Error('useRoutes must be used within RoutesProvider');
  return ctx;
}
