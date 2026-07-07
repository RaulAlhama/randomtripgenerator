export async function fetchAuthConfig() {
  const response = await fetch('/api/auth-config');
  return response.json();
}

export async function generateTrip(lat, lng, theme, transport, radiusMeters, count, city, country, fast) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    theme,
    transport,
    radius: String(radiusMeters),
  });
  if (count) params.set('count', String(count));
  if (city) params.set('city', city);
  if (country) params.set('country', country);
  if (fast) params.set('fast', '1');
  const response = await fetch(`/api/generate-trip?${params}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al generar la ruta');
  }
  return response.json();
}

// Backfill descriptions for a fast (description-less) candidate response.
export async function fetchPlaceDescriptions(places, city, country, theme) {
  const response = await fetch('/api/descriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ places, city, country, theme }),
  });
  if (!response.ok) throw new Error('No se pudieron obtener las descripciones');
  return response.json();
}

export async function getRoute(start, waypoints, mode) {
  const params = new URLSearchParams({
    start,
    waypoints,
    mode,
  });
  const response = await fetch(`/api/route?${params}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al calcular la ruta');
  }
  return response.json();
}

export async function searchCity(query) {
  const response = await fetch(`/api/search-city?q=${encodeURIComponent(query)}`);
  return response.json();
}

export async function fetchRestaurants(lat, lng, radiusMeters) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
  });
  const response = await fetch(`/api/restaurants?${params}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudieron obtener los restaurantes');
  }
  return response.json();
}

export async function fetchHikingTrails(lat, lng, radiusMeters) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
  });
  const response = await fetch(`/api/hiking-trails?${params}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudieron obtener los senderos');
  }
  return response.json();
}

// Create a public share link for a built route. Returns { slug }.
export async function createShareLink(payload) {
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo crear el enlace');
  }
  return response.json();
}

export async function fetchSharedTrip(slug) {
  const response = await fetch(`/api/share/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Esta ruta ya no está disponible');
  }
  return response.json();
}

export async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Weather fetch failed');
  }
  return response.json();
}
