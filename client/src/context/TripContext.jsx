import { createContext, useReducer, useCallback, useContext } from 'react';
import { generateTrip as apiGenerateTrip, getRoute, fetchWeather as apiFetchWeather } from '../services/api';
import { saveTrip } from '../services/trips';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { WEATHER_CODES } from '../constants/weather';

// Action types
const SET_LOCATION_MODE = 'SET_LOCATION_MODE';
const SET_SEARCH_LOCATION = 'SET_SEARCH_LOCATION';
const SET_THEME = 'SET_THEME';
const SET_TRANSPORT = 'SET_TRANSPORT';
const SET_RADIUS = 'SET_RADIUS';
const SET_GENERATING = 'SET_GENERATING';
const SET_STATUS = 'SET_STATUS';
const SET_PROGRESS = 'SET_PROGRESS';
const SET_ERROR = 'SET_ERROR';
const SET_TRIP = 'SET_TRIP';
const SET_ROUTE = 'SET_ROUTE';
const SET_WEATHER = 'SET_WEATHER';
const CLOSE_TRIP = 'CLOSE_TRIP';

const initialState = {
  locationMode: 'gps',
  searchLocation: null,
  selectedTheme: 'monuments',
  selectedTransport: 'driving',
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
    case SET_LOCATION_MODE:
      return { ...state, locationMode: action.payload };
    case SET_SEARCH_LOCATION:
      return { ...state, searchLocation: action.payload };
    case SET_THEME:
      return { ...state, selectedTheme: action.payload };
    case SET_TRANSPORT:
      return { ...state, selectedTransport: action.payload };
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
      };
    default:
      return state;
  }
}

const TripContext = createContext(null);

// Geolocation helper
function getUserLocation() {
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
  const weather = WEATHER_CODES[code] || { icon: '\u{1F321}\uFE0F', desc: 'Desconocido' };

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
// Server already extracts routes[0] and returns flat { geometry, distance, duration, mode }
// Server also recalculates duration for walking/cycling, but we do it client-side too
// as a safety measure in case the server response uses the OSRM driving duration
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

  const setLocationMode = useCallback((mode) => {
    dispatch({ type: SET_LOCATION_MODE, payload: mode });
  }, []);

  const setSearchLocation = useCallback((location) => {
    dispatch({ type: SET_SEARCH_LOCATION, payload: location });
  }, []);

  const setTheme = useCallback((theme) => {
    dispatch({ type: SET_THEME, payload: theme });
  }, []);

  const setTransport = useCallback((transport) => {
    dispatch({ type: SET_TRANSPORT, payload: transport });
  }, []);

  const setRadius = useCallback((radius) => {
    dispatch({ type: SET_RADIUS, payload: radius });
  }, []);

  // Accepts optional overrides so callers (e.g. the inspiration carousel) can
  // generate a trip with fresh values without waiting for setState+re-render,
  // which would otherwise leave generateTrip reading stale closure state.
  const generateTrip = useCallback(async (overrides = {}) => {
    const effectiveLocationMode = overrides.locationMode ?? state.locationMode;
    const effectiveSearchLocation = overrides.searchLocation ?? state.searchLocation;
    const effectiveTheme = overrides.theme ?? state.selectedTheme;
    const effectiveTransport = overrides.transport ?? state.selectedTransport;
    const effectiveRadius = overrides.radius ?? state.selectedRadius;

    // Interval that simulates progress toward 90% while the backend call is in flight.
    // Cleared in both success and error paths. Uses an asymptotic curve so progress
    // feels fast at the start and smoothly decelerates — avoiding the "stuck at 90%"
    // feel if the request is slow.
    let progressTimer = null;

    const startProgressSimulation = () => {
      const started = Date.now();
      // Typical request is 6-12s; decay constant 5000ms reaches ~83% at 9s.
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - started;
        const pct = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 5000))));
        dispatch({ type: SET_PROGRESS, payload: pct });
        dispatch({ type: SET_STATUS, payload: messageForProgress(pct) });
      }, 200);
    };

    const stopProgressSimulation = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    };

    try {
      dispatch({ type: SET_ERROR, payload: null });
      dispatch({ type: SET_PROGRESS, payload: 0 });
      dispatch({ type: SET_STATUS, payload: PROGRESS_STAGES[0].msg });
      dispatch({ type: SET_GENERATING, payload: true });

      // 1. Get location — before starting progress simulation (geo can take several seconds)
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

      // 2. Generate trip via backend — this is the long-running call
      startProgressSimulation();

      const radiusMeters = Math.round(effectiveRadius * 1000);
      const tripData = await apiGenerateTrip(
        location.lat,
        location.lng,
        effectiveTheme,
        effectiveTransport,
        radiusMeters
      );

      stopProgressSimulation();

      if (!tripData.places || tripData.places.length === 0) {
        throw new Error('No se encontraron lugares para esta ubicación');
      }

      const trip = {
        city: tripData.city,
        country: tripData.country,
        places: tripData.places,
        origin_lat: location.lat,
        origin_lng: location.lng,
        poiSource: tripData.poiSource,
        theme: effectiveTheme,
        transport: effectiveTransport,
      };

      // 3. Show trip immediately with a final progress push, then fetch route + weather
      dispatch({ type: SET_PROGRESS, payload: 95 });
      dispatch({ type: SET_STATUS, payload: 'Calculando la ruta en el mapa...' });
      dispatch({ type: SET_TRIP, payload: trip });

      const [routeData] = await Promise.all([
        fetchRouteData(location.lat, location.lng, tripData.places, effectiveTransport),
        apiFetchWeather(location.lat, location.lng)
          .then(weatherData => dispatch({ type: SET_WEATHER, payload: parseWeather(weatherData) }))
          .catch(() => {})
      ]);

      dispatch({ type: SET_ROUTE, payload: routeData });
      trip.route_distance = routeData.distance;
      trip.route_duration = routeData.duration;
      dispatch({ type: SET_TRIP, payload: { ...trip } });

      // Close out the generating state — 100% briefly then fade out
      dispatch({ type: SET_PROGRESS, payload: 100 });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_GENERATING, payload: false });

      // 5. Auto-save if authenticated
      if (isAuthenticated) {
        try {
          const token = await getAccessToken();
          if (token) {
            await saveTrip(
              {
                city: trip.city,
                country: trip.country,
                origin_lat: trip.origin_lat,
                origin_lng: trip.origin_lng,
                theme: effectiveTheme,
                transport_mode: effectiveTransport,
                places: trip.places,
                route_distance: routeData.distance,
                route_duration: routeData.duration,
              },
              token
            );
          }
        } catch (e) {
          console.error('Error al auto-guardar:', e);
        }
      }
    } catch (error) {
      stopProgressSimulation();
      console.error('Error al generar ruta:', error);
      const msg = error.message || 'Error al generar la ruta';
      dispatch({ type: SET_ERROR, payload: msg });
      dispatch({ type: SET_STATUS, payload: null });
      dispatch({ type: SET_GENERATING, payload: false });
      dispatch({ type: SET_PROGRESS, payload: 0 });
      showToast(msg, 'error');
    }
  }, [
    state.locationMode,
    state.searchLocation,
    state.selectedTheme,
    state.selectedTransport,
    state.selectedRadius,
    isAuthenticated,
    getAccessToken,
    showToast,
  ]);

  const closeTrip = useCallback(() => {
    dispatch({ type: CLOSE_TRIP });
  }, []);

  const shareTrip = useCallback(() => {
    if (!state.currentTrip || !state.currentTrip.places || state.currentTrip.places.length === 0) return;

    const city = state.currentTrip.city || 'la zona';
    const placesText = state.currentTrip.places
      .map((p, i) => `${i + 1}. ${p.name} - ${p.description || ''}`)
      .join('\n');

    const text = `Mi ruta en ${city}:\n\n${placesText}\n\nGenerado con RandomTrip!`;

    if (navigator.share) {
      navigator.share({ title: `Ruta en ${city}`, text })
        .catch(() => {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Ruta copiada al portapapeles', 'success');
          }).catch(() => {
            showToast('No se pudo copiar al portapapeles', 'error');
          });
        });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Ruta copiada al portapapeles', 'success');
      }).catch(() => {
        showToast('No se pudo copiar al portapapeles', 'error');
      });
    }
  }, [state.currentTrip, showToast]);

  const viewSavedTrip = useCallback(
    async (trip) => {
      try {
        dispatch({ type: SET_GENERATING, payload: true });
        dispatch({ type: SET_STATUS, payload: 'Cargando ruta guardada...' });

        const loadedTrip = {
          city: trip.city,
          country: trip.country,
          places: trip.places || [],
          origin_lat: trip.origin_lat,
          origin_lng: trip.origin_lng,
          poiSource: null,
          route_distance: trip.route_distance,
          route_duration: trip.route_duration,
          theme: trip.theme,
          transport: trip.transport_mode,
        };

        dispatch({ type: SET_TRIP, payload: loadedTrip });

        // Calculate route
        const transport = trip.transport_mode || 'driving';
        const routeData = await fetchRouteData(
          trip.origin_lat,
          trip.origin_lng,
          trip.places || [],
          transport
        );

        dispatch({ type: SET_ROUTE, payload: routeData });

        // Fetch weather
        try {
          const weatherData = await apiFetchWeather(trip.origin_lat, trip.origin_lng);
          const weather = parseWeather(weatherData);
          dispatch({ type: SET_WEATHER, payload: weather });
        } catch (e) {
          console.error('Error fetching weather:', e);
        }

        dispatch({ type: SET_STATUS, payload: null });
      } catch (error) {
        console.error('Error loading saved trip:', error);
        showToast('No se pudo cargar la ruta guardada', 'error');
      } finally {
        dispatch({ type: SET_GENERATING, payload: false });
      }
    },
    [showToast]
  );

  const clearError = useCallback(() => {
    dispatch({ type: SET_ERROR, payload: null });
  }, []);

  const value = {
    ...state,
    setLocationMode,
    setSearchLocation,
    setTheme,
    setTransport,
    setRadius,
    generateTrip,
    closeTrip,
    shareTrip,
    viewSavedTrip,
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
