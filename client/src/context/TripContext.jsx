import { createContext, useReducer, useCallback, useContext } from 'react';
import { generateTrip as apiGenerateTrip, getRoute, fetchWeather as apiFetchWeather, fetchPlaceDescriptions, createShareLink, fetchSharedTrip } from '../services/api';
import { track } from '../services/analytics';
import { saveTrip } from '../services/trips';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { WEATHER_CODES } from '../constants/weather';

// Action types
const SET_SEARCH_LOCATION = 'SET_SEARCH_LOCATION';
const SET_RADIUS = 'SET_RADIUS';
const SET_GENERATING = 'SET_GENERATING';
const SET_STATUS = 'SET_STATUS';
const SET_PROGRESS = 'SET_PROGRESS';
const SET_ERROR = 'SET_ERROR';
const SET_TRIP = 'SET_TRIP';
const SET_ROUTE = 'SET_ROUTE';
const SET_WEATHER = 'SET_WEATHER';
const CLOSE_TRIP = 'CLOSE_TRIP';
const SET_STAGE = 'SET_STAGE';
const SET_CANDIDATES = 'SET_CANDIDATES';
const SET_SELECTED_KEYS = 'SET_SELECTED_KEYS';
const TOGGLE_SELECTION = 'TOGGLE_SELECTION';
const MERGE_DESCRIPTIONS = 'MERGE_DESCRIPTIONS';

const CANDIDATE_COUNT = 10;

// Stable identity for a POI across selection toggles
function poiKey(p) {
  return `${p.name}|${p.lat}|${p.lng}`;
}

const initialState = {
  locationMode: 'gps',
  searchLocation: null,
  selectedTheme: 'mixed',
  selectedTransport: 'walking',
  selectedRadius: 5,
  isGenerating: false,
  statusMessage: null,
  progress: 0,
  generationError: null,
  currentTrip: null,
  routeGeometry: null,
  routeDistance: null,
  routeDuration: null,
  weather: null,
  stage: 'idle',          // 'idle' | 'candidates' | 'route'
  candidates: null,        // full POI pool returned by /api/generate-trip
  selectedKeys: new Set(), // subset of candidates the user wants in the route
};

// Progress stages — message shown when progress reaches each threshold.
// Sorted ascending by pct.
const PROGRESS_STAGES = [
  { pct: 0,  msg: 'Preparando tu ruta...' },
  { pct: 15, msg: 'Buscando lugares interesantes cerca...' },
  { pct: 40, msg: 'Consultando fotos y detalles de cada sitio...' },
  { pct: 65, msg: 'Diseñando la mejor ruta para ti...' },
  { pct: 85, msg: 'Últimos retoques...' },
];

function messageForProgress(pct) {
  let msg = PROGRESS_STAGES[0].msg;
  for (const s of PROGRESS_STAGES) {
    if (pct >= s.pct) msg = s.msg;
  }
  return msg;
}

function tripReducer(state, action) {
  switch (action.type) {
    case SET_SEARCH_LOCATION:
      return { ...state, searchLocation: action.payload };
    case SET_RADIUS:
      return { ...state, selectedRadius: action.payload };
    case SET_GENERATING:
      return { ...state, isGenerating: action.payload };
    case SET_STATUS:
      return { ...state, statusMessage: action.payload };
    case SET_PROGRESS:
      return { ...state, progress: action.payload };
    case SET_ERROR:
      return { ...state, generationError: action.payload };
    case SET_TRIP:
      return { ...state, currentTrip: action.payload };
    case SET_ROUTE:
      return {
        ...state,
        routeGeometry: action.payload.geometry,
        routeDistance: action.payload.distance,
        routeDuration: action.payload.duration,
      };
    case SET_WEATHER:
      return { ...state, weather: action.payload };
    case SET_STAGE:
      return { ...state, stage: action.payload };
    case SET_CANDIDATES:
      return { ...state, candidates: action.payload };
    case SET_SELECTED_KEYS:
      return { ...state, selectedKeys: action.payload };
    case TOGGLE_SELECTION: {
      const next = new Set(state.selectedKeys);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedKeys: next };
    }
    case MERGE_DESCRIPTIONS: {
      // Fill descriptions arriving from the background /api/descriptions call.
      // Match by poiKey so it lands on the right place wherever it appears
      // (candidate pool and/or a route already built from it) without
      // clobbering either array.
      const map = action.payload;
      const apply = (arr) =>
        arr ? arr.map((p) => (map[poiKey(p)] ? { ...p, description: map[poiKey(p)] } : p)) : arr;
      return {
        ...state,
        candidates: apply(state.candidates),
        currentTrip: state.currentTrip
          ? { ...state.currentTrip, places: apply(state.currentTrip.places) }
          : state.currentTrip,
      };
    }
    case CLOSE_TRIP:
      return {
        ...state,
        currentTrip: null,
        routeGeometry: null,
        routeDistance: null,
        routeDuration: null,
        weather: null,
        statusMessage: null,
        progress: 0,
        generationError: null,
        stage: 'idle',
        candidates: null,
        selectedKeys: new Set(),
      };
    default:
      return state;
  }
}

const TripContext = createContext(null);

// Geolocation helper. Exported so flows that don't need the trip pipeline
// (e.g. the standalone Restaurantes view) can resolve a position the same way.
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalizacion'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        reject(
          new Error('No se pudo obtener tu ubicacion. Permite el acceso o busca una ciudad.')
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Duration formatting
export function formatDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min >= 60) {
    return `${Math.floor(min / 60)} h ${min % 60} min`;
  }
  return `${min} min`;
}

// Speed constants for non-driving modes (km/h)
const SPEED_KMH = { walking: 5, cycling: 15 };

// Parse weather response using WEATHER_CODES
function parseWeather(data) {
  const current = data.current;
  const daily = data.daily;
  const code = current.weather_code;
  const weather = WEATHER_CODES[code] || { icon: '\u{1F321}️', desc: 'Desconocido' };

  // Extract sunrise/sunset times (HH:MM)
  const sunrise = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;
  const sunset = daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

  return {
    icon: weather.icon,
    desc: weather.desc,
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    wind: Math.round(current.wind_speed_10m),
    uvIndex: current.uv_index != null ? Math.round(current.uv_index) : null,
    precipProb: daily?.precipitation_probability_max?.[0] ?? null,
    tempMax: daily?.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : null,
    tempMin: daily?.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : null,
    sunrise,
    sunset,
  };
}

// Calculate route and return parsed data
async function fetchRouteData(originLat, originLng, places, transport) {
  const start = `${originLat},${originLng}`;
  const waypoints = places.map((p) => `${p.lat},${p.lng}`).join(';');

  const data = await getRoute(start, waypoints, transport);
  const geometry = data.geometry;
  const distance = data.distance;
  let duration = data.duration;

  // Recalculate duration for walking/cycling
  if (SPEED_KMH[transport]) {
    duration = (distance / 1000 / SPEED_KMH[transport]) * 3600;
  }

  return { geometry, distance, duration };
}

export function TripProvider({ children }) {
  const [state, dispatch] = useReducer(tripReducer, initialState);
  const { isAuthenticated, getAccessToken } = useAuth();
  const { showToast } = useToast();

  const setSearchLocation = useCallback((location) => {
    dispatch({ type: SET_SEARCH_LOCATION, payload: location });
  }, []);

  const setRadius = useCallback((radius) => {
    dispatch({ type: SET_RADIUS, payload: radius });
  }, []);

  const toggleCandidate = useCallback((key) => {
    dispatch({ type: TOGGLE_SELECTION, payload: key });
  }, []);

  // Internal: persists auto-save when user finalizes a route.
  const persistTrip = useCallback(async (trip, theme, transport, routeData) => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await saveTrip(
        {
          city: trip.city,
          country: trip.country,
          origin_lat: trip.origin_lat,
          origin_lng: trip.origin_lng,
          theme,
          transport_mode: transport,
          places: trip.places,
          route_distance: routeData.distance,
          route_duration: routeData.duration,
        },
        token
      );
    } catch (e) {
      console.error('Error al auto-guardar:', e);
    }
  }, [isAuthenticated, getAccessToken]);

  // Internal: drives the progress simulator. Returns start/stop fns.
  const makeProgressSimulator = () => {
    let progressTimer = null;
    return {
      start() {
        const started = Date.now();
        progressTimer = setInterval(() => {
          const elapsed = Date.now() - started;
          const pct = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 5000))));
          dispatch({ type: SET_PROGRESS, payload: pct });
          dispatch({ type: SET_STATUS, payload: messageForProgress(pct) });
        }, 200);
      },
      stop() {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      }
    };
  };

  // Stage 1: fetch the candidate pool. The user then curates and triggers buildRouteFromSelection.
  // When `autoBuild` is true (Sorpréndeme / inspiration cards), we skip the curation step
  // and immediately build a route from the first SURPRISE_COUNT candidates.
  const generateCandidates = useCallback(async (overrides = {}) => {
    const effectiveLocationMode = overrides.locationMode ?? state.locationMode;
    const effectiveSearchLocation = overrides.searchLocation ?? state.searchLocation;
    const effectiveTheme = overrides.theme ?? state.selectedTheme;
    const effectiveTransport = overrides.transport ?? state.selectedTransport;
    const effectiveRadius = overrides.radius ?? state.selectedRadius;

    const sim = makeProgressSimulator();

    try {
      dispatch({ type: SET_ERROR, payload: null });
      dispatch({ type: SET_PROGRESS, payload: 0 });
      dispatch({ type: SET_STATUS, payload: PROGRESS_STAGES[0].msg });
      dispatch({ type: SET_GENERATING, payload: true });

      // 1. Resolve location first (geo can take a few seconds)
      let location;
      if (effectiveLocationMode === 'search') {
        if (!effectiveSearchLocation) {
          throw new Error('Busca y selecciona una ciudad primero');
        }
        location = effectiveSearchLocation;
      } else {
        dispatch({ type: SET_STATUS, payload: 'Ubicando tu posición...' });
        location = await getUserLocation();
      }

      // 2. Fetch candidates (count=CANDIDATE_COUNT puts the backend in candidate mode)
      sim.start();

      const radiusMeters = Math.round(effectiveRadius * 1000);
      // Fast mode: skip server-side LLM descriptions so the deck appears
      // instantly. Descriptions are backfilled in the background below.
      const fast = true;
      const tripData = await apiGenerateTrip(
        location.lat,
        location.lng,
        effectiveTheme,
        effectiveTransport,
        radiusMeters,
        CANDIDATE_COUNT,
        location.name,
        location.country,
        fast
      );

      sim.stop();

      if (!tripData.places || tripData.places.length === 0) {
        throw new Error('No se encontraron lugares para esta ubicación');
      }

      const candidates = tripData.places;
      const trip = {
        city: tripData.city || location.name || 'la zona',
        country: tripData.country || location.country || '',
        places: candidates, // map renders the full pool in candidates stage
        origin_lat: location.lat,
        origin_lng: location.lng,
        poiSource: tripData.poiSource,
        theme: effectiveTheme,
        transport: effectiveTransport,
      };

      track('candidates_loaded', { city: trip.city, count: candidates.length, source: tripData.poiSource });

      // The deck starts with every candidate selected; the user swipes to remove.
      const initialSelection = new Set(candidates.map(poiKey));

      dispatch({ type: SET_CANDIDATES, payload: candidates });
      dispatch({ type: SET_SELECTED_KEYS, payload: initialSelection });
      dispatch({ type: SET_TRIP, payload: trip });

      dispatch({ type: SET_STAGE, payload: 'candidates' });
      dispatch({ type: SET_PROGRESS, payload: 100 });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_GENERATING, payload: false });

      // Fetch weather in the background.
      apiFetchWeather(location.lat, location.lng)
        .then(weatherData => dispatch({ type: SET_WEATHER, payload: parseWeather(weatherData) }))
        .catch(() => {});

      // Descriptions were skipped server-side for speed; backfill them now and
      // merge by poiKey when they arrive.
      fetchPlaceDescriptions(
        candidates.map((p) => ({ name: p.name, type: p.type })),
        trip.city,
        trip.country,
        effectiveTheme
      )
        .then(({ descriptions }) => {
          if (!Array.isArray(descriptions)) return;
          const map = {};
          candidates.forEach((p, i) => {
            if (descriptions[i]) map[poiKey(p)] = descriptions[i];
          });
          if (Object.keys(map).length) dispatch({ type: MERGE_DESCRIPTIONS, payload: map });
        })
        .catch(() => {});
    } catch (error) {
      sim.stop();
      console.error('Error al generar candidatos:', error);
      const msg = error.message || 'Error al generar la ruta';
      dispatch({ type: SET_ERROR, payload: msg });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_GENERATING, payload: false });
      dispatch({ type: SET_PROGRESS, payload: 0 });
      showToast(msg, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.locationMode,
    state.searchLocation,
    state.selectedTheme,
    state.selectedTransport,
    state.selectedRadius,
  ]);

  // Internal: shared route-build logic used by buildRouteFromSelection.
  // Filters candidates by selection, fetches the OSRM route, transitions to 'route' stage.
  async function buildRouteInternal(trip, candidates, selectedKeys, theme, transport, origin) {
    const selectedPlaces = candidates.filter(p => selectedKeys.has(poiKey(p)));
    if (selectedPlaces.length < 2) {
      throw new Error('Selecciona al menos 2 sitios para crear la ruta');
    }

    dispatch({ type: SET_STATUS, payload: 'Calculando la ruta en el mapa...' });
    const routeData = await fetchRouteData(origin.lat, origin.lng, selectedPlaces, transport);

    const updatedTrip = {
      ...trip,
      places: selectedPlaces, // route stage: trip.places shrinks to the chosen subset
      route_distance: routeData.distance,
      route_duration: routeData.duration,
    };

    dispatch({ type: SET_TRIP, payload: updatedTrip });
    dispatch({ type: SET_ROUTE, payload: routeData });
    dispatch({ type: SET_STAGE, payload: 'route' });
    dispatch({ type: SET_PROGRESS, payload: 100 });
    dispatch({ type: SET_STATUS, payload: null });
    dispatch({ type: SET_GENERATING, payload: false });

    track('route_created', {
      city: trip.city,
      stops: selectedPlaces.length,
      km: Math.round((routeData.distance || 0) / 100) / 10,
    });

    // Weather: only fetch here if Sorpréndeme path bypassed the candidates-stage fetch.
    apiFetchWeather(origin.lat, origin.lng)
      .then(weatherData => dispatch({ type: SET_WEATHER, payload: parseWeather(weatherData) }))
      .catch(() => {});

    await persistTrip(updatedTrip, theme, transport, routeData);
  }

  // Stage 2: user confirmed selection → build the route.
  const buildRouteFromSelection = useCallback(async () => {
    if (!state.candidates || !state.currentTrip) return;
    if (state.selectedKeys.size < 2) {
      showToast('Selecciona al menos 2 sitios para crear la ruta', 'error');
      return;
    }
    try {
      dispatch({ type: SET_GENERATING, payload: true });
      dispatch({ type: SET_PROGRESS, payload: 80 });
      const origin = { lat: state.currentTrip.origin_lat, lng: state.currentTrip.origin_lng };
      // Rebuild trip from the original candidate-stage shape (places = full pool)
      const baseTrip = { ...state.currentTrip, places: state.candidates };
      await buildRouteInternal(
        baseTrip,
        state.candidates,
        state.selectedKeys,
        state.currentTrip.theme,
        state.currentTrip.transport,
        origin
      );
    } catch (error) {
      console.error('Error al construir la ruta:', error);
      const msg = error.message || 'No se pudo calcular la ruta';
      showToast(msg, 'error');
      dispatch({ type: SET_GENERATING, payload: false });
      dispatch({ type: SET_PROGRESS, payload: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.candidates, state.currentTrip, state.selectedKeys]);

  // Go back from route view to curation: restore the full pool, drop the route.
  const backToCandidates = useCallback(() => {
    if (!state.candidates || !state.currentTrip) return;
    dispatch({
      type: SET_TRIP,
      payload: { ...state.currentTrip, places: state.candidates }
    });
    dispatch({ type: SET_ROUTE, payload: { geometry: null, distance: null, duration: null } });
    dispatch({ type: SET_STAGE, payload: 'candidates' });
  }, [state.candidates, state.currentTrip]);

  const closeTrip = useCallback(() => {
    dispatch({ type: CLOSE_TRIP });
  }, []);

  // Share a built route as a URL (/r/:slug). A link brings the recipient into
  // the app — the old plain-text share was a dead end. The slug is created
  // lazily on first share and reused afterwards (or comes with the trip when
  // it was itself opened from a share).
  const shareTrip = useCallback(async () => {
    const trip = state.currentTrip;
    if (!trip || !trip.places || trip.places.length === 0) return;

    const city = trip.city || 'la zona';
    try {
      let slug = trip.shareSlug;
      if (!slug) {
        const resp = await createShareLink({
          city: trip.city,
          country: trip.country,
          transport: trip.transport || 'walking',
          origin_lat: trip.origin_lat,
          origin_lng: trip.origin_lng,
          places: trip.places,
          route_distance: trip.route_distance ?? state.routeDistance,
          route_duration: trip.route_duration ?? state.routeDuration,
        });
        slug = resp.slug;
        dispatch({ type: SET_TRIP, payload: { ...trip, shareSlug: slug } });
      }

      const url = `${window.location.origin}/r/${slug}`;
      track('share_clicked', { city, stops: trip.places.length });

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Ruta por ${city} — RandomTrip`,
            text: `Mi ruta por ${city}: ${trip.places.length} paradas`,
            url,
          });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return; // user closed the sheet
          // otherwise fall through to clipboard
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace de la ruta copiado', 'success');
      } catch {
        showToast(`Tu enlace: ${url}`, 'info');
      }
    } catch (error) {
      console.error('Error al compartir:', error);
      showToast(error.message || 'No se pudo crear el enlace', 'error');
    }
  }, [state.currentTrip, state.routeDistance, state.routeDuration, showToast]);

  // Open a shared route (/r/:slug): load the stored stops, recompute the
  // geometry (same waypoints → same route) and land directly on the route
  // view. The shared places double as the candidate pool so "Cambiar sitios"
  // lets the recipient remix the route.
  const loadSharedTrip = useCallback(async (slug) => {
    const sim = makeProgressSimulator();
    try {
      dispatch({ type: SET_ERROR, payload: null });
      dispatch({ type: SET_GENERATING, payload: true });
      dispatch({ type: SET_STATUS, payload: 'Cargando la ruta compartida…' });
      sim.start();

      const shared = await fetchSharedTrip(slug);
      const places = Array.isArray(shared.places) ? shared.places : [];
      if (places.length < 2) throw new Error('Esta ruta ya no está disponible');
      const origin = { lat: shared.origin_lat, lng: shared.origin_lng };
      const transport = shared.transport || 'walking';

      const trip = {
        city: shared.city || 'la zona',
        country: shared.country || '',
        places,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        theme: 'mixed',
        transport,
        shareSlug: slug,
      };

      dispatch({ type: SET_CANDIDATES, payload: places });
      dispatch({ type: SET_SELECTED_KEYS, payload: new Set(places.map(poiKey)) });

      const routeData = await fetchRouteData(origin.lat, origin.lng, places, transport);
      sim.stop();

      dispatch({
        type: SET_TRIP,
        payload: { ...trip, route_distance: routeData.distance, route_duration: routeData.duration },
      });
      dispatch({ type: SET_ROUTE, payload: routeData });
      dispatch({ type: SET_STAGE, payload: 'route' });
      dispatch({ type: SET_PROGRESS, payload: 100 });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_GENERATING, payload: false });

      apiFetchWeather(origin.lat, origin.lng)
        .then((weatherData) => dispatch({ type: SET_WEATHER, payload: parseWeather(weatherData) }))
        .catch(() => {});

      track('shared_route_opened', { city: trip.city, stops: places.length });
    } catch (error) {
      sim.stop();
      console.error('Error al cargar la ruta compartida:', error);
      dispatch({ type: SET_GENERATING, payload: false });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_PROGRESS, payload: 0 });
      dispatch({ type: SET_ERROR, payload: error.message || 'Esta ruta ya no está disponible' });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: SET_ERROR, payload: null });
  }, []);

  const value = {
    ...state,
    poiKey,
    setSearchLocation,
    setRadius,
    toggleCandidate,
    generateCandidates,
    buildRouteFromSelection,
    backToCandidates,
    closeTrip,
    shareTrip,
    loadSharedTrip,
    clearError,
  };

  return (
    <TripContext value={value}>
      {children}
    </TripContext>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}
