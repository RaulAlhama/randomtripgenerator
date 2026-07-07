import { useCallback, useEffect, useRef, useState } from 'react';
import { useTrip, formatDuration } from '../../context/TripContext';
import { fetchRestaurants } from '../../services/api';
import { track } from '../../services/analytics';
import ExploreMap from './ExploreMap';
import ExploreSheet from './ExploreSheet';
import ExploreDeck from './ExploreDeck';
import DeckPlaceCard from './DeckPlaceCard';
import DeckRestaurantCard from './DeckRestaurantCard';
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

export default function ExploreMode({ onClose, initialView = 'sitios', initialLocation = null, initialRadiusKm = null, sharedSlug = null }) {
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
    loadSharedTrip,
    closeTrip,
    clearError,
  } = useTrip();

  const [restaurants, setRestaurants] = useState(null); // null = not fetched yet
  const [view, setView] = useState(initialView);        // 'sitios' | 'restaurantes'
  const [deckIndex, setDeckIndex] = useState(0);
  const [restIndex, setRestIndex] = useState(0);
  const [snap, setSnap] = useState('half');
  // Restaurants the user dropped into the walking route (keyed by placeId).
  const [routeRestaurants, setRouteRestaurants] = useState([]);
  // A built-route stop reopened as a detail card (tap a number / map pin).
  const [cardStop, setCardStop] = useState(null);
  const launchedRef = useRef(false);

  const origin = currentTrip
    ? { lat: currentTrip.origin_lat, lng: currentTrip.origin_lng }
    : null;

  const launch = useCallback(() => {
    clearError();
    // Opened from a share link: load that stored route instead of exploring.
    if (sharedSlug) {
      loadSharedTrip(sharedSlug);
      return;
    }
    // A searched city (from the planner) wins; otherwise ?lat&lng for testing;
    // otherwise fall back to the browser's GPS.
    const loc = initialLocation || urlLocationOverride();
    generateCandidates({
      theme: 'mixed',
      transport: 'walking',
      radius: initialRadiusKm || EXPLORE_RADIUS_KM,
      ...(loc
        ? { locationMode: 'search', searchLocation: loc }
        : { locationMode: 'gps' }),
    });
  }, [generateCandidates, clearError, initialLocation, initialRadiusKm, sharedSlug, loadSharedTrip]);

  // Launch once on open.
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    launch();
  }, [launch]);

  // Restaurants: fetch once we know where the user is. Errors (e.g. Places
  // not configured) just leave an empty deck — the core flow keeps working.
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
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // A reopened stop card closes first; only then does Escape exit the deck.
      if (cardStop) setCardStop(null);
      else handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, cardStop]);

  // Removing a card nudges the deck to the next one — it feels like discarding.
  const handleTogglePlace = (place) => {
    const key = poiKey(place);
    const wasSelected = selectedKeys.has(key);
    toggleCandidate(key);
    if (wasSelected) setDeckIndex((i) => Math.min(i + 1, (candidates?.length || 1) - 1));
  };

  // Normalize a restaurant into the place shape the route builder expects.
  const restaurantToPlace = (r) => ({
    placeId: r.placeId,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    type: 'restaurant',
    description: r.address || null,
    imageUrl: r.photoUrl || null,
    rating: r.rating,
  });

  const isRestaurantAdded = (r) => routeRestaurants.some((p) => p.placeId === r.placeId);

  const toggleRestaurant = (r) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
    setRouteRestaurants((prev) =>
      prev.some((p) => p.placeId === r.placeId)
        ? prev.filter((p) => p.placeId !== r.placeId)
        : [...prev, restaurantToPlace(r)]
    );
  };

  const handleBuildRoute = () => {
    // The route view lives under 'sitios'; jump there so building from the
    // Restaurantes deck still lands on the map instead of staying on the deck.
    setView('sitios');
    buildRouteFromSelection(routeRestaurants);
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
              <button type="button" className="xp-cta" onClick={launch}>Reintentar</button>
              <button type="button" className="xp-ghost-btn" onClick={handleClose}>Volver al inicio</button>
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

  // ---- Ready ----
  const isRoute = stage === 'route';
  const city = currentTrip?.city || '';
  const selectedCount = selectedKeys.size;
  const restaurantCount = routeRestaurants.length;
  const totalStops = selectedCount + restaurantCount;
  const showSitiosRoute = view === 'sitios' && isRoute;

  // The route view (map + sheet) — only in 'sitios' after building.
  const routePlaces = currentTrip?.places || [];
  const dirUrl = origin ? gmapsDirectionsUrl(origin, routePlaces) : null;

  const routeHeader = (
    <>
      <div className="xp-head-row">
        <div className="xp-head-text">
          <span className="xp-head-title">Tu ruta{city ? ` por ${city}` : ''}</span>
          <span className="xp-head-sub">
            {routeDistance != null && `${(routeDistance / 1000).toFixed(1)} km`}
            {routeDuration != null && ` · ${formatDuration(routeDuration)} a pie`}
            {` · ${routePlaces.length} paradas`}
          </span>
        </div>
      </div>
      <div className="xp-head-actions">
        {dirUrl && (
          <a
            className="xp-cta"
            href={dirUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('gmaps_opened', { city, stops: routePlaces.length })}
          >
            Empezar en Google Maps
          </a>
        )}
        <button type="button" className="xp-ghost-btn" onClick={backToCandidates}>Cambiar sitios</button>
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
      {/* Top bar: close · segmented Sitios/Restaurantes · weather */}
      <div className={`xp-top${!showSitiosRoute ? ' xp-top-deck' : ''}`}>
        <button type="button" className="xp-top-btn" onClick={handleClose} aria-label="Cerrar exploración">
          <CloseIcon />
        </button>

        {!showSitiosRoute && (
          <div className="xp-seg" role="tablist" aria-label="Vista">
            <button
              type="button" role="tab" aria-selected={view === 'sitios'}
              className={`xp-seg-btn${view === 'sitios' ? ' is-on' : ''}`}
              onClick={() => setView('sitios')}
            >
              Sitios
            </button>
            <button
              type="button" role="tab" aria-selected={view === 'restaurantes'}
              className={`xp-seg-btn${view === 'restaurantes' ? ' is-on' : ''}`}
              onClick={() => setView('restaurantes')}
            >
              Restaurantes
            </button>
          </div>
        )}

        <div className="xp-top-spacer" />
        {weather && (
          <div className="xp-top-pill" title={weather.desc}>
            <span aria-hidden="true">{weather.icon}</span> {weather.temp}°
          </div>
        )}
      </div>

      {/* ---- SITIOS · route built ---- */}
      {showSitiosRoute && (
        <>
          <ExploreMap
            origin={origin}
            places={routePlaces}
            stage={stage}
            selectedKeys={selectedKeys}
            poiKey={poiKey}
            restaurants={restaurants || []}
            routeGeometry={routeGeometry}
            onSpotTap={setCardStop}
          />
          <ExploreSheet snap={snap} onSnapChange={setSnap} refreshing={isGenerating} handle={routeHeader}>
            <ol className="xp-stops">
              {routePlaces.map((p, i) => (
                <li
                  key={poiKey(p)}
                  className="xp-stop is-tappable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCardStop(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCardStop(p); }
                  }}
                >
                  <span className={`xp-stop-num${p.type === 'restaurant' ? ' is-food' : ''}`}>
                    {p.type === 'restaurant' ? '🍴' : i + 1}
                  </span>
                  <div className="xp-stop-info">
                    <span className="xp-stop-name">{p.name}</span>
                    {p.description && <span className="xp-stop-desc">{p.description}</span>}
                  </div>
                  <svg className="xp-stop-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </li>
              ))}
            </ol>
            <RestaurantStrip restaurants={restaurants || []} title="Para reponer fuerzas" />
          </ExploreSheet>

          {cardStop && (
            <div
              className="xp-cardmodal"
              role="dialog"
              aria-modal="true"
              aria-label={cardStop.name}
              onClick={() => setCardStop(null)}
            >
              <div className="xp-cardmodal-inner" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="xp-top-btn xp-cardmodal-close"
                  onClick={() => setCardStop(null)}
                  aria-label="Cerrar"
                >
                  <CloseIcon />
                </button>
                <DeckPlaceCard
                  place={cardStop}
                  city={city}
                  selected
                  readOnly
                  distanceKm={origin ? haversineKm(origin.lat, origin.lng, cardStop.lat, cardStop.lng) : 0}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- SITIOS · curate the deck ---- */}
      {view === 'sitios' && !isRoute && (
        <ExploreDeck
          count={candidates.length}
          index={deckIndex}
          onIndexChange={setDeckIndex}
          header={
            <div className="xp-deck-header">
              <span className="xp-deck-title">Cerca de ti{city ? ` · ${city}` : ''}</span>
              <span className="xp-deck-counter">{deckIndex + 1} / {candidates.length}</span>
            </div>
          }
          footer={
            <div className="xp-deck-footer">
              <p className="xp-deck-hint">
                {restaurantCount > 0
                  ? `${selectedCount} sitio${selectedCount === 1 ? '' : 's'} + ${restaurantCount} para comer`
                  : 'Repasa los sitios · quita los que no te encajen'}
              </p>
              <button
                type="button"
                className="xp-cta"
                disabled={totalStops < 2 || isGenerating}
                onClick={handleBuildRoute}
              >
                {isGenerating ? 'Calculando ruta…' : `Crear ruta · ${totalStops} parada${totalStops === 1 ? '' : 's'}`}
              </button>
            </div>
          }
          renderCard={(i) => {
            const p = candidates[i];
            return (
              <DeckPlaceCard
                place={p}
                city={city}
                selected={selectedKeys.has(poiKey(p))}
                onToggle={() => handleTogglePlace(p)}
                distanceKm={origin ? haversineKm(origin.lat, origin.lng, p.lat, p.lng) : 0}
              />
            );
          }}
        />
      )}

      {/* ---- RESTAURANTES · deck ---- */}
      {view === 'restaurantes' && (
        restaurants === null ? (
          <div className="xp-deck-msg"><div className="xp-radar xp-radar-sm" aria-hidden="true"><span /><span /><div className="xp-radar-dot" /></div><p>Buscando restaurantes cerca…</p></div>
        ) : restaurants.length === 0 ? (
          <div className="xp-deck-msg">
            <div className="xp-boot-emoji" aria-hidden="true">🍽️</div>
            <p>No hemos encontrado restaurantes valorados aquí cerca.</p>
          </div>
        ) : (
          <ExploreDeck
            count={restaurants.length}
            index={restIndex}
            onIndexChange={setRestIndex}
            header={
              <div className="xp-deck-header">
                <span className="xp-deck-title">Para comer{city ? ` · ${city}` : ''}</span>
                <span className="xp-deck-counter">{restIndex + 1} / {restaurants.length}</span>
              </div>
            }
            footer={
              restaurantCount > 0 ? (
                <div className="xp-deck-footer">
                  <p className="xp-deck-hint">
                    {restaurantCount} para comer en tu ruta · {selectedCount} sitio{selectedCount === 1 ? '' : 's'}
                  </p>
                  <button
                    type="button"
                    className="xp-cta"
                    disabled={totalStops < 2 || isGenerating}
                    onClick={handleBuildRoute}
                  >
                    {isGenerating ? 'Calculando ruta…' : `Crear ruta · ${totalStops} parada${totalStops === 1 ? '' : 's'}`}
                  </button>
                </div>
              ) : (
                <div className="xp-deck-footer">
                  <p className="xp-deck-hint">Añade los que te apetezcan a la ruta · o ábrelos en el mapa</p>
                </div>
              )
            }
            renderCard={(i) => (
              <DeckRestaurantCard
                restaurant={restaurants[i]}
                featured={i === 0}
                city={city}
                added={isRestaurantAdded(restaurants[i])}
                canAdd={Number.isFinite(restaurants[i].lat) && Number.isFinite(restaurants[i].lng)}
                onToggleRoute={() => toggleRestaurant(restaurants[i])}
              />
            )}
          />
        )
      )}
    </div>
  );
}
