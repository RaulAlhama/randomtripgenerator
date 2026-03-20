// RandomTrip Generator - Aplicacion Frontend

const API_BASE = '';

// Estado
let userLocation = null;
let searchLocation = null;
let currentTrip = null;
let map = null;
let markersLayer = null;
let routeLayer = null;
let selectedPlaces = [];
let currentCity = null;
let currentCountry = null;
let selectedTheme = 'classic';
let selectedTransport = 'driving';
let selectedRadius = 5; // km
let locationMode = 'gps';
let auth0Client = null;
let authEnabled = false;

// Elementos DOM
const generateBtn = document.getElementById('generate-btn');
const locationStatus = document.getElementById('location-status');
const locationMessage = document.getElementById('location-message');
const tripResult = document.getElementById('trip-result');
const tripTitle = document.getElementById('trip-title');
const routeOverlay = document.getElementById('route-overlay');
const poiList = document.getElementById('poi-list');
const routeDistance = document.getElementById('route-distance');
const routeDuration = document.getElementById('route-duration');
const routeMode = document.getElementById('route-mode');
const tripDistance = document.getElementById('trip-distance');
const tripDuration = document.getElementById('trip-duration');
const closeTripBtn = document.getElementById('close-trip-btn');
const shareTripBtn = document.getElementById('share-trip-btn');
const authSection = document.getElementById('auth-section');
const citySearch = document.getElementById('city-search');
const cityResults = document.getElementById('city-results');
const myTripsSection = document.getElementById('my-trips');
const tripsGrid = document.getElementById('trips-grid');
const noTripsMsg = document.getElementById('no-trips-msg');
const toastEl = document.getElementById('toast');

// ========== AUTH0 ==========

async function initAuth() {
  try {
    const response = await fetch(`${API_BASE}/api/auth-config`);
    const config = await response.json();

    if (!config.enabled) {
      authSection.innerHTML = '<span class="auth-badge">Sin registro necesario</span>';
      return;
    }

    authEnabled = true;
    auth0Client = await auth0.createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: config.audience
      }
    });

    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await updateAuthUI();
  } catch (error) {
    console.error('Error de autenticacion:', error);
    authSection.innerHTML = '<span class="auth-badge">Sin registro necesario</span>';
  }
}

async function updateAuthUI() {
  if (!auth0Client) return;

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    const user = await auth0Client.getUser();
    const avatarUrl = user.picture || '';
    const displayName = user.name || user.email || 'Usuario';

    authSection.innerHTML = `
      <div class="user-info">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="" class="user-avatar" referrerpolicy="no-referrer" />` : ''}
        <span class="user-name">${displayName}</span>
        <button class="btn btn-sm btn-outline" id="logout-btn">Cerrar sesion</button>
      </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);

    myTripsSection.classList.remove('hidden');
    loadMyTrips();
  } else {
    authSection.innerHTML = `
      <button class="btn btn-sm btn-outline" id="login-btn">Iniciar sesion</button>
    `;
    document.getElementById('login-btn').addEventListener('click', login);

    myTripsSection.classList.add('hidden');
  }
}

async function login() {
  if (auth0Client) await auth0Client.loginWithRedirect();
}

async function logout() {
  if (auth0Client) await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
}

async function getAccessToken() {
  if (!auth0Client) return null;
  try {
    return await auth0Client.getTokenSilently();
  } catch {
    return null;
  }
}

// ========== UBICACION ==========

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalizacion'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        resolve(userLocation);
      },
      (error) => reject(new Error('No se pudo obtener tu ubicacion. Permite el acceso o busca una ciudad.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ========== BUSQUEDA DE CIUDAD ==========

let searchTimeout = null;

function setupCitySearch() {
  citySearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 2) {
      cityResults.classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(() => searchCities(query), 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      cityResults.classList.add('hidden');
    }
  });
}

async function searchCities(query) {
  try {
    const response = await fetch(`${API_BASE}/api/search-city?q=${encodeURIComponent(query)}`);
    const cities = await response.json();

    if (cities.length === 0) {
      cityResults.innerHTML = '<div class="city-result-item no-results">No se encontraron ciudades</div>';
      cityResults.classList.remove('hidden');
      return;
    }

    cityResults.innerHTML = cities.map(city => `
      <div class="city-result-item" data-lat="${city.lat}" data-lng="${city.lng}" data-name="${city.name}">
        <strong>${city.name}</strong>
        <span class="city-country">${city.country}</span>
      </div>
    `).join('');

    cityResults.querySelectorAll('.city-result-item:not(.no-results)').forEach(item => {
      item.addEventListener('click', () => {
        searchLocation = {
          lat: parseFloat(item.dataset.lat),
          lng: parseFloat(item.dataset.lng)
        };
        citySearch.value = `${item.dataset.name}, ${item.querySelector('.city-country').textContent}`;
        cityResults.classList.add('hidden');
      });
    });

    cityResults.classList.remove('hidden');
  } catch (error) {
    console.error('Error de busqueda:', error);
  }
}

// ========== SELECTORES DE TEMA Y TRANSPORTE ==========

const SLIDER_DEFAULTS = {
  driving: { min: 2, max: 20, value: 5, step: 0.5 },
  walking: { min: 0.5, max: 10, value: 2, step: 0.5 },
  cycling: { min: 1, max: 15, value: 5, step: 0.5 }
};

function updateSliderForTransport(mode) {
  const slider = document.getElementById('distance-slider');
  const distanceValue = document.getElementById('distance-value');
  const sliderMin = document.getElementById('slider-min');
  const sliderMax = document.getElementById('slider-max');
  if (!slider) return;

  const config = SLIDER_DEFAULTS[mode] || SLIDER_DEFAULTS.driving;
  slider.min = config.min;
  slider.max = config.max;
  slider.step = config.step;
  slider.value = config.value;
  selectedRadius = config.value;
  distanceValue.textContent = `${config.value} km`;
  sliderMin.textContent = config.min >= 1 ? `${config.min} km` : `${(config.min * 1000).toFixed(0)} m`;
  sliderMax.textContent = `${config.max} km`;
}

function setupSelectors() {
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedTheme = card.dataset.theme;
    });
  });

  document.querySelectorAll('.transport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTransport = btn.dataset.mode;
      updateSliderForTransport(selectedTransport);
    });
  });

  // Distance slider
  const slider = document.getElementById('distance-slider');
  const distanceValue = document.getElementById('distance-value');
  if (slider) {
    slider.addEventListener('input', () => {
      selectedRadius = parseFloat(slider.value);
      distanceValue.textContent = selectedRadius >= 1 ? `${selectedRadius} km` : `${(selectedRadius * 1000).toFixed(0)} m`;
    });
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      locationMode = tab.dataset.tab;

      const searchContent = document.getElementById('tab-content-search');
      searchContent.style.display = locationMode === 'search' ? 'block' : 'none';
      if (locationMode === 'search') {
        setTimeout(() => citySearch.focus(), 100);
      }
    });
  });
}

// ========== GENERACION DE RUTA ==========

async function generateTrip() {
  try {
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;
    locationStatus.classList.remove('hidden');

    let location;
    if (locationMode === 'search' && searchLocation) {
      location = searchLocation;
      locationMessage.textContent = 'La IA esta creando tu ruta...';
    } else if (locationMode === 'search' && !searchLocation) {
      throw new Error('Busca y selecciona una ciudad primero');
    } else {
      locationMessage.textContent = 'Obteniendo tu ubicacion...';
      location = await getUserLocation();
    }

    locationMessage.textContent = 'La IA esta diseñando tu ruta perfecta...';

    const radiusMeters = Math.round(selectedRadius * 1000);
    const response = await fetch(
      `${API_BASE}/api/generate-trip?lat=${location.lat}&lng=${location.lng}&theme=${selectedTheme}&transport=${selectedTransport}&radius=${radiusMeters}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al generar la ruta');
    }

    const tripData = await response.json();
    selectedPlaces = tripData.places;
    currentCity = tripData.city;
    currentCountry = tripData.country;
    userLocation = location;

    currentTrip = {
      ...tripData,
      origin_lat: location.lat,
      origin_lng: location.lng
    };

    if (!selectedPlaces || selectedPlaces.length === 0) {
      throw new Error('No se encontraron lugares para esta ubicacion');
    }

    tripResult.classList.remove('hidden');
    tripTitle.innerHTML = `Tu Ruta en <span class="gradient-text">${currentCity || 'la zona'}</span>`;

    // Show warning if POIs come from LLM (less reliable than verified data)
    const poiWarning = document.getElementById('poi-source-warning');
    if (poiWarning) {
      if (tripData.poiSource === 'llm') {
        poiWarning.classList.remove('hidden');
      } else {
        poiWarning.classList.add('hidden');
      }
    }

    if (!map) initMap();
    map.setView([location.lat, location.lng], 13);

    locationMessage.textContent = 'Trazando tu ruta en el mapa...';
    showPlacesOnMap();
    await calculateRoute();
    fetchWeather(location.lat, location.lng);

    locationStatus.classList.add('hidden');
    tripResult.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Auto-save if user is authenticated
    autoSaveTrip();

  } catch (error) {
    console.error('Error al generar ruta:', error);
    locationMessage.textContent = error.message || 'Error al generar la ruta';
  } finally {
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
  }
}

// ========== MAPA ==========

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

function addUserMarker() {
  if (!map || !userLocation) return;
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: '<div style="background: #6366f1; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
    .addTo(markersLayer)
    .bindPopup('<b>Inicio</b>');
}

const typeIcons = {
  museum: '🏛️', monument: '🗿', park: '🌳', historic: '🏰',
  viewpoint: '🌄', restaurant: '🍽️', church: '⛪', castle: '🏰',
  plaza: '⛲', palace: '🏛️', market: '🏪', garden: '🌺',
  theater: '🎭', default: '📍'
};

const typeLabels = {
  museum: 'Museo', monument: 'Monumento', park: 'Parque', historic: 'Historico',
  viewpoint: 'Mirador', restaurant: 'Restaurante', church: 'Iglesia', castle: 'Castillo',
  plaza: 'Plaza', palace: 'Palacio', market: 'Mercado', garden: 'Jardin',
  theater: 'Teatro', default: 'Punto de interes'
};

function showPlacesOnMap() {
  if (!map) return;
  markersLayer.clearLayers();
  addUserMarker();

  const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);

  selectedPlaces.forEach((place, index) => {
    const icon = L.divIcon({
      className: 'poi-marker',
      html: `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${index + 1}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([place.lat, place.lng], { icon })
      .addTo(markersLayer)
      .bindPopup(`
        <div class="popup-title">${place.name}</div>
        <div class="popup-type">${typeLabels[place.type] || typeLabels.default}</div>
        <div style="margin-top: 6px; font-size: 0.85rem; color: #64748b;">${place.description || ''}</div>
      `);

    bounds.extend([place.lat, place.lng]);
  });

  map.fitBounds(bounds, { padding: [50, 50] });
  displayPlaceList();
}

function displayPlaceList() {
  poiList.innerHTML = selectedPlaces.map((place, index) => `
    <div class="poi-item">
      <div class="poi-number">${index + 1}</div>
      <div class="poi-content">
        <div class="poi-name">${typeIcons[place.type] || typeIcons.default} ${place.name}</div>
        <div class="poi-type">${typeLabels[place.type] || typeLabels.default}</div>
        ${place.description ? `<div class="poi-description">${place.description}</div>` : ''}
        <div class="poi-coords">${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}</div>
      </div>
    </div>
  `).join('');
}

// ========== RUTAS ==========

async function calculateRoute() {
  const waypoints = selectedPlaces.map(p => `${p.lat},${p.lng}`).join(';');
  const start = `${userLocation.lat},${userLocation.lng}`;

  const response = await fetch(
    `${API_BASE}/api/route?start=${start}&waypoints=${waypoints}&mode=${selectedTransport}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al calcular la ruta');
  }

  const routeData = await response.json();
  drawRoute(routeData.geometry);
  displayRouteStats(routeData);

  if (currentTrip) {
    currentTrip.route_distance = routeData.distance;
    currentTrip.route_duration = routeData.duration;
  }
}

function drawRoute(geometry) {
  routeLayer.clearLayers();
  const colors = { driving: '#6366f1', walking: '#10b981', cycling: '#f59e0b' };

  L.geoJSON(geometry, {
    style: {
      color: colors[selectedTransport] || '#6366f1',
      weight: 5,
      opacity: 0.8
    }
  }).addTo(routeLayer);
}

const modeLabels = { driving: '🚗 Coche', walking: '🚶 A pie', cycling: '🚴 Bici' };

function formatDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min >= 60) {
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }
  return `${min} min`;
}

function displayRouteStats(routeData) {
  const distanceKm = (routeData.distance / 1000).toFixed(1);
  const durationText = formatDuration(routeData.duration);

  routeDistance.textContent = `${distanceKm} km`;
  routeDuration.textContent = durationText;
  routeMode.textContent = modeLabels[routeData.mode] || routeData.mode;
  tripDistance.textContent = `${distanceKm} km`;
  tripDuration.textContent = durationText;
  routeOverlay.classList.remove('hidden');
}

// ========== GUARDAR Y COMPARTIR ==========

async function autoSaveTrip() {
  if (!currentTrip || !auth0Client) return;

  try {
    const isAuthenticated = await auth0Client.isAuthenticated();
    if (!isAuthenticated) return;

    const token = await getAccessToken();
    if (!token) return;

    const response = await fetch(`${API_BASE}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        city: currentCity,
        country: currentCountry,
        origin_lat: currentTrip.origin_lat,
        origin_lng: currentTrip.origin_lng,
        theme: selectedTheme,
        transport_mode: selectedTransport,
        places: selectedPlaces,
        route_distance: currentTrip.route_distance,
        route_duration: currentTrip.route_duration
      })
    });

    if (response.ok) {
      loadMyTrips();
    }
  } catch (error) {
    console.error('Error al auto-guardar:', error);
  }
}

function shareTrip() {
  if (!selectedPlaces || selectedPlaces.length === 0) return;

  const placesText = selectedPlaces
    .map((p, i) => `${i + 1}. ${p.name} - ${p.description || ''}`)
    .join('\n');

  const text = `Mi ruta en ${currentCity || 'la zona'}:\n\n${placesText}\n\nGenerado con RandomTrip!`;

  if (navigator.share) {
    navigator.share({ title: `Ruta en ${currentCity}`, text })
      .catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Ruta copiada al portapapeles', 'success');
  }).catch(() => {
    showToast('No se pudo copiar al portapapeles', 'error');
  });
}

// ========== MIS VIAJES ==========

async function loadMyTrips() {
  if (!auth0Client) return;

  try {
    const token = await getAccessToken();
    if (!token) return;

    const response = await fetch(`${API_BASE}/api/trips`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return;
    const trips = await response.json();

    if (trips.length === 0) {
      tripsGrid.innerHTML = '';
      noTripsMsg.classList.remove('hidden');
      return;
    }

    noTripsMsg.classList.add('hidden');

    const themeIcons = {
      classic: '⭐', historical: '🏛️', gastro: '🍽️',
      cultural: '🎭', nature: '🌳', surprise: '🎲'
    };

    tripsGrid.innerHTML = trips.map(trip => {
      const placesArr = trip.places || [];
      const distKm = trip.route_distance ? (trip.route_distance / 1000).toFixed(1) : '?';
      const durText = trip.route_duration ? formatDuration(trip.route_duration) : '?';
      const dateStr = new Date(trip.created_at).toLocaleDateString('es-ES');

      return `
        <div class="saved-trip-card" data-trip-id="${trip.id}">
          <div class="saved-trip-header">
            <span class="saved-trip-theme">${themeIcons[trip.theme] || '⭐'}</span>
            <h4>${trip.city || 'Desconocida'}${trip.country ? ', ' + trip.country : ''}</h4>
            <button class="btn-icon btn-delete-trip" data-id="${trip.id}" title="Eliminar viaje">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
          <div class="saved-trip-meta">
            <span>${modeLabels[trip.transport_mode] || '🚗 Coche'}</span>
            <span>${distKm} km</span>
            <span>${durText}</span>
          </div>
          <div class="saved-trip-places">${placesArr.slice(0, 3).map(p => p.name).join(' → ')}${placesArr.length > 3 ? ' ...' : ''}</div>
          <div class="saved-trip-date">${dateStr}</div>
        </div>
      `;
    }).join('');

    tripsGrid.querySelectorAll('.btn-delete-trip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTrip(btn.dataset.id);
      });
    });

    tripsGrid.querySelectorAll('.saved-trip-card').forEach(card => {
      card.addEventListener('click', () => {
        const trip = trips.find(t => String(t.id) === card.dataset.tripId);
        if (trip) viewSavedTrip(trip);
      });
    });

  } catch (error) {
    console.error('Error al cargar viajes:', error);
  }
}

async function deleteTrip(id) {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const response = await fetch(`${API_BASE}/api/trips/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al eliminar');

    showToast('Viaje eliminado', 'success');
    loadMyTrips();
  } catch (error) {
    showToast('No se pudo eliminar el viaje', 'error');
  }
}

async function viewSavedTrip(trip) {
  selectedPlaces = trip.places || [];
  currentCity = trip.city;
  currentCountry = trip.country;
  userLocation = { lat: trip.origin_lat, lng: trip.origin_lng };
  selectedTransport = trip.transport_mode || 'driving';
  selectedTheme = trip.theme || 'classic';

  currentTrip = {
    ...trip,
    origin_lat: trip.origin_lat,
    origin_lng: trip.origin_lng,
    route_distance: trip.route_distance,
    route_duration: trip.route_duration
  };

  tripResult.classList.remove('hidden');
  tripTitle.innerHTML = `Tu Ruta en <span class="gradient-text">${currentCity || 'la zona'}</span>`;

  // Hide LLM warning for saved trips (already verified by user)
  const poiWarning = document.getElementById('poi-source-warning');
  if (poiWarning) poiWarning.classList.add('hidden');

  if (!map) initMap();
  map.setView([userLocation.lat, userLocation.lng], 13);
  showPlacesOnMap();

  try {
    await calculateRoute();
  } catch (error) {
    console.error('Error calculating route for saved trip:', error);
    showToast('No se pudo trazar la ruta en el mapa', 'error');
  }

  fetchWeather(userLocation.lat, userLocation.lng);
  tripResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== TIEMPO METEOROLOGICO ==========

const WEATHER_CODES = {
  0: { icon: '☀️', desc: 'Despejado' },
  1: { icon: '🌤️', desc: 'Mayormente despejado' },
  2: { icon: '⛅', desc: 'Parcialmente nublado' },
  3: { icon: '☁️', desc: 'Nublado' },
  45: { icon: '🌫️', desc: 'Niebla' },
  48: { icon: '🌫️', desc: 'Niebla helada' },
  51: { icon: '🌦️', desc: 'Llovizna ligera' },
  53: { icon: '🌦️', desc: 'Llovizna' },
  55: { icon: '🌧️', desc: 'Llovizna intensa' },
  61: { icon: '🌧️', desc: 'Lluvia ligera' },
  63: { icon: '🌧️', desc: 'Lluvia' },
  65: { icon: '🌧️', desc: 'Lluvia intensa' },
  71: { icon: '🌨️', desc: 'Nieve ligera' },
  73: { icon: '🌨️', desc: 'Nieve' },
  75: { icon: '❄️', desc: 'Nieve intensa' },
  80: { icon: '🌦️', desc: 'Chubascos ligeros' },
  81: { icon: '🌧️', desc: 'Chubascos' },
  82: { icon: '⛈️', desc: 'Chubascos fuertes' },
  95: { icon: '⛈️', desc: 'Tormenta' },
  96: { icon: '⛈️', desc: 'Tormenta con granizo' },
  99: { icon: '⛈️', desc: 'Tormenta fuerte con granizo' }
};

async function fetchWeather(lat, lng) {
  const widget = document.getElementById('weather-widget');
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    const current = data.current;

    const code = current.weather_code;
    const weather = WEATHER_CODES[code] || { icon: '🌡️', desc: 'Desconocido' };

    document.getElementById('weather-icon').textContent = weather.icon;
    document.getElementById('weather-temp').textContent = `${Math.round(current.temperature_2m)}°C`;
    document.getElementById('weather-desc').textContent = weather.desc;
    document.getElementById('weather-extra').textContent = `Humedad ${current.relative_humidity_2m}% · Viento ${Math.round(current.wind_speed_10m)} km/h`;

    widget.classList.remove('hidden');
  } catch (e) {
    console.error('Error fetching weather:', e);
    widget.classList.add('hidden');
  }
}

// ========== CERRAR RUTA ==========

function closeTrip() {
  tripResult.classList.add('hidden');
  routeOverlay.classList.add('hidden');
  document.getElementById('weather-widget').classList.add('hidden');
  if (markersLayer) markersLayer.clearLayers();
  if (routeLayer) routeLayer.clearLayers();
  if (map) { map.remove(); map = null; }
  selectedPlaces = [];
  currentTrip = null;
  currentCity = null;
  currentCountry = null;
}

// ========== TOAST ==========

function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast toast-${type}`;
  setTimeout(() => { toastEl.classList.add('toast-hide'); }, 2500);
  setTimeout(() => { toastEl.className = 'toast hidden'; }, 3000);
}

// ========== CARRUSEL DE INSPIRACION ==========

const INSPIRATION_EXAMPLES = [
  { city: 'Madrid', lat: 40.4168, lng: -3.7038, theme: 'classic', transport: 'walking', radius: 2, emoji: '\u{1F3DB}\uFE0F', tagline: 'Madrid historico a pie' },
  { city: 'Barcelona', lat: 41.3874, lng: 2.1686, theme: 'cultural', transport: 'walking', radius: 2, emoji: '\u{1F3A8}', tagline: 'Arte y cultura en Barcelona' },
  { city: 'Sevilla', lat: 37.3891, lng: -5.9845, theme: 'gastro', transport: 'walking', radius: 1.5, emoji: '\u{1F37D}\uFE0F', tagline: 'Tapas por Sevilla' },
  { city: 'Granada', lat: 37.1773, lng: -3.5986, theme: 'historical', transport: 'driving', radius: 5, emoji: '\u{1F3F0}', tagline: 'Granada monumental' },
  { city: 'Valencia', lat: 39.4699, lng: -0.3763, theme: 'nature', transport: 'cycling', radius: 5, emoji: '\u{1F333}', tagline: 'Valencia verde en bici' },
  { city: 'San Sebastian', lat: 43.3183, lng: -1.9812, theme: 'gastro', transport: 'walking', radius: 1.5, emoji: '\u{1F377}', tagline: 'Pintxos en Donostia' },
  { city: 'Toledo', lat: 39.8628, lng: -4.0273, theme: 'historical', transport: 'walking', radius: 1.5, emoji: '\u{2694}\uFE0F', tagline: 'Toledo medieval' },
  { city: 'Malaga', lat: 36.7213, lng: -4.4214, theme: 'surprise', transport: 'walking', radius: 2, emoji: '\u{1F3B2}', tagline: 'Sorpresa en Malaga' },
  { city: 'Bilbao', lat: 43.2630, lng: -2.9350, theme: 'cultural', transport: 'walking', radius: 2, emoji: '\u{1F3AD}', tagline: 'Cultura en Bilbao' },
  { city: 'Cordoba', lat: 37.8882, lng: -4.7794, theme: 'historical', transport: 'walking', radius: 1.5, emoji: '\u{1F54C}', tagline: 'Cordoba milenaria' },
];

const themeLabelsCarousel = {
  classic: 'Clasico', historical: 'Historico', gastro: 'Gastro',
  cultural: 'Cultural', nature: 'Naturaleza', surprise: 'Sorpresa'
};
const transportLabelsCarousel = {
  driving: 'Coche', walking: 'A pie', cycling: 'Bici'
};

function renderCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track) return;

  // Duplicate cards for seamless infinite loop
  const cardHtml = INSPIRATION_EXAMPLES.map((ex, i) => `
    <div class="carousel-card" data-index="${i}">
      <div class="carousel-card-emoji">${ex.emoji}</div>
      <div class="carousel-card-city">${ex.city}</div>
      <div class="carousel-card-tagline">${ex.tagline}</div>
      <div class="carousel-card-badges">
        <span class="carousel-badge">${themeLabelsCarousel[ex.theme]}</span>
        <span class="carousel-badge">${transportLabelsCarousel[ex.transport]}</span>
        <span class="carousel-badge">${ex.radius} km</span>
      </div>
    </div>
  `).join('');
  track.innerHTML = cardHtml + cardHtml;

  // Click handler
  track.querySelectorAll('.carousel-card').forEach(card => {
    card.addEventListener('click', () => {
      const ex = INSPIRATION_EXAMPLES[parseInt(card.dataset.index)];

      // Set all parameters from the example
      locationMode = 'search';
      searchLocation = { lat: ex.lat, lng: ex.lng };
      selectedTheme = ex.theme;
      selectedTransport = ex.transport;
      selectedRadius = ex.radius;

      // Update UI to reflect the selection
      document.querySelectorAll('.theme-card').forEach(c => {
        c.classList.toggle('active', c.dataset.theme === ex.theme);
      });
      document.querySelectorAll('.transport-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === ex.transport);
      });
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'search');
      });
      const searchContent = document.getElementById('tab-content-search');
      if (searchContent) searchContent.style.display = 'block';
      if (citySearch) citySearch.value = ex.city;

      updateSliderForTransport(ex.transport);
      const slider = document.getElementById('distance-slider');
      if (slider) {
        slider.value = ex.radius;
        selectedRadius = ex.radius;
        const distanceValue = document.getElementById('distance-value');
        if (distanceValue) distanceValue.textContent = `${ex.radius} km`;
      }

      // Generate the trip
      generateTrip();
    });
  });

}

// ========== EVENTOS ==========

generateBtn.addEventListener('click', generateTrip);
closeTripBtn.addEventListener('click', closeTrip);
shareTripBtn.addEventListener('click', shareTrip);

// ========== INICIO ==========

setupSelectors();
setupCitySearch();
renderCarousel();
initAuth();

console.log('RandomTrip Generator cargado');
