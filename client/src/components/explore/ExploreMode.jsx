import { useCallback, useEffect, useRef, useState } from 'react';
import { useTrip, formatDuration } from '../../context/TripContext';
import { fetchRestaurants } from '../../services/api';
import { THEMES } from '../../constants/themes';
import ExploreMap from './ExploreMap';
import ExploreSheet from './ExploreSheet';
import SpotCard from './SpotCard';
import RestaurantStrip from './RestaurantStrip';

// Explore mode assumes the user is on foot with spare time right now.
const EXPLORE_RADIUS_KM = 2;
const RESTAURANT_RADIUS_M = 1500;

// ?lat=&lng= lets you test explore mode without granting browser geolocation.
function urlLocationOverride() {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function gmapsDirectionsUrl(origin, places) {
  if (!places.length) return null;
  const dest = places[places.length - 1];
  const waypoints = places.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}` +
    `&destination=${dest.lat},${dest.lng}&travelmode=walking`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function ExploreMode({ onClose }) {
  const {
    currentTrip,
    candidates,
    stage,
    isGenerating,
    generationError,
    statusMessage,
    selectedKeys,
    weather,
    routeGeometry,
    routeDistance,
    routeDuration,
    poiKey,
    toggleCandidate,
    generateCandidates,
    buildRouteFromSelection,
    backToCandidates,
    shareTrip,
    closeTrip,
    clearError,
  } = useTrip();

  const [restaurants, setRestaurants] = useState(null); // null = not fetched yet
  const [activeTheme, setActiveTheme] = useState('mixed');
  const [snap, setSnap] = useState('half');
  const [flashKey, setFlashKey] = useState(null);
  const launchedRef = useRef(false);
  const cardRefs = useRef({});
  const flashTimer = useRef(null);

  const origin = currentTrip
    ? { lat: currentTrip.origin_lat, lng: currentTrip.origin_lng }
    : null;

  const launch = useCallback((themeKey, knownOrigin) => {
    clearError();
    const loc = knownOrigin || urlLocationOverride();
    generateCandidates({
      theme: themeKey,
      transport: 'walking',
      radius: EXPLORE_RADIUS_KM,
      ...(loc
        ? { locationMode: 'search', searchLocation: loc }
        : { locationMode: 'gps' }),
    });
  }, [generateCandidates, clearError]);

  // Launch once on open.
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    launch('mixed');
  }, [launch]);

  // Restaurants: fetch once we know where the user is. Errors (e.g. Places
  // not configured) just hide the strip — the core flow keeps working.
  useEffect(() => {
    if (!origin || restaurants !== null) return;
    fetchRestaurants(origin.lat, origin.lng, RESTAURANT_RADIUS_M)
      .then((data) => setRestaurants(data.restaurants || []))
      .catch(() => setRestaurants([]));
  }, [origin?.lat, origin?.lng, restaurants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock background scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleClose = useCallback(() => {
    closeTrip();
    onClose();
  }, [closeTrip, onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const handleThemeChange = (key) => {
    if (key === activeTheme || isGenerating) return;
    setActiveTheme(key);
    // Reuse the resolved origin so we don't ask the browser for GPS again.
    launch(key, origin);
  };

  const handleSpotTap = (key) => {
    setSnap((s) => (s === 'peek' ? 'half' : s));
    setFlashKey(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(null), 1600);
    requestAnimationFrame(() => {
      cardRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // ---- Boot states (no candidates yet) ----
  if (!candidates) {
    return (
      <div className="xp-overlay" role="dialog" aria-modal="true" aria-label="Explora ahora">
        <button type="button" className="xp-top-btn xp-boot-close" onClick={handleClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
        {generationError ? (
          <div className="xp-boot">
            <div className="xp-boot-emoji" aria-hidden="true">🧭</div>
            <h2>No hemos podido explorar</h2>
            <p>{generationError}</p>
            <div className="xp-boot-actions">
              <button type="button" className="xp-cta" onClick={() => launch(activeTheme)}>
                Reintentar
              </button>
              <button type="button" className="xp-ghost-btn" onClick={handleClose}>
                Volver al inicio
              </button>
            </div>
          </div>
        ) : (
          <div className="xp-boot">
            <div className="xp-radar" aria-hidden="true">
              <span /><span /><span />
              <div className="xp-radar-dot" />
            </div>
            <h2>Explorando a tu alrededor</h2>
            <p>{statusMessage || 'Buscando lugares cerca de ti…'}</p>
          </div>
        )}
      </div>
    );
  }

  // ---- Ready: map + sheet ----
  const isRoute = stage === 'route';
  const places = isRoute ? (currentTrip?.places || []) : candidates;
  const city = currentTrip?.city || '';
  const selectedCount = selectedKeys.size;
  const dirUrl = isRoute && origin ? gmapsDirectionsUrl(origin, places) : null;

  const candidatesHeader = (
    <>
      <div className="xp-head-row">
        <div className="xp-head-text">
          <span className="xp-head-title">Cerca de ti{city ? ` · ${city}` : ''}</span>
          <span className="xp-head-sub">
            {candidates.length} sitios a menos de {EXPLORE_RADIUS_KM} km · toca para elegir
          </span>
        </div>
      </div>
      <button
        type="button"
        className="xp-cta"
        disabled={selectedCount < 2 || isGenerating}
        onClick={buildRouteFromSelection}
      >
        {isGenerating ? 'Calculando ruta…' : `Crear ruta con esto · ${selectedCount}`}
      </button>
    </>
  );

  const routeHeader = (
    <>
      <div className="xp-head-row">
        <div className="xp-head-text">
          <span className="xp-head-title">Tu ruta{city ? ` por ${city}` : ''}</span>
          <span className="xp-head-sub">
            {routeDistance != null && `${(routeDistance / 1000).toFixed(1)} km`}
            {routeDuration != null && ` · ${formatDuration(routeDuration)} a pie`}
            {` · ${places.length} paradas`}
          </span>
        </div>
      </div>
      <div className="xp-head-actions">
        {dirUrl && (
          <a className="xp-cta" href={dirUrl} target="_blank" rel="noopener noreferrer">
            Empezar en Google Maps
          </a>
        )}
        <button type="button" className="xp-ghost-btn" onClick={backToCandidates}>
          Cambiar sitios
        </button>
        <button type="button" className="xp-ghost-btn" onClick={shareTrip} aria-label="Compartir ruta">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        </button>
      </div>
    </>
  );

  return (
    <div className="xp-overlay" role="dialog" aria-modal="true" aria-label="Explora ahora">
      <ExploreMap
        origin={origin}
        places={places}
        stage={stage}
        selectedKeys={selectedKeys}
        poiKey={poiKey}
        restaurants={restaurants || []}
        routeGeometry={isRoute ? routeGeometry : null}
        onSpotTap={handleSpotTap}
      />

      <div className="xp-top">
        <button type="button" className="xp-top-btn" onClick={handleClose} aria-label="Cerrar exploración">
          <CloseIcon />
        </button>
        <div className="xp-top-spacer" />
        {weather && (
          <div className="xp-top-pill" title={weather.desc}>
            <span aria-hidden="true">{weather.icon}</span> {weather.temp}°
          </div>
        )}
      </div>

      {!isRoute && (
        <div className="xp-themes" role="tablist" aria-label="Temática">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === activeTheme}
              className={`xp-chip${t.key === activeTheme ? ' is-on' : ''}`}
              onClick={() => handleThemeChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <ExploreSheet
        snap={snap}
        onSnapChange={setSnap}
        refreshing={isGenerating}
        handle={isRoute ? routeHeader : candidatesHeader}
      >
        {isRoute ? (
          <>
            <ol className="xp-stops">
              {places.map((p, i) => (
                <li key={poiKey(p)} className="xp-stop">
                  <span className="xp-stop-num">{i + 1}</span>
                  <div className="xp-stop-info">
                    <span className="xp-stop-name">{p.name}</span>
                    {p.description && <span className="xp-stop-desc">{p.description}</span>}
                  </div>
                </li>
              ))}
            </ol>
            <RestaurantStrip restaurants={restaurants || []} title="Para reponer fuerzas" />
          </>
        ) : (
          <div className="xp-list">
            {candidates.map((p, i) => {
              const key = poiKey(p);
              const card = (
                <SpotCard
                  key={key}
                  place={p}
                  city={city}
                  selected={selectedKeys.has(key)}
                  onToggle={() => toggleCandidate(key)}
                  distanceKm={origin ? haversineKm(origin.lat, origin.lng, p.lat, p.lng) : 0}
                  highlighted={flashKey === key}
                  innerRef={(el) => { cardRefs.current[key] = el; }}
                />
              );
              // Surface the restaurant strip early without burying the spots.
              if (i === 2 && restaurants?.length > 0) {
                return (
                  <div key={`${key}-with-rest`} className="xp-list-chunk">
                    {card}
                    <RestaurantStrip restaurants={restaurants} />
                  </div>
                );
              }
              return card;
            })}
          </div>
        )}
      </ExploreSheet>
    </div>
  );
}
