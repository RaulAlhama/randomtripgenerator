require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { initDatabase, query } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, espera un momento' }
});

const generateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has generado muchas rutas, espera un momento' }
});

const restaurantsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has hecho muchas busquedas, espera un momento' }
});

app.use('/api/', apiLimiter);
app.use('/api/generate-trip', generateLimiter);
app.use('/api/restaurants', restaurantsLimiter);

// ========== GOOGLE PLACES DAILY BUDGET ==========
// In-memory cost counter shared by /api/generate-trip and /api/restaurants.
// Resets at UTC midnight. Estimated costs are conservative (worst-case Google
// Places API pricing) so we'd rather block early than overshoot.
const DAILY_BUDGET_USD = parseFloat(process.env.GOOGLE_PLACES_DAILY_BUDGET_USD || '6');
const COST_PER_TRIP_USD = 0.30;       // ~8 text searches + 8 photos
const COST_PER_RESTAURANTS_USD = 0.15; // 1 nearby + up to 12 photos

let dailyCostUsd = 0;
let budgetDayKey = new Date().toISOString().slice(0, 10);

function tryReserveBudget(estimatedUsd) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDayKey) {
    console.log(`[Budget] Reset: previous day spent $${dailyCostUsd.toFixed(2)}`);
    dailyCostUsd = 0;
    budgetDayKey = today;
  }
  if (dailyCostUsd + estimatedUsd > DAILY_BUDGET_USD) {
    console.warn(`[Budget] EXCEEDED — at $${dailyCostUsd.toFixed(2)}/$${DAILY_BUDGET_USD} for ${budgetDayKey}, rejecting request (+$${estimatedUsd.toFixed(2)})`);
    return false;
  }
  dailyCostUsd += estimatedUsd;
  const pct = (dailyCostUsd / DAILY_BUDGET_USD) * 100;
  if (pct >= 80) {
    console.warn(`[Budget] ${pct.toFixed(0)}% used — $${dailyCostUsd.toFixed(2)}/$${DAILY_BUDGET_USD} on ${budgetDayKey}`);
  }
  return true;
}

function budgetExceededResponse(res) {
  return res.status(429).json({
    error: 'Hemos alcanzado el limite diario gratuito. Vuelve a intentarlo manana.'
  });
}

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

// ========== IN-MEMORY CACHE ==========
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  // Limitar tamaño del caché (max 500 entradas)
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, time: Date.now() });
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
  mixed: 'una mezcla equilibrada de lo mejor de la zona: monumentos, plazas, parques, museos, miradores y rincones con encanto sin ceñirse a una sola categoria',
  monuments: 'monumentos, edificios historicos, estatuas, iglesias, palacios, castillos, ruinas y lugares emblematicos de gran importancia arquitectonica o historica',
  nature: 'parques, jardines botanicos, miradores, paseos junto al rio, senderos, espacios naturales verdes y paisajes destacados',
  food: 'mercados de comida, restaurantes famosos, barrios gastronomicos, panaderias, bares de tapas y referentes culinarios locales',
  historical: 'lugares con peso historico: yacimientos, edificios con historia, barrios antiguos, museos historicos, monumentos conmemorativos y rincones cargados de memoria',
  cultural: 'museos, teatros, centros culturales, galerias de arte, espacios bohemios, librerias historicas y barrios con vida cultural propia',
  classic: 'los lugares imprescindibles que cualquier visitante deberia ver al menos una vez: hitos icónicos, plazas centrales, miradores famosos y referentes turisticos consagrados',
  surprise: 'una mezcla inesperada de rincones poco conocidos, sitios curiosos, lugares con historias interesantes y propuestas fuera de las guias turisticas habituales'
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

// ========== IMAGE RESOLUTION ==========
// Normalize text for fuzzy matching: lowercase, strip accents and non-alphanumeric
function normalizeText(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Check whether a Wikipedia page title is a plausible match for the POI.
// Accepts if: the title contains all significant words of the POI name,
// OR the title contains the POI name AND mentions the city.
function titleMatchesPOI(title, poiName, city) {
  const t = normalizeText(title);
  const name = normalizeText(poiName);
  const cityN = normalizeText(city);
  if (!t || !name) return false;

  // Ignore very common words that cause false positives ("iglesia", "parque", etc.)
  const STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'a', 'san', 'santa']);
  const nameTokens = name.split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w));
  if (nameTokens.length === 0) return false;

  const allNameTokensInTitle = nameTokens.every(tok => t.includes(tok));
  if (!allNameTokensInTitle) return false;

  // If the POI name collapses to a single significant token, it's ambiguous —
  // require the city to appear in the title to prevent cross-city matches
  // ("Iglesia", "Retiro", "Prado" on their own).
  if (nameTokens.length === 1) {
    if (!cityN) return false;
    return t.includes(cityN);
  }
  return true;
}

// In-memory image cache (key -> url) with same TTL as main cache
const imageCache = new Map();
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h (images rarely change)

function imageCacheGet(key) {
  const entry = imageCache.get(key);
  if (!entry) return undefined; // undefined = miss; null = known no-image
  if (Date.now() - entry.time > IMAGE_CACHE_TTL) {
    imageCache.delete(key);
    return undefined;
  }
  return entry.url;
}

function imageCacheSet(key, url) {
  if (imageCache.size > 2000) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
  imageCache.set(key, { url, time: Date.now() });
}

// Build a stable cache key for a place
function imageCacheKey(place, city) {
  if (place.wikidata) return `wd:${place.wikidata}`;
  if (place.wikipedia) return `wp:${place.wikipedia}`;
  return `nc:${normalizeText(place.name)}|${normalizeText(city)}`;
}

// Strategy 1: Wikipedia page summary via explicit title
async function imageFromWikipediaTitle(title, lang = 'es') {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const data = await fetchExternal(url);
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch (_) {
    return null;
  }
}

// Strategy 2: Wikidata entity → P18 image claim → Commons FilePath
async function imageFromWikidata(id) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=claims&format=json&origin=*`;
    const data = await fetchExternal(url);
    const claim = data?.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!claim) return null;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(claim)}?width=600`;
  } catch (_) {
    return null;
  }
}

// Strategy 3: Wikipedia search by "name + city", pick a page whose title plausibly matches.
// Tries Spanish first, then English. Requires title to contain all significant tokens of POI name.
async function imageFromWikipediaSearch(name, city) {
  const query = city ? `${name} ${city}` : name;
  for (const lang of ['es', 'en']) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=pageimages|info&piprop=thumbnail&pithumbsize=600&inprop=url&format=json&origin=*`;
      const data = await fetchExternal(searchUrl);
      const pages = data?.query?.pages;
      if (!pages) continue;

      const candidates = Object.values(pages)
        .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

      for (const page of candidates) {
        if (!page?.thumbnail?.source) continue;
        if (!titleMatchesPOI(page.title, name, city)) continue;
        return page.thumbnail.source;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

// Strategy 4: Wikimedia Commons search (last resort — no city context, weaker signal)
async function imageFromCommons(name, city) {
  if (!city) return null;
  try {
    const query = `${name} ${city}`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`;
    const data = await fetchExternal(url);
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const info = p?.imageinfo?.[0];
      if (!info) continue;
      // Ensure filename references the POI (fuzzy)
      const fn = normalizeText(p.title || '');
      if (!fn.includes(normalizeText(name).split(' ')[0])) continue;
      return info.thumburl || info.url;
    }
  } catch (_) { /* ignore */ }
  return null;
}

// Resolve a Wikimedia Commons category (e.g. "Category:Foo") to a real file
// thumbnail. OSM's `wikimedia_commons` tag is frequently a category, which is
// NOT a valid Special:FilePath target — building a FilePath URL from it 404s.
async function imageFromCommonsCategory(category) {
  try {
    const title = `Category:${category.replace(/^Category:/i, '')}`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(title)}&gcmtype=file&gcmlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`;
    const data = await fetchExternal(url);
    const pages = data?.query?.pages;
    if (!pages) return null;
    const files = Object.values(pages)
      .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
      .map(p => p?.imageinfo?.[0])
      .filter(Boolean);
    // Prefer raster photos; skip SVG/PDF/maps which render poorly as a thumbnail.
    const pick = files.find(f => /\.(jpe?g|png|webp)$/i.test(f.url)) || files[0];
    return pick?.thumburl || pick?.url || null;
  } catch (_) {
    return null;
  }
}

// Turn an OSM `image` / `wikimedia_commons` tag value into a usable image URL.
// Handles full URLs, "File:Foo.jpg", bare filenames and "Category:Foo".
async function resolveTaggedImage(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^Category:/i.test(raw)) return imageFromCommonsCategory(raw);
  const filename = raw.replace(/^File:/i, '');
  if (!filename) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=600`;
}

// Main: resolve a single POI image with layered fallbacks and caching.
async function fetchPOIImage(place, city) {
  const key = imageCacheKey(place, city);
  const cached = imageCacheGet(key);
  if (cached !== undefined) return cached;

  try {
    // 1. Direct image from Overpass tags (most trustworthy, curated by OSM).
    // Note a Category: tag may resolve to nothing — fall through if so rather
    // than emitting a broken Special:FilePath/Category:... URL.
    if (place.image) {
      const url = await resolveTaggedImage(place.image);
      if (url) { imageCacheSet(key, url); return url; }
    }

    // 2. Wikipedia page from explicit tag (curated — high quality match)
    if (place.wikipedia) {
      const parts = place.wikipedia.split(':');
      const lang = parts.length > 1 ? parts[0] : 'es';
      const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
      const url = await imageFromWikipediaTitle(title, lang);
      if (url) { imageCacheSet(key, url); return url; }
    }

    // 3. Wikidata entity from explicit tag
    if (place.wikidata) {
      const url = await imageFromWikidata(place.wikidata);
      if (url) { imageCacheSet(key, url); return url; }
    }

    // 4. Wikipedia search with "name + city" + title validation
    const searchUrl = await imageFromWikipediaSearch(place.name, city);
    if (searchUrl) { imageCacheSet(key, searchUrl); return searchUrl; }

    // 5. Wikimedia Commons search (filename must reference POI)
    const commonsUrl = await imageFromCommons(place.name, city);
    if (commonsUrl) { imageCacheSet(key, commonsUrl); return commonsUrl; }

    // No match found — cache null to avoid retrying
    imageCacheSet(key, null);
    return null;
  } catch (error) {
    console.error('[Image] Unexpected error for', place.name, '-', error.message);
    return null;
  }
}

// Fetch images for all places in parallel (with per-image timeout so slow matches don't block)
async function fetchAllPOIImages(places, city) {
  const TIMEOUT_MS = 4000;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise(resolve => setTimeout(() => resolve(null), TIMEOUT_MS))
  ]);
  const images = await Promise.all(places.map(p => withTimeout(fetchPOIImage(p, city))));
  return places.map((p, i) => ({
    ...p,
    imageUrl: images[i] || null
  }));
}

// Fetch Google Places data (photo URL + rating + phone + hours + website) for a POI.
// Uses Text Search to locate the place and Place Details for contact fields.
// Caches aggressively because place data is stable.
async function fetchPOIGoogleData(place, city) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !place?.name) return null;

  const cacheKey = `gplace:${place.name.toLowerCase()}|${(city || '').toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached !== null) return cached === '__none__' ? null : cached;

  try {
    const query = encodeURIComponent(`${place.name} ${city || ''}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=es&key=${apiKey}`;
    const search = await fetchExternal(searchUrl);
    const top = search?.results?.[0];
    if (!top || !top.place_id) {
      cacheSet(cacheKey, '__none__');
      return null;
    }

    const result = {
      placeId: top.place_id,
      rating: typeof top.rating === 'number' ? top.rating : null,
      userRatingsTotal: typeof top.user_ratings_total === 'number' ? top.user_ratings_total : null,
      photoUrl: null,
      phone: null,
      website: null,
      openingHours: null,
      openNow: null,
    };

    const photoRef = top.photos?.[0]?.photo_reference;
    const photoPromise = photoRef
      ? followRedirect(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`)
      : Promise.resolve(null);

    const fields = 'formatted_phone_number,international_phone_number,opening_hours,website';
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.placeId}&fields=${fields}&language=es&key=${apiKey}`;
    const detailsPromise = fetchExternal(detailsUrl).catch(() => null);

    const [photoUrl, det] = await Promise.all([photoPromise, detailsPromise]);
    result.photoUrl = photoUrl || null;

    const r = det?.result;
    if (r) {
      result.phone = r.formatted_phone_number || r.international_phone_number || null;
      result.website = r.website || null;
      if (r.opening_hours) {
        result.openingHours = Array.isArray(r.opening_hours.weekday_text) ? r.opening_hours.weekday_text : null;
        result.openNow = typeof r.opening_hours.open_now === 'boolean' ? r.opening_hours.open_now : null;
      }
    }

    cacheSet(cacheKey, result);
    return result;
  } catch (e) {
    console.error('[Places] Google error for', place.name, '-', e.message);
    return null;
  }
}

// Fetch Google Places data for all POIs in parallel with per-call timeout
async function fetchAllPOIGoogleData(places, city) {
  if (!process.env.GOOGLE_PLACES_API_KEY || !places?.length) {
    return places.map(() => null);
  }
  const TIMEOUT_MS = 5000;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise(resolve => setTimeout(() => resolve(null), TIMEOUT_MS))
  ]);
  return Promise.all(places.map(p => withTimeout(fetchPOIGoogleData(p, city))));
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
  // Redondear a 3 decimales (~111m) para agrupar peticiones cercanas
  const cacheKey = `geo:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log('[Cache] Hit for geocoding:', cacheKey);
    return cached;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=es`;
  try {
    const data = await fetchExternal(url);
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'this area';
    const country = data.address?.country || '';
    const result = { city, country, displayName: data.display_name };
    cacheSet(cacheKey, result);
    return result;
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
  // Caché por zona (~111m) y radio redondeado
  const cacheKey = `pois:${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(radiusMeters / 100) * 100}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log('[Cache] Hit for Overpass POIs:', cacheKey);
    return cached;
  }

  try {
    // For larger radii, use a simpler query to avoid timeouts
    const isLargeRadius = radiusMeters > 2000;
    const timeout = isLargeRadius ? 25 : 15;

    // Sightseeing only: think "I'm here for one day, what should I see?"
    // Restaurants/cafes go in their own tab. Theaters/cinemas excluded because
    // they're only worth visiting if there's a show that day, which we can't check.
    // Markets stay (Boquería, San Miguel, etc. are bona fide attractions).
    let query;
    if (isLargeRadius) {
      // Simplified query for driving/cycling - focus on main attractions
      query = `[out:json][timeout:${timeout}];(
        node["tourism"~"attraction|museum|viewpoint"](around:${radiusMeters},${lat},${lng});
        node["historic"](around:${radiusMeters},${lat},${lng});
        node["amenity"~"marketplace|place_of_worship"](around:${radiusMeters},${lat},${lng});
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
        node["amenity"~"marketplace|place_of_worship|fountain"](around:${radiusMeters},${lat},${lng});
        node["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        node["natural"~"spring|peak|cave_entrance"](around:${radiusMeters},${lat},${lng});
        node["man_made"~"tower|bridge"](around:${radiusMeters},${lat},${lng});
        way["tourism"~"attraction|museum|viewpoint"](around:${radiusMeters},${lat},${lng});
        way["historic"](around:${radiusMeters},${lat},${lng});
        way["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        way["amenity"~"marketplace|place_of_worship"](around:${radiusMeters},${lat},${lng});
        way["building"~"church|chapel|castle|cathedral"](around:${radiusMeters},${lat},${lng});
        relation["leisure"~"park|garden"](around:${radiusMeters},${lat},${lng});
        relation["tourism"~"attraction"](around:${radiusMeters},${lat},${lng});
      );out center body;`;
    }

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const data = await fetchExternal(url);

    if (!data.elements) return [];

    // Belt-and-braces: even though the queries above don't request these,
    // drop any that slip through tag mixing. Food types are owned by the
    // Restaurants tab; theaters/cinemas only matter when there's a show.
    const SKIP_TYPES = new Set([
      'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'ice_cream',
      'theatre', 'cinema', 'nightclub'
    ]);

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
      .filter(p => p.lat && p.lng)
      .filter(p => !SKIP_TYPES.has(p.rawType));

    // Deduplicate by name
    const seen = new Set();
    const unique = pois.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Overpass] Found ${unique.length} real POIs within ${radiusMeters}m`);
    cacheSet(cacheKey, unique);
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

  // 'mixed' (new default): preserve a balanced variety without biasing toward any
  // single category. We score equally and shuffle so each call returns a fresh mix.
  if (theme === 'mixed' || !hasThemeScores) {
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

// Salvage parser for LLM JSON output. Strips markdown fences and, when the
// model adds prose around the JSON or truncates mid-object, attempts to
// extract the first balanced {...} or [...] block. Returns null on failure
// so callers can decide whether to retry.
function parseLLMJsonSafe(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();
  if (text.includes('```json')) {
    text = text.replace(/```json\n?/, '').replace(/```\s*$/, '').trim();
  } else if (text.includes('```')) {
    text = text.replace(/```\n?/, '').replace(/```\s*$/, '').trim();
  }

  try { return JSON.parse(text); } catch {}

  // Salvage: find first { or [ and walk balanced brackets, ignoring chars
  // inside string literals. Handles trailing prose / truncated output.
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// Call the Nebius chat-completions endpoint once and return the message
// content string (empty string on error). Centralised so the retry wrapper
// below doesn't duplicate request plumbing.
async function callNebiusOnce(body, apiBaseUrl, apiKey) {
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  const response = await fetchExternal(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (response.error || response.detail) {
    const msg = response.error?.message || response.detail || JSON.stringify(response.error || response);
    throw new Error(`Nebius API error: ${msg}`);
  }
  return response.choices?.[0]?.message?.content || '';
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
      model: 'openai/gpt-oss-120b',
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

    const parsed = parseLLMJsonSafe(content);
    if (!parsed) {
      console.error('[Nebius] Failed to parse descriptions JSON:', content.substring(0, 300));
      return null;
    }
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
- type: Categoria (monument, museum, park, plaza, church, palace, viewpoint, historic, market, garden)
- lat: Latitud GPS real
- lng: Longitud GPS real
- description: Una frase atractiva en ESPAÑOL explicando por que merece la pena visitarlo

Devuelve un objeto JSON con una clave "places" que contenga un array:
{"places": [{"name": "Nombre del Lugar", "type": "monument", "lat": ${lat.toFixed(2)}, "lng": ${lng.toFixed(2)}, "description": "Descripcion en español"}, ...]}

IMPORTANTE: Usa coordenadas REALES de lugares verificados que existan en ${city}. Si no estas seguro de que un lugar existe, NO lo incluyas. NO incluyas restaurantes, cafes, bares, locales gastronomicos, teatros ni cines: esta ruta es para VER lugares de interes (cosas que enseñaria una oficina de turismo a alguien que tiene un dia para visitar la ciudad). La app tiene una pestaña aparte para restaurantes y los teatros solo merecen la pena si hay un espectaculo ese dia. Devuelve exactamente ${placeCount} lugares. Ordenalos para una ruta ${modeLabel}.`;

  console.log('[Nebius] Fallback: requesting full route for:', city, '| theme:', theme, '| transport:', transport);

  // Two attempts: first creative pass, then a stricter retry if the model
  // returns malformed JSON. Bumped max_tokens to avoid mid-array truncation
  // on longer routes.
  const buildBody = (attempt) => ({
    model: 'openai/gpt-oss-120b',
    messages: [
      {
        role: 'system',
        content: attempt === 0
          ? 'Eres un experto en viajes y turismo. Responde siempre con JSON valido, sin markdown. Todas las descripciones en español.'
          : 'Eres un experto en turismo. Devuelve EXCLUSIVAMENTE un objeto JSON valido y completo. Sin markdown, sin prosa antes ni despues. Descripciones en español.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: attempt === 0 ? 0.85 : 0.3,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  });

  let parsed = null;
  let lastContent = '';
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const content = await callNebiusOnce(buildBody(attempt), apiBaseUrl, apiKey);
    lastContent = content;
    if (!content) {
      console.error('[Nebius] Empty response on attempt', attempt);
      continue;
    }
    parsed = parseLLMJsonSafe(content);
    if (!parsed && attempt === 0) {
      console.warn('[Nebius] Invalid JSON on first attempt, retrying with stricter prompt');
    }
  }
  if (!parsed) {
    console.error('[Nebius] Failed to parse JSON after retry:', lastContent.substring(0, 300));
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
async function buildRoute(city, lat, lng, country, theme, transport, realPOIs, maxRouteDistance, candidateCount) {
  // In candidate mode the user curates the final list, so return more POIs and
  // skip the distance-trim loop below. In legacy mode (no candidateCount),
  // pick a tight set sized to the radius.
  const isCandidateMode = !!candidateCount;
  let desiredCount;
  if (isCandidateMode) {
    desiredCount = candidateCount;
  } else {
    const maxKm = maxRouteDistance ? maxRouteDistance / 1000 : (transport === 'walking' ? 3 : 10);
    if (maxKm <= 1.5) desiredCount = 3;
    else if (maxKm <= 3) desiredCount = 4;
    else if (maxKm <= 6) desiredCount = 5;
    else desiredCount = 6;
  }

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

    // Estimate route distance and trim POIs if over budget.
    // Skipped in candidate mode: the user curates by deselecting, so we return
    // the full pool and let the frontend decide what fits.
    if (maxRouteDistance && !isCandidateMode) {
      const roadFactor = 1.4; // roads are ~1.4x longer than straight line
      let estimatedDist = estimateRouteDistance(sorted, lat, lng) * roadFactor;
      while (sorted.length > 2 && estimatedDist > maxRouteDistance) {
        sorted.pop(); // remove last (farthest in the chain)
        estimatedDist = estimateRouteDistance(sorted, lat, lng) * roadFactor;
        console.log(`[Route] Trimmed to ${sorted.length} POIs, estimated ${Math.round(estimatedDist)}m vs max ${maxRouteDistance}m`);
      }
    }

    console.log(`[Route] Using ${sorted.length} verified Overpass POIs (nearest-neighbor sorted)`);

    // Ask LLM for descriptions AND resolve images AND fetch Google data in parallel
    const [descriptions, placesWithImages, googleData] = await Promise.all([
      getDescriptionsFromLLM(sorted, city, country, theme),
      fetchAllPOIImages(sorted, city),
      fetchAllPOIGoogleData(sorted, city)
    ]);

    const withImagesCount = placesWithImages.filter(p => p.imageUrl).length;
    const withGoogleCount = googleData.filter(Boolean).length;
    console.log(`[Route] Resolved images for ${withImagesCount}/${placesWithImages.length} POIs, Google data for ${withGoogleCount}/${placesWithImages.length}`);

    const places = placesWithImages.map((p, i) => {
      const g = googleData[i] || {};
      return {
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        description: (descriptions && descriptions[i]) || `Lugar de interés en ${city}.`,
        wikipedia: p.wikipedia || null,
        wikidata: p.wikidata || null,
        // Prefer Google Places photo (most precise match for the actual place),
        // fall back to Wikipedia/Commons when Google has none.
        imageUrl: g.photoUrl || p.imageUrl || null,
        rating: g.rating ?? null,
        userRatingsTotal: g.userRatingsTotal ?? null,
        placeId: g.placeId || null,
        phone: g.phone || null,
        website: g.website || null,
        openingHours: g.openingHours || null,
        openNow: g.openNow ?? null,
      };
    });
    return { places, poiSource: 'overpass' };
  }

  // Last resort: no Overpass data at all (very remote area) - use LLM but warn
  console.log('[Route] No Overpass POIs found at any radius, falling back to LLM');
  const llmPlaces = await getTouristRouteFromLLM(city, lat, lng, country, theme, transport, maxRouteDistance);
  // LLM places have no wikipedia/wikidata tags — attempt Wikipedia + Google in parallel
  const [withImages, googleData] = await Promise.all([
    fetchAllPOIImages(llmPlaces, city),
    fetchAllPOIGoogleData(llmPlaces, city)
  ]);
  const places = withImages.map((p, i) => {
    const g = googleData[i] || {};
    return {
      ...p,
      imageUrl: g.photoUrl || p.imageUrl || null,
      rating: g.rating ?? null,
      userRatingsTotal: g.userRatingsTotal ?? null,
      placeId: g.placeId || null,
      phone: g.phone || null,
      website: g.website || null,
      openingHours: g.openingHours || null,
      openNow: g.openNow ?? null,
    };
  });
  return { places, poiSource: 'llm' };
}

// ========== PUBLIC ENDPOINTS ==========

// Auth config for frontend
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// ========== CITY SEARCH HELPERS ==========

// OSM place types we consider "settlements" (cities, towns, villages).
// Excludes hamlet/locality (too small, usually noise) and suburb/neighbourhood
// (sub-city, would produce duplicates of the parent city).
const CITYLIKE_PLACE_TYPES = new Set([
  'city', 'town', 'village', 'municipality', 'borough'
]);

// Photon (Komoot's OSM-based autocomplete) returns GeoJSON features whose
// `properties.osm_key` / `osm_value` are equivalent to Nominatim's class/type.
function isPhotonCity(feature) {
  const p = feature?.properties;
  if (!p) return false;
  if (p.osm_key === 'place' && CITYLIKE_PLACE_TYPES.has(p.osm_value)) return true;
  // Some municipalities come back as boundary/administrative — accept them only
  // if Photon's `type` field still calls them a city/town/village.
  if (p.osm_key === 'boundary' && p.osm_value === 'administrative'
      && CITYLIKE_PLACE_TYPES.has(p.type)) return true;
  return false;
}

function photonName(feature) {
  const p = feature.properties || {};
  return p.name || p.city || '';
}

function photonRegion(feature) {
  const p = feature.properties || {};
  // State/province hint, useful to disambiguate "Mérida" (Spain / México / Venezuela)
  return p.state || p.county || '';
}

function normalizeForMatch(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Rank: exact match (0) → starts with query (1) → contains all query tokens (2) → other (3).
// Break ties by OSM importance (higher = more relevant).
function cityRank(name, query, importance) {
  const n = normalizeForMatch(name);
  const q = normalizeForMatch(query);
  const impBoost = -(importance || 0); // negative so higher importance ranks earlier
  if (!q) return [3, impBoost];
  if (n === q) return [0, impBoost];
  if (n.startsWith(q)) return [1, impBoost];
  const qTokens = q.split(' ').filter(Boolean);
  if (qTokens.every(t => n.includes(t))) return [2, impBoost];
  return [3, impBoost];
}

// Search cities via Photon (Komoot's OSM-based autocomplete). Unlike Nominatim,
// Photon does real prefix matching so partial input like "Alham" matches "Alhama de Aragón".
app.get('/api/search-city', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Ask for more candidates (we filter after). Photon only supports
    // lang=default|de|en|fr; we omit lang so it returns each place's local
    // name (Spanish cities come back in Spanish, etc).
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
                `&limit=20`;
    const data = await fetchExternal(url);
    const features = Array.isArray(data?.features) ? data.features : [];

    // 1. Keep only city-like results
    const filtered = features.filter(isPhotonCity);

    // 2. Map to our shape (Photon ranks by relevance; we use its order as the importance proxy)
    const mapped = filtered.map((f, idx) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      return {
        name: photonName(f),
        region: photonRegion(f),
        country: p.country || '',
        countryCode: (p.countrycode || '').toLowerCase(),
        displayName: [photonName(f), photonRegion(f), p.country].filter(Boolean).join(', '),
        lat: parseFloat(coords[1]),
        lng: parseFloat(coords[0]),
        _importance: filtered.length - idx, // higher = earlier in Photon's ranking
        _rankKey: null
      };
    });

    // 3. Deduplicate by normalized name + country (keep the most important)
    const dedup = new Map();
    for (const c of mapped) {
      const key = `${normalizeForMatch(c.name)}|${c.countryCode}|${normalizeForMatch(c.region)}`;
      const existing = dedup.get(key);
      if (!existing || (c._importance || 0) > (existing._importance || 0)) {
        dedup.set(key, c);
      }
    }

    // 4. Sort by rank against the query, then by OSM importance
    const sorted = [...dedup.values()]
      .map(c => ({ ...c, _rankKey: cityRank(c.name, q, c._importance) }))
      .sort((a, b) => {
        if (a._rankKey[0] !== b._rankKey[0]) return a._rankKey[0] - b._rankKey[0];
        return a._rankKey[1] - b._rankKey[1];
      })
      .slice(0, 6)
      .map(({ _importance, _rankKey, ...c }) => c); // strip internals

    res.json(sorted);
  } catch (error) {
    console.error('[Search] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get place image by name + city.
// Tries Google Places (if key configured) first for food POIs, then falls back to
// our Wikipedia/Wikidata/Commons resolver. The resolver validates title match so
// we don't return images from unrelated places with similar names.
app.get('/api/place-image', async (req, res) => {
  const { name, city } = req.query;
  if (!name) return res.json({ url: null });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // 1. Try Google Places first for any POI — its photos match the actual place
  //    most precisely. Wikipedia/Commons is the fallback below.
  if (apiKey) {
    try {
      const query = encodeURIComponent(`${name} ${city || ''}`);
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
      const data = await fetchExternal(searchUrl);
      const photoRef = data.results?.[0]?.photos?.[0]?.photo_reference;
      if (photoRef) {
        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
        const cdnUrl = await followRedirect(photoApiUrl);
        if (cdnUrl) return res.json({ url: cdnUrl, source: 'google' });
      }
    } catch (e) {
      console.error('[Places] Google error:', e.message);
    }
  }

  // 2. Fallback: resolve via Wikipedia/Wikidata/Commons (with title validation)
  try {
    const url = await fetchPOIImage({ name }, city || '');
    return res.json({ url: url || null, source: url ? 'wikipedia' : null });
  } catch (e) {
    console.error('[Image] Resolver error:', e.message);
    res.json({ url: null });
  }
});

// Generate trip
app.get('/api/generate-trip', async (req, res) => {
  try {
    const { lat, lng, theme = 'mixed', transport = 'driving', radius, count } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Coordinates required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // 'mixed' is the new default (no theme bias). Legacy themes still accepted
    // so saved trips and any external callers keep working.
    const VALID_THEMES = ['mixed', 'monuments', 'nature', 'food', 'historical', 'cultural', 'classic', 'surprise'];
    const VALID_TRANSPORTS = ['driving', 'walking', 'cycling'];
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'mixed';

    // Reserve daily Google Places budget (only if the API key is configured,
    // since otherwise generate-trip falls back to Wikipedia which is free).
    if (process.env.GOOGLE_PLACES_API_KEY && !tryReserveBudget(COST_PER_TRIP_USD)) {
      return budgetExceededResponse(res);
    }
    const safeTransport = VALID_TRANSPORTS.includes(transport) ? transport : 'driving';

    // Candidate mode: caller wants a larger pool to curate. Clamped to [4, 12].
    const candidateCount = count
      ? Math.min(Math.max(parseInt(count) || 0, 4), 12)
      : null;

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
      locationInfo.city, latNum, lngNum, locationInfo.country, safeTheme, safeTransport, realPOIs, maxRouteDistance, candidateCount
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

// Get nearby restaurants ranked by rating (Google Places Nearby Search)
app.get('/api/restaurants', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Google Places no esta configurado en el servidor' });
    }
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Coordinates required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const radiusMeters = Math.min(Math.max(parseInt(radius) || 1500, 200), 5000);

    const cacheKey = `restaurants:${latNum.toFixed(3)},${lngNum.toFixed(3)}:${radiusMeters}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    if (!tryReserveBudget(COST_PER_RESTAURANTS_USD)) {
      return budgetExceededResponse(res);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latNum},${lngNum}&radius=${radiusMeters}&type=restaurant&language=es&key=${apiKey}`;
    const data = await fetchExternal(url);

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places] Nearby status:', data.status, data.error_message);
      return res.status(502).json({ error: 'Google Places error: ' + data.status });
    }

    const results = Array.isArray(data.results) ? data.results : [];

    const ranked = results
      .filter(r => typeof r.rating === 'number' && (r.user_ratings_total || 0) >= 20)
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
      })
      .slice(0, 12);

    const PHOTO_TIMEOUT = 4000;
    const withTimeout = (p) => Promise.race([
      p,
      new Promise(resolve => setTimeout(() => resolve(null), PHOTO_TIMEOUT))
    ]);

    const enriched = await Promise.all(ranked.map(async (r) => {
      const photoRef = r.photos?.[0]?.photo_reference;
      const photoApiUrl = photoRef
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`
        : null;
      const photoUrl = photoApiUrl ? await withTimeout(followRedirect(photoApiUrl)) : null;
      return {
        placeId: r.place_id,
        name: r.name,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total || 0,
        address: r.vicinity || '',
        lat: r.geometry?.location?.lat,
        lng: r.geometry?.location?.lng,
        priceLevel: typeof r.price_level === 'number' ? r.price_level : null,
        openNow: r.opening_hours?.open_now ?? null,
        photoUrl: photoUrl || null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`
      };
    }));

    const locationInfo = await getCityFromCoords(latNum, lngNum);

    const payload = {
      city: locationInfo.city,
      country: locationInfo.country,
      origin: { lat: latNum, lng: lngNum },
      radius: radiusMeters,
      restaurants: enriched
    };

    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants: ' + error.message });
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
