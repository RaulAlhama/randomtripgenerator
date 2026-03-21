require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { initDatabase, query } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve React build if available, otherwise fall back to public/
const clientDist = path.join(__dirname, 'client', 'dist');
const publicDir = path.join(__dirname, 'public');
app.use(express.static(fs.existsSync(clientDist) ? clientDist : publicDir));

// Optional Auth0 JWT validation
let jwtCheck = null;
if (process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE) {
  try {
    const { auth } = require('express-oauth2-jwt-bearer');
    jwtCheck = auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
      tokenSigningAlg: 'RS256'
    });
    console.log('[Auth0] JWT validation enabled');
  } catch (e) {
    console.warn('[Auth0] express-oauth2-jwt-bearer not available, auth disabled');
  }
}

// Auth middleware for protected routes
function requireAuth(req, res, next) {
  if (!jwtCheck) {
    return res.status(503).json({ error: 'Authentication not configured on server' });
  }
  jwtCheck(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Invalid or missing token' });
    next();
  });
}

// Theme definitions (in Spanish for the LLM prompt)
const THEME_PROMPTS = {
  monuments: 'monumentos, edificios historicos, estatuas, iglesias, palacios, castillos, ruinas y lugares emblematicos de gran importancia arquitectonica o historica',
  nature: 'parques, jardines botanicos, miradores, paseos junto al rio, senderos, espacios naturales verdes y paisajes destacados',
  food: 'mercados de comida, restaurantes famosos, barrios gastronomicos, panaderias, bares de tapas y referentes culinarios locales'
};

// Transport mode config
const TRANSPORT_CONFIG = {
  driving: { radiusMeters: 5000, speedKmh: null },
  walking: { radiusMeters: 1500, speedKmh: 5 },
  cycling: { radiusMeters: 5000, speedKmh: 15 }
};

function getRadiusHint(transport, maxDistanceMeters) {
  const km = (maxDistanceMeters / 1000).toFixed(1).replace(/\.0$/, '');
  if (transport === 'walking') {
    return `a distancia a pie del punto de inicio (la ruta total NO debe superar ${km} km, preferiblemente en el mismo barrio)`;
  } else if (transport === 'cycling') {
    return `a distancia en bicicleta del punto de inicio (la ruta total NO debe superar ${km} km)`;
  }
  return `repartidos por la ciudad (la ruta total NO debe superar ${km} km)`;
}

// Semillas de variedad para inyectar aleatoriedad en los prompts
const VARIETY_SEEDS = [
  'Crea una ruta unica diferente de las guias turisticas tipicas.',
  'Sorprende al viajero con una combinacion inesperada de lugares.',
  'Piensa como un local apasionado enseñando su ciudad a un amigo por primera vez.',
  'Prioriza lugares con ambientes increibles y oportunidades fotograficas.',
  'Prioriza lugares que cuenten la historia de esta ciudad.',
  'Combina lugares conocidos con al menos un sitio fuera de lo comun.',
  'Crea una ruta que fluya naturalmente y cuente una narrativa sobre la zona.',
  'Incluye lugares que muestren diferentes facetas de la cultura local.',
  'Elige sitios que sean especialmente atmosfericos a diferentes horas del dia.',
  'Selecciona lugares que un viajero curioso recordaria años despues.'
];

// Helper function to fetch from external APIs
function fetchExternal(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    // Ensure headers object exists and set default User-Agent
    if (!options.headers) options.headers = {};
    if (!options.headers['User-Agent']) {
      options.headers['User-Agent'] = 'RandomTripGenerator/1.0';
    }
    const request = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    request.on('error', reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

// Fetch image URL for a POI using Wikipedia/Wikidata
async function fetchPOIImage(place, city) {
  try {
    // 1. If Overpass gave us a direct image URL
    if (place.image) {
      if (place.image.startsWith('http')) return place.image;
      // wikimedia_commons format: "File:Something.jpg"
      const filename = place.image.replace(/^File:/, '');
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=400`;
    }

    // 2. If we have a wikipedia tag (e.g., "es:Puerta de Alcalá")
    if (place.wikipedia) {
      const parts = place.wikipedia.split(':');
      const lang = parts.length > 1 ? parts[0] : 'es';
      const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const data = await fetchExternal(url);
      if (data.thumbnail?.source) return data.thumbnail.source;
    }

    // 3. If we have a wikidata ID
    if (place.wikidata) {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${place.wikidata}&props=claims&format=json`;
      const data = await fetchExternal(url);
      const entity = data.entities?.[place.wikidata];
      const imageClaim = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (imageClaim) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageClaim)}?width=400`;
      }
    }

    // 4. Fallback: search Wikipedia by name + city
    const searchQuery = `${place.name} ${city}`;
    const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json`;
    const searchData = await fetchExternal(searchUrl);
    const pages = searchData.query?.pages;
    if (pages) {
      const firstPage = Object.values(pages)[0];
      if (firstPage?.thumbnail?.source) return firstPage.thumbnail.source;
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Fetch images for all places in parallel
async function fetchAllPOIImages(places, city) {
  const imagePromises = places.map(p => fetchPOIImage(p, city));
  const images = await Promise.all(imagePromises);
  return places.map((p, i) => ({
    ...p,
    imageUrl: images[i] || null
  }));
}

// Follow a redirect and return the final URL
function followRedirect(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'RandomTripGenerator/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(res.headers.location || null);
      } else {
        resolve(null);
      }
      res.resume();
    });
    req.on('error', reject);
    req.end();
  });
}

// Get city name from coordinates using Nominatim
async function getCityFromCoords(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=es`;
  try {
    const data = await fetchExternal(url);
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'this area';
    const country = data.address?.country || '';
    return { city, country, displayName: data.display_name };
  } catch (error) {
    console.error('[Nominatim] Error:', error.message);
    return { city: 'this area', country: '', displayName: 'unknown location' };
  }
}

// Map Overpass types to our display types
const OVERPASS_TYPE_MAP = {
  attraction: 'monument', museum: 'museum', viewpoint: 'viewpoint', artwork: 'monument',
  gallery: 'museum', information: 'viewpoint', castle: 'palace', ruins: 'historic',
  monument: 'monument', memorial: 'monument', archaeological_site: 'historic',
  church: 'church', monastery: 'church', chapel: 'church', cathedral: 'church',
  place_of_worship: 'church', restaurant: 'restaurant', cafe: 'restaurant',
  marketplace: 'market', theatre: 'theater', park: 'park', garden: 'garden',
  fountain: 'plaza', spring: 'viewpoint', peak: 'viewpoint', cave_entrance: 'viewpoint',
  tower: 'viewpoint', bridge: 'monument'
};

// Get real POIs from OpenStreetMap via Overpass API
async function getOverpassPOIs(lat, lng, radiusMeters) {
  try {
    // For larger radii, use a simpler query to avoid timeouts
    const isLargeRadius = radiusMeters > 2000;
    const timeout = isLargeRadius ? 25 : 15;

    let query;
    if (isLargeRadius) {
      // Simplified query for driving/cycling - focus on main attractions
      query = `[out:json][timeout:${timeout}];(
        node["tourism"~"attraction|museum|viewpoint"](around:${radiusMeters},${lat},${lng});
        node["historic"](around:${radiusMeters},${lat},${lng});
        node["amenity"~"restaurant|marketplace|place_of_worship|theatre"](around:${radiusMeters},${lat},${lng});
        node["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        way["tourism"~"attraction|museum"](around:${radiusMeters},${lat},${lng});
        way["historic"](around:${radiusMeters},${lat},${lng});
        way["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
      );out center body;`;
    } else {
      // Detailed query for walking - catch everything nearby
      query = `[out:json][timeout:${timeout}];(
        node["tourism"~"attraction|museum|viewpoint|artwork|gallery|information"](around:${radiusMeters},${lat},${lng});
        node["historic"](around:${radiusMeters},${lat},${lng});
        node["amenity"~"restaurant|cafe|marketplace|place_of_worship|theatre|fountain"](around:${radiusMeters},${lat},${lng});
        node["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        node["natural"~"spring|peak|cave_entrance"](around:${radiusMeters},${lat},${lng});
        node["man_made"~"tower|bridge"](around:${radiusMeters},${lat},${lng});
        way["tourism"~"attraction|museum|viewpoint"](around:${radiusMeters},${lat},${lng});
        way["historic"](around:${radiusMeters},${lat},${lng});
        way["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        way["amenity"~"marketplace|place_of_worship|theatre"](around:${radiusMeters},${lat},${lng});
        way["building"~"church|chapel|castle|cathedral"](around:${radiusMeters},${lat},${lng});
        relation["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        relation["tourism"~"attraction"](around:${radiusMeters},${lat},${lng});
      );out center body;`;
    }

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const data = await fetchExternal(url);

    if (!data.elements) return [];

    const pois = data.elements
      .filter(el => el.tags?.name)
      .map(el => {
        const rawType = el.tags.tourism || el.tags.historic || el.tags.amenity || el.tags.leisure || el.tags.natural || el.tags.man_made || el.tags.building || 'place';
        return {
          name: el.tags.name,
          rawType,
          type: OVERPASS_TYPE_MAP[rawType] || 'monument',
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          wikipedia: el.tags.wikipedia || null,
          wikidata: el.tags.wikidata || null,
          image: el.tags.image || el.tags.wikimedia_commons || null
        };
      })
      .filter(p => p.lat && p.lng);

    // Deduplicate by name
    const seen = new Set();
    const unique = pois.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Overpass] Found ${unique.length} real POIs within ${radiusMeters}m`);
    return unique;
  } catch (error) {
    console.error('[Overpass] Error:', error.message);
    return [];
  }
}

// Theme-based relevance scoring for POI filtering
const THEME_TYPE_SCORES = {
  monuments: { monument: 3, historic: 3, castle: 3, ruins: 3, archaeological_site: 3, memorial: 3, church: 3, palace: 3, museum: 2, artwork: 2, attraction: 2, tower: 2 },
  nature: { park: 3, garden: 3, viewpoint: 3, spring: 3, peak: 3, cave_entrance: 2 },
  food: { restaurant: 3, cafe: 3, marketplace: 3 }
};

// Select and shuffle POIs based on theme
function selectPOIsForTheme(pois, theme, count) {
  const scores = THEME_TYPE_SCORES[theme] || {};
  const hasThemeScores = Object.keys(scores).length > 0;

  if (!hasThemeScores) {
    // Shuffle randomly
    const shuffled = [...pois].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Score each POI by theme relevance
  const scored = pois.map(p => ({
    ...p,
    score: (scores[p.rawType] || 1) + Math.random() * 0.5  // add randomness
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

// Sort POIs in nearest-neighbor order starting from origin to minimize total route distance
function sortByProximity(pois, originLat, originLng) {
  if (pois.length <= 1) return pois;

  const toRad = d => d * Math.PI / 180;
  function distMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const ordered = [];
  const remaining = [...pois];
  let curLat = originLat, curLng = originLng;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distMeters(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }
  return ordered;
}

// Estimate total route distance (straight line) from origin through all POIs
function estimateRouteDistance(pois, originLat, originLng) {
  const toRad = d => d * Math.PI / 180;
  function distMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let total = 0;
  let prevLat = originLat, prevLng = originLng;
  for (const p of pois) {
    total += distMeters(prevLat, prevLng, p.lat, p.lng);
    prevLat = p.lat;
    prevLng = p.lng;
  }
  return total;
}

// Call Nebius API to get descriptions for real POIs
async function getDescriptionsFromLLM(places, city, country, theme) {
  try {
    const apiKey = process.env.NEBIUS_API_KEY;
    const apiBaseUrl = process.env.NEBIUS_API_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/';

    if (!apiKey) {
      console.warn('[Nebius] No API key, skipping descriptions');
      return null;
    }

    const themeDesc = THEME_PROMPTS[theme] || THEME_PROMPTS.monuments;
    const varietySeed = VARIETY_SEEDS[Math.floor(Math.random() * VARIETY_SEEDS.length)];

    const placeList = places.map((p, i) => `${i + 1}. ${p.name} (tipo: ${p.type})`).join('\n');

    const prompt = `Eres un experto en turismo. El usuario visita ${city}${country ? ', ' + country : ''}.
La tematica de la ruta es: ${themeDesc}.

${varietySeed}

Genera una descripcion breve y atractiva EN ESPAÑOL (1-2 frases) para cada uno de estos lugares reales.
La descripcion debe explicar QUE es el lugar y POR QUE merece la pena visitarlo.

${placeList}

Devuelve un JSON con una clave "descriptions" que sea un array de strings, una descripcion por lugar, en el MISMO ORDEN que la lista anterior.
Ejemplo: {"descriptions": ["Estatua del siglo XIX dedicada al poeta, ubicada en un rincón tranquilo del Retiro.", "Mercado historico con los mejores productos frescos de la ciudad.", ...]}

IMPORTANTE: Cada descripcion debe ser informativa y especifica sobre ese lugar concreto. NO uses descripciones genericas.`;

    console.log('[Nebius] Requesting descriptions for', places.length, 'places in', city);

    const requestBody = JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'Eres un experto en turismo. Responde con JSON valido. Todas las descripciones en español. Cada descripcion debe ser especifica e informativa sobre el lugar.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    const response = await fetchExternal(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody
    });

    if (response.error || response.detail) {
      console.error('[Nebius] API error getting descriptions:', response.error?.message || response.detail);
      return null;
    }

    const content = response.choices?.[0]?.message?.content || '';
    if (!content) {
      console.error('[Nebius] Empty descriptions response');
      return null;
    }

    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    const parsed = JSON.parse(cleanContent);
    const descriptions = parsed.descriptions || Object.values(parsed).find(v => Array.isArray(v));
    if (Array.isArray(descriptions)) return descriptions;

    console.error('[Nebius] Unexpected descriptions format:', Object.keys(parsed));
    return null;
  } catch (e) {
    console.error('[Nebius] Failed to get descriptions:', e.message);
    return null;
  }
}

// Fallback: Call Nebius API to get full tourist route (when Overpass has no data)
async function getTouristRouteFromLLM(city, lat, lng, country, theme, transport, maxRouteDistance) {
  const apiKey = process.env.NEBIUS_API_KEY;
  const apiBaseUrl = process.env.NEBIUS_API_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/';

  if (!apiKey) throw new Error('NEBIUS_API_KEY not configured');

  const themeDesc = THEME_PROMPTS[theme] || THEME_PROMPTS.monuments;
  const transportConf = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.driving;
  const varietySeed = VARIETY_SEEDS[Math.floor(Math.random() * VARIETY_SEEDS.length)];
  const maxKm = maxRouteDistance ? maxRouteDistance / 1000 : (transport === 'walking' ? 3 : 10);
  const placeCount = maxKm <= 1.5 ? '3' : maxKm <= 3 ? '4' : maxKm <= 6 ? '5' : '5-7';
  const modeLabel = transport === 'walking' ? 'a pie' : transport === 'cycling' ? 'en bicicleta' : 'en coche';

  const prompt = `Eres un experto en viajes y turismo. El usuario esta en ${city}${country ? ', ' + country : ''} (coordenadas: ${lat}, ${lng}).

Crea una ruta turistica visitando ${placeCount} lugares enfocada en: ${themeDesc}.

Los lugares deben estar ${getRadiusHint(transport, maxRouteDistance || transportConf.radiusMeters * 2)}.

${varietySeed}

Para cada lugar incluye:
- name: Nombre exacto del lugar real (en el idioma local)
- type: Categoria (monument, museum, park, plaza, church, palace, viewpoint, historic, restaurant, market, garden, theater)
- lat: Latitud GPS real
- lng: Longitud GPS real
- description: Una frase atractiva en ESPAÑOL explicando por que merece la pena visitarlo

Devuelve un objeto JSON con una clave "places" que contenga un array:
{"places": [{"name": "Nombre del Lugar", "type": "monument", "lat": ${lat.toFixed(2)}, "lng": ${lng.toFixed(2)}, "description": "Descripcion en español"}, ...]}

IMPORTANTE: Usa coordenadas REALES de lugares verificados que existan en ${city}. Si no estas seguro de que un lugar existe, NO lo incluyas. Devuelve exactamente ${placeCount} lugares. Ordenalos para una ruta ${modeLabel}.`;

  console.log('[Nebius] Fallback: requesting full route for:', city, '| theme:', theme, '| transport:', transport);

  const requestBody = JSON.stringify({
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: 'Eres un experto en viajes y turismo. Responde siempre con JSON valido, sin markdown. Todas las descripciones en español.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.85,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  const response = await fetchExternal(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: requestBody
  });

  if (response.error || response.detail) {
    const errMsg = response.error?.message || response.detail || JSON.stringify(response.error || response);
    throw new Error(`Nebius API error: ${errMsg}`);
  }

  const content = response.choices?.[0]?.message?.content || '';

  if (!content) {
    console.error('[Nebius] Empty response:', JSON.stringify(response).substring(0, 500));
    throw new Error('Empty response from LLM');
  }

  let cleanContent = content;
  if (content.includes('```json')) {
    cleanContent = content.replace(/```json\n?/, '').replace(/```\n?$/, '');
  } else if (content.includes('```')) {
    cleanContent = content.replace(/```\n?/, '').replace(/```\n?$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    console.error('[Nebius] Failed to parse JSON:', cleanContent.substring(0, 300));
    throw new Error('LLM returned invalid JSON');
  }

  // Extract array from various response shapes
  let places = [];
  if (Array.isArray(parsed)) {
    places = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    if (parsed.name && parsed.lat && parsed.lng) {
      places = [parsed];
    } else {
      const found = parsed.places || parsed.route || parsed.results || parsed.data ||
        Object.values(parsed).find(v => Array.isArray(v));
      if (found) {
        places = Array.isArray(found) ? found : [found];
      } else {
        for (const val of Object.values(parsed)) {
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            const nested = Object.values(val).find(vv => Array.isArray(vv));
            if (nested && nested.length > 0) { places = nested; break; }
          }
        }
      }
    }
  }

  places = places.filter(p => p && p.name && (p.lat !== undefined) && (p.lng !== undefined));

  // Validate coordinates are in valid range and near the requested city
  places = places.filter(p => {
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return false;
    // Check POI is within ~50km of requested location (catch hallucinated coords)
    const dlat = Math.abs(p.lat - lat) * 111;
    const dlng = Math.abs(p.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng) < 50;
  });

  console.log('[Nebius] Parsed places count:', places.length);
  return places;
}

// Main function: build route from real POIs + LLM descriptions
async function buildRoute(city, lat, lng, country, theme, transport, realPOIs, maxRouteDistance) {
  // Adjust number of stops based on max route distance
  const maxKm = maxRouteDistance ? maxRouteDistance / 1000 : (transport === 'walking' ? 3 : 10);
  let desiredCount;
  if (maxKm <= 1.5) desiredCount = 3;
  else if (maxKm <= 3) desiredCount = 4;
  else if (maxKm <= 6) desiredCount = 5;
  else desiredCount = 6;

  let pois = realPOIs;

  // Adaptive retry: if too few POIs, try progressively wider radii
  if (pois.length < 3) {
    const initialRadius = Math.round(maxRouteDistance / 4);
    const fallbackRadii = [
      Math.round(initialRadius * 2),
      Math.round(initialRadius * 3),
      1500,
      800
    ].filter((r, i, arr) => arr.indexOf(r) === i); // deduplicate

    for (const fallbackR of fallbackRadii) {
      console.log(`[Route] Only ${pois.length} POIs, retrying with ${fallbackR}m radius`);
      pois = await getOverpassPOIs(lat, lng, fallbackR);
      if (pois.length >= 3) break;
    }
  }

  if (pois.length > 0) {
    let selected = selectPOIsForTheme(pois, theme, Math.min(desiredCount, pois.length));
    // Sort in walking order to minimize total route distance
    let sorted = sortByProximity(selected, lat, lng);

    // Estimate route distance and trim POIs if over budget
    if (maxRouteDistance) {
      const roadFactor = 1.4; // roads are ~1.4x longer than straight line
      let estimatedDist = estimateRouteDistance(sorted, lat, lng) * roadFactor;
      while (sorted.length > 2 && estimatedDist > maxRouteDistance) {
        sorted.pop(); // remove last (farthest in the chain)
        estimatedDist = estimateRouteDistance(sorted, lat, lng) * roadFactor;
        console.log(`[Route] Trimmed to ${sorted.length} POIs, estimated ${Math.round(estimatedDist)}m vs max ${maxRouteDistance}m`);
      }
    }

    console.log(`[Route] Using ${sorted.length} verified Overpass POIs (nearest-neighbor sorted)`);

    // Ask LLM only for descriptions
    const descriptions = await getDescriptionsFromLLM(sorted, city, country, theme);

    const places = sorted.map((p, i) => ({
      name: p.name,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      description: (descriptions && descriptions[i]) || `Lugar de interés en ${city}.`,
      wikipedia: p.wikipedia || null,
      wikidata: p.wikidata || null,
      imageUrl: p.image && p.image.startsWith('http') ? p.image : null
    }));
    return { places, poiSource: 'overpass' };
  }

  // Last resort: no Overpass data at all (very remote area) - use LLM but warn
  console.log('[Route] No Overpass POIs found at any radius, falling back to LLM');
  const places = await getTouristRouteFromLLM(city, lat, lng, country, theme, transport, maxRouteDistance);
  return { places, poiSource: 'llm' };
}

// ========== PUBLIC ENDPOINTS ==========

// Auth config for frontend
app.get('/api/auth-config', (req, res) => {
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID) {
    return res.json({ enabled: false });
  }
  res.json({
    enabled: true,
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    audience: process.env.AUTH0_AUDIENCE
  });
});

// Search cities via Nominatim
app.get('/api/search-city', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const results = await fetchExternal(url);

    if (!Array.isArray(results)) {
      return res.json([]);
    }

    const cities = results
      .slice(0, 5)
      .map(r => ({
        name: r.address?.city || r.address?.town || r.address?.village || r.name,
        country: r.address?.country || '',
        displayName: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon)
      }));

    res.json(cities);
  } catch (error) {
    console.error('[Search] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get place image via Google Places API
app.get('/api/place-image', async (req, res) => {
  const { name, city } = req.query;
  if (!name) return res.json({ url: null });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.json({ url: null });

  try {
    const query = encodeURIComponent(`${name} ${city || ''}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    const data = await fetchExternal(searchUrl);

    const photoRef = data.results?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) return res.json({ url: null });

    // Follow redirect to get CDN URL (no API key exposed to frontend)
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
    const cdnUrl = await followRedirect(photoApiUrl);

    res.json({ url: cdnUrl || null });
  } catch (e) {
    console.error('[Places] Error fetching image:', e.message);
    res.json({ url: null });
  }
});

// Generate trip
app.get('/api/generate-trip', async (req, res) => {
  try {
    const { lat, lng, theme = 'classic', transport = 'driving', radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Coordinates required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const VALID_THEMES = ['monuments', 'nature', 'food'];
    const VALID_TRANSPORTS = ['driving', 'walking', 'cycling'];
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'monuments';
    const safeTransport = VALID_TRANSPORTS.includes(transport) ? transport : 'driving';

    const transportConf = TRANSPORT_CONFIG[safeTransport] || TRANSPORT_CONFIG.driving;
    // radius from frontend = desired max route distance in meters
    // Divisor accounts for: zigzag between POIs + road vs straight-line factor (~1.3x)
    const radiusDivisor = safeTransport === 'walking' ? 4.5 : safeTransport === 'cycling' ? 3.5 : 2.5;
    const maxRouteDistance = radius ? Math.min(parseInt(radius), 20000) : transportConf.radiusMeters * 2;
    const searchRadius = Math.round(maxRouteDistance / radiusDivisor);

    // Fetch city name and real POIs in parallel
    const [locationInfo, realPOIs] = await Promise.all([
      getCityFromCoords(latNum, lngNum),
      getOverpassPOIs(latNum, lngNum, searchRadius)
    ]);
    console.log('[API] Location:', locationInfo.city, locationInfo.country, '| Real POIs:', realPOIs.length);

    const { places, poiSource } = await buildRoute(
      locationInfo.city, latNum, lngNum, locationInfo.country, safeTheme, safeTransport, realPOIs, maxRouteDistance
    );

    if (!places || places.length === 0) {
      return res.status(404).json({ error: 'No places found' });
    }

    res.json({
      city: locationInfo.city,
      country: locationInfo.country,
      origin: { lat: latNum, lng: lngNum },
      theme: safeTheme,
      transport: safeTransport,
      places,
      poiSource
    });
  } catch (error) {
    console.error('Error generating trip:', error);
    res.status(500).json({ error: 'Failed to generate trip: ' + error.message });
  }
});

// Get route via OSRM
app.get('/api/route', async (req, res) => {
  try {
    const { start, waypoints, mode = 'driving' } = req.query;

    if (!start || !waypoints) {
      return res.status(400).json({ error: 'Start and waypoints required' });
    }

    const startCoords = start.split(',').map(Number);
    const waypointList = waypoints.split(';').map(wp => wp.split(',').map(Number));

    // OSRM format: lon,lat
    let osrmCoords = `${startCoords[1]},${startCoords[0]}`;
    waypointList.forEach(wp => {
      osrmCoords += `;${wp[1]},${wp[0]}`;
    });

    // Public OSRM only supports driving reliably
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;
    const data = await fetchExternal(osrmUrl);

    if (data.code !== 'Ok') {
      return res.status(400).json({ error: 'No route found' });
    }

    const route = data.routes[0];
    let duration = route.duration;

    // Adjust duration for non-driving modes
    const transportConfig = TRANSPORT_CONFIG[mode];
    if (transportConfig && transportConfig.speedKmh) {
      duration = (route.distance / 1000 / transportConfig.speedKmh) * 3600;
    }

    res.json({
      geometry: route.geometry,
      distance: route.distance,
      duration,
      mode,
      legs: route.legs
    });
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

// ========== AUTHENTICATED ENDPOINTS ==========

// Save trip
app.post('/api/trips', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { city, country, origin_lat, origin_lng, theme, transport_mode, places, route_distance, route_duration } = req.body;

    const result = await query(
      `INSERT INTO trips (user_id, city, country, origin_lat, origin_lng, theme, transport_mode, places, route_distance, route_duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        userId,
        city || '',
        country || '',
        origin_lat,
        origin_lng,
        theme || 'monuments',
        transport_mode || 'driving',
        JSON.stringify(places || []),
        route_distance,
        route_duration
      ]
    );

    res.json({ id: result.rows[0].id, message: 'Trip saved' });
  } catch (error) {
    console.error('Error saving trip:', error);
    res.status(500).json({ error: 'Failed to save trip' });
  }
});

// Get user's trips
app.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const result = await query('SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC', [userId]);

    const parsed = result.rows.map(t => ({
      ...t,
      places: t.places ? JSON.parse(t.places) : []
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error getting trips:', error);
    res.status(500).json({ error: 'Failed to get trips' });
  }
});

// Delete trip
app.delete('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const tripId = req.params.id;

    const result = await query('DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id', [tripId, userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({ message: 'Trip deleted' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Serve SPA
// SPA catch-all: serve React build or fallback to public
app.get('*', (req, res) => {
  const indexPath = fs.existsSync(clientDist)
    ? path.join(clientDist, 'index.html')
    : path.join(publicDir, 'index.html');
  res.sendFile(indexPath);
});

// Start server
async function startServer() {
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Cerrar limpiamente con Ctrl+C para liberar el puerto
  process.on('SIGINT', () => {
    console.log('\nCerrando servidor...');
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

startServer();
