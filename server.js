require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { initDatabase, query } = require('./database');
const { CITIES, CITY_BY_SLUG } = require('./cityData');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (and most PaaS) put the app behind a reverse proxy, so req.ip is the
// proxy's address unless we trust it. Without this every visitor shares a single
// rate-limit bucket: a handful of concurrent users would 429 each other, and a
// single abuser couldn't be isolated. '1' = trust exactly one proxy hop, which is
// Render's setup — never `true`, which would let a client spoof X-Forwarded-For.
app.set('trust proxy', 1);

// CORS: the SPA is served from this same origin (and Vite proxies /api in dev),
// so no site legitimately needs cross-origin access. Restricting it stops other
// websites from calling this API from a browser and burning the Google Places
// budget. Requests with no Origin (curl, server-to-server, health checks) are
// allowed — CORS is a browser control, so rate limiting and the daily budget cap
// remain the real defence against scripted abuse.
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map((o) => o.trim()).filter(Boolean);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://randomtripgenerator.com',
  'https://www.randomtripgenerator.com',
  'http://localhost:5173',
  'http://localhost:3000',
];
const allowedOrigins = CORS_ALLOWED_ORIGINS.length ? CORS_ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

// Security headers. Production sent none at all and advertised the framework in
// x-powered-by, which is the first thing any audit tool reports.
//
// Two of helmet's defaults are switched off deliberately, because both would
// break the app rather than protect it:
//   contentSecurityPolicy — helmet's default policy blocks everything this page
//     legitimately loads (Google Fonts, Leaflet tiles from OSM, Google Places and
//     Wikimedia photos, the Umami script, Unsplash hero images). A real policy
//     means enumerating those hosts and re-checking them whenever one changes;
//     worth doing, but not as a side effect of adding headers.
//   crossOriginResourcePolicy — the default `same-origin` tells browsers not to
//     let other sites embed our resources, and /icons/og-default.png exists
//     precisely to be embedded by other sites.
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Reflect the origin only when allowed. Signalling `false` (instead of an
    // Error) omits the Access-Control-Allow-Origin header, so the browser blocks
    // the response while the server answers normally — no 500s filling the logs.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
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
  message: { error: 'Has hecho muchas búsquedas seguidas, espera un momento' }
});

// Creating share links writes rows without auth, so keep it tight.
const shareLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has compartido muchas rutas, espera un momento' }
});

app.use('/api/', apiLimiter);
app.use('/api/generate-trip', generateLimiter);
app.use('/api/restaurants', restaurantsLimiter);

// ========== GOOGLE PLACES DAILY BUDGET ==========
// Cost counter shared by every endpoint that spends on Google Places. Kept in
// memory for a fast, synchronous decision on the request path, but seeded from
// (and written through to) the api_spend table — otherwise every deploy reset it
// to zero and the "daily" cap was really a cap per uptime segment. Resets at UTC
// midnight. Estimated costs are conservative (worst-case Google Places pricing)
// so we'd rather block early than overshoot.
const DAILY_BUDGET_USD = parseFloat(process.env.GOOGLE_PLACES_DAILY_BUDGET_USD || '6');
const COST_PER_TRIP_USD = 0.30;       // ~8 text searches + 8 photos
const COST_PER_RESTAURANTS_USD = 0.15; // 1 nearby + up to 12 photos
const COST_PER_CITY_AUTOCOMPLETE_USD = 0.003; // 1 Autocomplete request (per-request rate; free inside a session)
const COST_PER_CITY_RESOLVE_USD = 0.017;      // 1 Place Details closing an autocomplete session
const COST_PER_PLACE_IMAGE_USD = 0.04;        // 1 text search + 1 photo, per /api/place-image call

let dailyCostUsd = 0;
let budgetDayKey = new Date().toISOString().slice(0, 10);

// Which row this deployment owns. Local development shares the production
// DATABASE_URL, so without a scope a dev run silently eats production's daily
// allowance (observed: local tests pushed the shared row to $2.78 and helped
// lock production out). Render sets API_SPEND_SCOPE=prod.
const API_SPEND_SCOPE = process.env.API_SPEND_SCOPE || 'local';

// Seed the counter from the DB at boot so a restart doesn't hand out a fresh
// allowance. Failure is non-fatal: we start at 0 and still enforce the cap for
// this process, which is the old behaviour.
async function loadBudgetFromDb() {
  try {
    const { rows } = await query(
      'SELECT spend_usd FROM api_spend WHERE day = $1 AND scope = $2',
      [budgetDayKey, API_SPEND_SCOPE]
    );
    if (rows.length) {
      dailyCostUsd = parseFloat(rows[0].spend_usd) || 0;
      console.log(`[Budget] Restored $${dailyCostUsd.toFixed(2)} already spent on ${budgetDayKey} (scope: ${API_SPEND_SCOPE})`);
    }
  } catch (e) {
    console.warn('[Budget] Could not restore daily spend, starting at $0:', e.message);
  }
}

// Write-through, fire-and-forget: the reservation decision is already made, so a
// slow or failing DB must never delay or break a user's request. A dropped write
// (Neon's free tier autosuspends, so a cold write can fail) would leave the
// in-memory counter ahead of the persisted truth — reconcile() below repairs that
// instead of locking the app out for the rest of the day.
function persistBudget(day, amountUsd) {
  query(
    `INSERT INTO api_spend (day, scope, spend_usd, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (day, scope) DO UPDATE
       SET spend_usd = api_spend.spend_usd + EXCLUDED.spend_usd,
           updated_at = CURRENT_TIMESTAMP`,
    [day, API_SPEND_SCOPE, amountUsd]
  ).catch((e) => console.warn('[Budget] Persist failed:', e.message));
}

// Re-read the persisted total and adopt it when it is lower than what this process
// believes. Runs only when a request is about to be refused, so the cap can't get
// stuck above the real spend: exactly the failure seen in production, where memory
// said ~$5.8 while the database said $2.97 and Google had billed nothing.
let reconcilingBudget = null;
function reconcileBudget() {
  if (reconcilingBudget) return reconcilingBudget;
  reconcilingBudget = query(
    'SELECT spend_usd FROM api_spend WHERE day = $1 AND scope = $2',
    [budgetDayKey, API_SPEND_SCOPE]
  ).then(({ rows }) => {
    const persisted = rows.length ? parseFloat(rows[0].spend_usd) || 0 : 0;
    if (persisted < dailyCostUsd - 0.001) {
      console.warn(`[Budget] Drift repaired — memory $${dailyCostUsd.toFixed(2)} → persisted $${persisted.toFixed(2)} for ${budgetDayKey}`);
      dailyCostUsd = persisted;
    }
  }).catch((e) => {
    console.warn('[Budget] Reconcile failed:', e.message);
  }).finally(() => { reconcilingBudget = null; });
  return reconcilingBudget;
}

function rollDayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDayKey) {
    console.log(`[Budget] Reset: previous day spent $${dailyCostUsd.toFixed(2)}`);
    dailyCostUsd = 0;
    budgetDayKey = today;
  }
}

// Synchronous reservation used on the request path.
function tryReserveBudget(estimatedUsd) {
  rollDayIfNeeded();
  if (dailyCostUsd + estimatedUsd > DAILY_BUDGET_USD) {
    console.warn(`[Budget] EXCEEDED — at $${dailyCostUsd.toFixed(2)}/$${DAILY_BUDGET_USD} for ${budgetDayKey}, rejecting request (+$${estimatedUsd.toFixed(2)})`);
    reconcileBudget(); // repair drift so the next request isn't refused too
    return false;
  }
  dailyCostUsd += estimatedUsd;
  persistBudget(budgetDayKey, estimatedUsd);
  const pct = (dailyCostUsd / DAILY_BUDGET_USD) * 100;
  if (pct >= 80) {
    console.warn(`[Budget] ${pct.toFixed(0)}% used — $${dailyCostUsd.toFixed(2)}/$${DAILY_BUDGET_USD} on ${budgetDayKey}`);
  }
  return true;
}

// Same check, but reconciles first so a single dropped write can't refuse a
// request. Used where the caller can afford one await before deciding.
async function tryReserveBudgetChecked(estimatedUsd) {
  rollDayIfNeeded();
  if (dailyCostUsd + estimatedUsd > DAILY_BUDGET_USD) {
    await reconcileBudget();
  }
  return tryReserveBudget(estimatedUsd);
}

// Give back a reservation that was never spent — the paid call didn't happen (a
// Wikipedia fallback, a missing key) or the request failed before using it.
// Without this the counter only ever grows and drifts above real spend.
function releaseBudget(estimatedUsd) {
  if (!(estimatedUsd > 0)) return;
  dailyCostUsd = Math.max(0, dailyCostUsd - estimatedUsd);
  persistBudget(budgetDayKey, -estimatedUsd);
}

function budgetExceededResponse(res) {
  return res.status(429).json({
    error: 'Hemos alcanzado el límite diario gratuito. Vuelve a intentarlo mañana.'
  });
}

// Serve React build if available, otherwise fall back to public/
const clientDist = path.join(__dirname, 'client', 'dist');
// Vite emits content-hashed filenames under /assets, so those can be cached
// forever — a new deploy means new filenames. Everything else has to stay fresh
// or a deploy never reaches people who already visited. With no options at all,
// express.static sent `max-age=0` for everything, so even immutable bundles
// revalidated against the origin on every single page load.
app.use(express.static(clientDist, {
  setHeaders(res, filePath) {
    if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/[\\/]icons[\\/]/.test(filePath)) {
      // Stable but unhashed names, so cache for a week rather than forever —
      // long enough to stop refetching the logo, short enough that replacing
      // the social card propagates without renaming it.
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/sw\.js$/.test(filePath)) {
      // A cached service worker keeps controlling the page after a deploy.
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  },
}));

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
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos (por defecto)
// OSM barely changes from one day to the next, and a cold Overpass call is the
// slowest step of a trip, so POI data earns a far longer life than the default.
const OSM_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas
// Expired entries are kept this much longer so they can still be served when
// the upstream that produced them is down. Slightly stale real places beat
// both a failed request and invented ones.
const CACHE_STALE_GRACE = 24 * 60 * 60 * 1000; // 24 horas

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.time;
  if (age > entry.ttl) {
    // Not deleted on expiry: past its TTL it's no longer fresh enough to serve
    // normally, but it's still a valid fallback while the upstream is failing.
    if (age > entry.ttl + CACHE_STALE_GRACE) cache.delete(key);
    return null;
  }
  return entry.data;
}

// Deliberately ignores the TTL. Only for the "upstream is down" path.
function cacheGetStale(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > entry.ttl + CACHE_STALE_GRACE) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs = CACHE_TTL) {
  // Limitar tamaño del caché (max 500 entradas)
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, time: Date.now(), ttl: ttlMs });
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

// Default per-request ceiling for outbound calls. Without a timeout a hung
// upstream (Overpass, Nominatim, an LLM provider) holds the socket — and the
// user's request — open indefinitely. Callers that need longer (LLM generation)
// pass options.timeoutMs.
const EXTERNAL_TIMEOUT_MS = 8000;
const EXTERNAL_MAX_BYTES = 8 * 1024 * 1024; // don't buffer an unbounded response

// Helper function to fetch from external APIs
function fetchExternal(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    // Ensure headers object exists and set default User-Agent
    if (!options.headers) options.headers = {};
    if (!options.headers['User-Agent']) {
      options.headers['User-Agent'] = 'RandomTripGenerator/1.0';
    }
    // timeoutMs, withStatus and maxBytes are ours, not http.request options —
    // strip them before passing the rest on.
    const { timeoutMs, withStatus, maxBytes, ...requestOptions } = options;
    const limitMs = timeoutMs || EXTERNAL_TIMEOUT_MS;
    const byteLimit = maxBytes || EXTERNAL_MAX_BYTES;

    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };

    const request = protocol.request(url, requestOptions, (res) => {
      let data = '';
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > byteLimit) {
          request.destroy();
          finish(reject, new Error(`Respuesta demasiado grande (>${Math.round(byteLimit / 1048576)}MB) de ${url.split('?')[0]}`));
          return;
        }
        data += chunk;
      });
      res.on('end', () => {
        let payload;
        try {
          payload = JSON.parse(data);
        } catch (e) {
          payload = data;
        }
        // Callers that must tell a 200 from a 429/504 opt in with withStatus.
        // By default only the body is resolved, which is what the rest expect —
        // and which is exactly how a rate-limit page used to be mistaken for
        // a valid empty result.
        finish(resolve, withStatus ? { status: res.statusCode, body: payload } : payload);
      });
      res.on('error', (e) => finish(reject, e));
    });

    // Guard the whole exchange (connect + headers + body), which request.setTimeout
    // alone does not do — it only covers socket inactivity.
    const timer = setTimeout(() => {
      request.destroy();
      finish(reject, new Error(`Timeout (${limitMs}ms) llamando a ${url.split('?')[0]}`));
    }, limitMs);

    request.on('error', (e) => finish(reject, e));
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

// ========== IMAGE RESOLUTION ==========
// Google text search matches any place with a similar name, so for a sight it
// can return a nearby shop, restaurant, hospital or hotel — and then that
// business's photo/rating, not the monument's. When the matched place's types
// say it isn't a sight, reject the whole match and fall back to Wikipedia.
const NON_SIGHT_PHOTO_TYPES = new Set([
  'hospital', 'doctor', 'pharmacy', 'dentist', 'health',
  'lodging', 'store', 'supermarket', 'convenience_store', 'clothing_store',
  'shoe_store', 'furniture_store', 'home_goods_store', 'department_store',
  'shopping_mall', 'bank', 'atm', 'gas_station', 'car_repair', 'car_dealer',
  'parking', 'school', 'primary_school', 'secondary_school', 'real_estate_agency',
  'restaurant', 'food', 'cafe', 'bar', 'meal_takeaway', 'meal_delivery', 'bakery'
]);

// A Google match farther than this from the POI's own coordinates is a
// different place that happens to share the name, not the sight we asked
// about. Generous enough to absorb OSM-centroid-vs-Google-pin drift on big
// ways (parks, palaces), tight enough to reject cross-town homonyms.
const GOOGLE_MATCH_MAX_METERS = 2000;

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
// Words that say WHAT something is, not WHICH one it is. Two places sharing only
// these are not the same place.
const GENERIC_PLACE_WORDS = new Set([
  'jardin', 'jardines', 'parque', 'iglesia', 'parroquia', 'ermita', 'basilica', 'catedral',
  'museo', 'plaza', 'palacio', 'casa', 'castillo', 'torre', 'puente', 'fuente', 'mercado',
  'monumento', 'estatua', 'busto', 'capilla', 'convento', 'monasterio', 'centro', 'teatro',
  'banos', 'termas', 'edificio', 'mirador', 'sinagoga', 'muralla', 'puerta', 'paseo', 'calle',
  'avenida', 'real', 'municipal', 'antiguo', 'antigua', 'exposicion', 'coleccion', 'memorial',
]);
const NAME_ARTICLES = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'a', 'al', 'san', 'santa', 'santo']);

function nameTokens(str) {
  return normalizeText(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 3 && !NAME_ARTICLES.has(w));
}

// Does the place Google returned plausibly correspond to the POI we asked about?
//
// Google's Text Search never says "no match": it fuzzy-matches and returns the
// closest thing it has. Searching "Jardín de los Patos, Alhama de Murcia"
// returned "Jardín Del Dragón" — a different park 1km away — and since the only
// guard was distance (2km, which inside a town accepts almost anything) the card
// wore the Dragón's photo AND its 4.2 rating.
//
// The rule is one distinctive word in common, where "jardín", "iglesia", "museo"
// and friends don't count as distinctive. Measured against 24 real OSM POIs in
// Alhama de Murcia and Toledo: this accepts 23 and rejects exactly the one bad
// match ("Fuente de los Caballitos" → "Mirador de La Muela"). Requiring ALL
// significant words instead — the rule used for Wikipedia titles — accepted only
// 11 of 24, throwing away good photos over harmless wording differences like
// "Castillo de Alhama" → "Castillo de Alhama de Murcia".
function googleNameMatchesPOI(poiName, googleName) {
  const google = normalizeText(googleName);
  const tokens = nameTokens(poiName);
  if (!google || tokens.length === 0) return false;

  const distinctive = tokens.filter((w) => !GENERIC_PLACE_WORDS.has(w));
  if (distinctive.length > 0) return distinctive.some((w) => google.includes(w));
  // The POI is named only with generic words ("Termas Romanas", "El Pósito"):
  // nothing distinctive to key on, so require every word instead.
  return tokens.every((w) => google.includes(w));
}

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
// Wikipedia language codes are short ASCII, optionally with a script/region
// suffix (es, en, zh-hans, pt-br). The value comes from an OSM `wikipedia` tag
// formatted "lang:Title" — and a client can supply that tag verbatim through
// POST /api/descriptions. Interpolating it straight into the URL was an SSRF: a
// '#' inside it ends the authority, so "attacker.example#:T" made the request go
// to attacker.example instead of Wikipedia. Validate, then re-parse to be sure
// nothing moved the host.
const WIKI_LANG_RE = /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/i;

function wikipediaSummaryUrl(lang, title) {
  if (!title || !WIKI_LANG_RE.test(String(lang || ''))) return null;
  const url = `https://${String(lang).toLowerCase()}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.wikipedia.org')) return null;
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

async function imageFromWikipediaTitle(title, lang = 'es') {
  try {
    const url = wikipediaSummaryUrl(lang, title);
    if (!url) return null;
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
    // Anchor the text search to the POI's coordinates — without the bias,
    // "name + city" happily matches a same-named place anywhere in town.
    const hasCoords = Number.isFinite(place.lat) && Number.isFinite(place.lng);
    const bias = hasCoords ? `&location=${place.lat},${place.lng}&radius=2000` : '';
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}${bias}&language=es&key=${apiKey}`;
    const search = await fetchExternal(searchUrl);
    const top = search?.results?.[0];
    if (!top || !top.place_id) {
      cacheSet(cacheKey, '__none__');
      return null;
    }

    // The bias is only a preference for Google, so verify the match is
    // actually near the POI. Searching the Carlos III statue at Puerta del
    // Sol returned Universidad Carlos III (13 km away) — and then the deck
    // wore the university's photo and rating on the statue's card.
    const gLoc = top.geometry?.location;
    if (hasCoords && gLoc && Number.isFinite(gLoc.lat) && Number.isFinite(gLoc.lng)
        && haversineMeters(place.lat, place.lng, gLoc.lat, gLoc.lng) > GOOGLE_MATCH_MAX_METERS) {
      cacheSet(cacheKey, '__none__');
      return null;
    }

    // Distance alone isn't enough. Inside a town everything is within 2km, so a
    // fuzzy match on a name Google doesn't have sails through: "Jardín de los
    // Patos" came back as "Jardín Del Dragón", and the card showed that park's
    // photo and its rating. Wrong data presented confidently is worse than none.
    if (!googleNameMatchesPOI(place.name, top.name)) {
      console.log(`[Google] Descartado "${top.name}" para "${place.name}": el nombre no coincide`);
      cacheSet(cacheKey, '__none__');
      return null;
    }

    // Reject mismatches: if the top result is a shop/restaurant/hospital/etc.,
    // it's a different business that merely shares the name. Its photo, rating
    // and phone all belong to that business, not the sight — drop the whole
    // match so the deck falls back to the title-validated Wikipedia image.
    if ((top.types || []).some((t) => NON_SIGHT_PHOTO_TYPES.has(t))) {
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
    // Nominatim throttles shared/server IPs and may return a non-JSON body
    // (rate-limit notice/HTML). fetchExternal resolves that as a raw string,
    // so guard against anything that isn't a parsed object.
    const addr = (data && typeof data === 'object') ? (data.address || {}) : {};
    const displayName = (data && typeof data === 'object' && data.display_name) || '';
    const city =
      addr.city || addr.town || addr.village || addr.municipality ||
      addr.city_district || addr.county || addr.suburb || addr.hamlet ||
      (displayName ? displayName.split(',')[0].trim() : '') ||
      'la zona';
    const country = addr.country || '';
    const result = { city, country, displayName: displayName || city };
    // Don't cache the generic fallback — a later attempt may resolve properly.
    if (city !== 'la zona') cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Nominatim] Error:', error.message);
    return { city: 'la zona', country: '', displayName: 'ubicación desconocida' };
  }
}

// Map Overpass types to our display types
const OVERPASS_TYPE_MAP = {
  attraction: 'monument', museum: 'museum', viewpoint: 'viewpoint', artwork: 'monument',
  gallery: 'museum', castle: 'palace', ruins: 'historic',
  monument: 'monument', memorial: 'monument', archaeological_site: 'historic',
  church: 'church', monastery: 'church', chapel: 'church', cathedral: 'church',
  place_of_worship: 'church', restaurant: 'restaurant', cafe: 'restaurant',
  marketplace: 'market', theatre: 'theater', park: 'park', garden: 'garden',
  fountain: 'plaza', spring: 'viewpoint', peak: 'viewpoint', cave_entrance: 'viewpoint',
  tower: 'viewpoint', bridge: 'monument'
};

// ========== OVERPASS TRANSPORT ==========
// The public Overpass instances are free, unmetered and intermittently
// overloaded: the main one answers in under two seconds or returns 429/504
// depending on the minute. Two rules follow from that:
//   1. Retry, and across instances — the same query is valid on any of them.
//   2. An upstream failure must NEVER look like "this area has no places". It
//      used to: the error was swallowed into an empty array, which sent
//      buildRoute down the LLM path and served invented places for Madrid.
// Ordered by preference, overridable with OVERPASS_ENDPOINTS (comma-separated).
// The main instance goes first because it's the canonical, highest-capacity one,
// but it enforces 2 concurrent slots PER IP — and Render's egress IP is shared,
// so 429 is a routine answer there, not an edge case. The French instance is the
// hedge: measured on the real POI query at a 667m radius it answered Madrid /
// Barcelona / Sevilla / Zamora in 0.9-1.7s with element counts identical to the
// main instance, while the main one ranged 2.8-8s and 429s.
// Note: overpass.kumi.systems and overpass.private.coffee resolve to the same
// host (193.219.97.30), so listing both would buy no independence — only kumi
// is here, as a third opinion.
const OVERPASS_ENDPOINTS = (process.env.OVERPASS_ENDPOINTS ||
  'https://overpass-api.de/api/interpreter,https://overpass.openstreetmap.fr/api/interpreter,https://overpass.kumi.systems/api/interpreter'
).split(',').map((s) => s.trim()).filter(Boolean);

// Overpass's own budget for a query, in seconds, declared inside the query as
// [timeout:N]. Counter-intuitively this must be GENEROUS: it is not a politeness
// setting, it's the point at which Overpass aborts our query and its gateway
// answers 504. Measured against overpass-api.de at a 667m radius: with
// [timeout:5] every city returned 504 after ~8s; with [timeout:25] Madrid
// answered in 2.8s with 280 elements. So a low value manufactures the very
// failure it looks like it should prevent.
const OVERPASS_QUERY_TIMEOUT_S = 25;

// What WE are willing to wait for one instance. Successful answers were measured
// between 2.8s and 11.2s on the same query depending on instance load.
const OVERPASS_ATTEMPT_TIMEOUT_MS = 10000;
// If the first instance hasn't answered by this point, start the next one
// alongside it rather than waiting for the first to fail (see overpassQuery).
// Tuned just above the hedge target's measured worst case (~1.7s), so a healthy
// primary is never second-guessed but a sick one is bypassed quickly.
const OVERPASS_HEDGE_AFTER_MS = 2500;
// Hard cap on the whole chain, so a bad minute upstream can never turn into a
// 40-second wait for the user.
const OVERPASS_TOTAL_BUDGET_MS = 14000;

class OverpassUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OverpassUnavailableError';
  }
}

// Runs one Overpass query as a HEDGED request: fire the first instance, and if
// it hasn't answered within hedgeAfterMs, start the next one alongside it and
// take whichever replies first. Plain sequential failover would add up the slow
// attempts (waiting 10s to learn instance #1 is sick before even trying #2);
// hedging pays for a second call only on the slow tail, which is where the
// public instances actually hurt — the same query answers in 2.8s or 504s after
// 8s depending on the minute. Resolves the parsed body; throws
// OverpassUnavailableError when every instance failed or the budget ran out.
function overpassQuery(query, opts = {}) {
  const {
    label = 'overpass',
    attemptTimeoutMs = OVERPASS_ATTEMPT_TIMEOUT_MS,
    totalBudgetMs = OVERPASS_TOTAL_BUDGET_MS,
    hedgeAfterMs = OVERPASS_HEDGE_AFTER_MS,
    maxBytes,
  } = opts;
  const endpoints = OVERPASS_ENDPOINTS;
  if (!endpoints.length) {
    return Promise.reject(new OverpassUnavailableError('no hay instancias de Overpass configuradas'));
  }

  const started = Date.now();
  const failures = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    let launched = 0;
    let inFlight = 0;
    let hedgeTimer = null;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      fn(arg);
    };

    const giveUpIfDone = () => {
      if (inFlight === 0 && launched >= endpoints.length) {
        finish(reject, new OverpassUnavailableError(
          `Overpass no disponible (${label}) tras ${failures.length} intento(s): ${failures.join(' | ')}`
        ));
      }
    };

    const launch = () => {
      if (settled || launched >= endpoints.length) return;
      const remaining = totalBudgetMs - (Date.now() - started);
      if (remaining < 1500) { // not enough left to be worth a round trip
        launched = endpoints.length;
        giveUpIfDone();
        return;
      }
      const endpoint = endpoints[launched++];
      const host = endpoint.replace(/^https?:\/\//, '').split('/')[0];
      inFlight++;

      fetchExternal(`${endpoint}?data=${encodeURIComponent(query)}`, {
        timeoutMs: Math.min(attemptTimeoutMs, remaining),
        withStatus: true,
        maxBytes,
      })
        .then(({ status, body }) => {
          // 429 (rate limited) and 504 (query aborted / instance overloaded)
          // are the common ones, and both are worth trying somewhere else.
          if (status !== 200) {
            failures.push(`${host} HTTP ${status}`);
            return;
          }
          if (!body || typeof body !== 'object' || !Array.isArray(body.elements)) {
            failures.push(`${host} respuesta ilegible`);
            return;
          }
          if (failures.length) {
            console.warn(`[Overpass][${label}] Servido por ${host} tras ${failures.length} fallo(s): ${failures.join(', ')}`);
          }
          finish(resolve, body);
        })
        .catch((e) => { failures.push(`${host} ${e.message}`); })
        .finally(() => {
          inFlight--;
          if (settled) return;
          launch(); // this one is out of the running; bring the next one in
          giveUpIfDone();
        });

      // Don't wait for this attempt to fail before trying the next instance.
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(() => { if (!settled) launch(); }, hedgeAfterMs);
    };

    launch();
  });
}

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
    const timeout = OVERPASS_QUERY_TIMEOUT_S;

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
        node["tourism"~"attraction|museum|viewpoint|artwork|gallery"](around:${radiusMeters},${lat},${lng});
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

    const data = await overpassQuery(query, { label: 'pois' });

    // Belt-and-braces: even though the queries above don't request these,
    // drop any that slip through tag mixing. Food types are owned by the
    // Restaurants tab; theaters/cinemas only matter when there's a show.
    const SKIP_TYPES = new Set([
      'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'ice_cream',
      'theatre', 'cinema', 'nightclub',
      // Tourist info offices / ticket shops are services, not sights.
      'information'
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
    cacheSet(cacheKey, unique, OSM_CACHE_TTL);
    return unique;
  } catch (error) {
    // An upstream failure is not "there is nothing here". Serve slightly stale
    // real places if we have any; otherwise propagate, so the caller can say
    // the map is unreachable instead of inventing a route.
    if (error instanceof OverpassUnavailableError) {
      const stale = cacheGetStale(cacheKey);
      if (stale) {
        console.warn(`[Overpass] Caído — sirviendo ${stale.length} POIs de caché rancio (${cacheKey})`);
        return stale;
      }
      throw error;
    }
    console.error('[Overpass] Error:', error.message);
    return [];
  }
}

// Food venues from OpenStreetMap, for the pre-generated "ruta gastronómica"
// SEO pages. Separate from getOverpassPOIs, which deliberately skips food
// types (they belong to the Restaurants tab in the interactive app). OSM data
// is ODbL so it can be persisted — Google Places data can NOT (ToS forbids
// caching beyond 30 days), which is why this exists instead of reusing
// /api/restaurants.
async function getOverpassFoodPOIs(lat, lng, radiusMeters) {
  const cacheKey = `foodpois:${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(radiusMeters / 100) * 100}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log('[Cache] Hit for Overpass food POIs:', cacheKey);
    return cached;
  }

  try {
    const query = `[out:json][timeout:25];(
      node["amenity"~"restaurant|cafe|bar|marketplace"]["name"](around:${radiusMeters},${lat},${lng});
      way["amenity"~"restaurant|cafe|bar|marketplace"]["name"](around:${radiusMeters},${lat},${lng});
      node["shop"~"bakery|confectionery|deli|cheese|wine"]["name"](around:${radiusMeters},${lat},${lng});
      way["shop"~"bakery|confectionery|deli|cheese|wine"]["name"](around:${radiusMeters},${lat},${lng});
    );out center body;`;

    // Offline SEO generation, not the request path, so it can wait far longer
    // than the interactive queries.
    const data = await overpassQuery(query, { label: 'food', attemptTimeoutMs: 30000, totalBudgetMs: 70000 });

    // Franchises have no place on a "ruta gastronómica" — a Foster's Hollywood
    // with a cuisine tag would otherwise outrank the no-tag local taberna.
    const CHAIN_RE = /foster'?s hollywood|mcdonald|burger king|kfc|domino|telepizza|starbucks|100 montaditos|vips|tgb|the good burger|five guys|taco bell|subway|papa john|rodilla|pans ?& ?company|ginos|tagliatella|llaollao|dunkin|pizza hut|udon|sushisom|carl'?s jr/i;

    const pois = data.elements
      .filter(el => el.tags?.name && !CHAIN_RE.test(el.tags.name) && !el.tags.brand)
      .map(el => {
        const rawType = el.tags.amenity || el.tags.shop || 'restaurant';
        return {
          name: el.tags.name,
          rawType,
          type: rawType === 'marketplace' ? 'market' : 'restaurant',
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          cuisine: el.tags.cuisine || null,
          wikipedia: el.tags.wikipedia || null,
          wikidata: el.tags.wikidata || null
        };
      })
      .filter(p => p.lat && p.lng);

    const seen = new Set();
    const unique = pois.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Markets first (the editorial anchors of any food route), then venues
    // whose mapper bothered to tag the cuisine — a decent proxy for notability.
    unique.sort((a, b) => {
      const score = (p) => (p.rawType === 'marketplace' ? 2 : 0) + (p.cuisine ? 1 : 0);
      return score(b) - score(a);
    });

    console.log(`[Overpass] Found ${unique.length} food POIs within ${radiusMeters}m`);
    cacheSet(cacheKey, unique, OSM_CACHE_TTL);
    return unique;
  } catch (error) {
    console.error('[Overpass][food] Error:', error.message);
    return [];
  }
}

// Theme-based relevance scoring for POI filtering
const THEME_TYPE_SCORES = {
  monuments: { monument: 3, historic: 3, castle: 3, ruins: 3, archaeological_site: 3, memorial: 3, church: 3, palace: 3, museum: 2, artwork: 2, attraction: 2, tower: 2 },
  nature: { park: 3, garden: 3, viewpoint: 3, spring: 3, peak: 3, cave_entrance: 2 },
  food: { restaurant: 3, cafe: 3, marketplace: 3 }
};

// Notability proxy from OSM tags: a mapper linking a POI to Wikipedia/Wikidata
// (or attaching a photo) is strong evidence it's a real, characteristic sight —
// exactly what separates "Monumento al Nazareno" from an obscure roadside node.
// Small towns often have none of these tags, in which case every POI scores 0
// and selection degrades gracefully to the previous random/theme behaviour.
function poiNotability(p) {
  return (p.wikidata ? 3 : 0) + (p.wikipedia ? 3 : 0) + (p.image ? 1 : 0);
}

// Select and rank POIs based on theme, biased toward notable (characteristic) places
function selectPOIsForTheme(pois, theme, count) {
  const scores = THEME_TYPE_SCORES[theme] || {};
  const hasThemeScores = Object.keys(scores).length > 0;

  // 'mixed' (default): no category bias, but rank notable sights first. The
  // random term (0–2) keeps repeated calls fresh while still letting a
  // Wikipedia-linked POI (notability ≥3) reliably outrank an untagged one.
  if (theme === 'mixed' || !hasThemeScores) {
    const scored = pois.map(p => ({ ...p, score: poiNotability(p) + Math.random() * 2 }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count);
  }

  // Themed: combine theme relevance + notability, plus a little randomness.
  const scored = pois.map(p => ({
    ...p,
    score: (scores[p.rawType] || 1) + poiNotability(p) + Math.random() * 0.5
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

// When the model runs out of tokens mid-array, the JSON never closes and
// parseLLMJsonSafe gives up. Salvage the string elements that did come out
// complete: 8 real descriptions + 2 local fallbacks beats 10 fallbacks.
// Each complete literal (quotes included) is handed to JSON.parse so escape
// sequences are decoded exactly like a full parse would.
function salvageDescriptionsArray(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const start = raw.indexOf('[');
  if (start < 0) return null;
  const out = [];
  let i = start + 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === ']') break;
    if (ch === '"') {
      let j = i + 1;
      let esc = false;
      let closed = false;
      for (; j < raw.length; j++) {
        const c = raw[j];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { closed = true; break; }
      }
      if (!closed) break; // truncated mid-string — drop the tail
      try { out.push(JSON.parse(raw.slice(i, j + 1))); } catch { /* skip */ }
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.length > 0 ? out : null;
}

// Resolve the LLM provider from env — provider-agnostic, any OpenAI-compatible
// chat-completions endpoint (Nebius, Google Gemini, NVIDIA NIM, ...). LLM_* wins;
// falls back to the legacy NEBIUS_* vars so existing deploys keep working.
//   Gemini free tier example:
//     LLM_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
//     LLM_API_KEY=<google-ai-studio-key>
//     LLM_MODEL=gemini-flash-latest   (alias; older ids like gemini-2.5-flash 404 for new keys)
function llmConfig() {
  return {
    apiKey: process.env.LLM_API_KEY || process.env.NEBIUS_API_KEY,
    apiBaseUrl: process.env.LLM_API_BASE_URL || process.env.NEBIUS_API_BASE_URL
      || 'https://api.tokenfactory.nebius.com/v1/',
    model: process.env.LLM_MODEL || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
  };
}

// A single model is a single point of failure for every description on the site,
// and on Gemini's free tier the quota is PER MODEL. That bit us silently: the
// recommended `gemini-flash-latest` alias moved onto gemini-3.6-flash, whose free
// tier is 20 requests A DAY (the older Flash allowed far more), so descriptions
// quietly fell back to templates after twenty decks. Alias drift is invisible;
// running out is not, if there is somewhere else to go.
//
// Order: the configured model, then LLM_FALLBACK_MODELS on the same provider,
// then the legacy Nebius provider when its key is present.
function llmCandidates() {
  const primary = llmConfig();
  const candidates = [];
  if (primary.apiKey) {
    candidates.push(primary);
    for (const model of (process.env.LLM_FALLBACK_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      if (model !== primary.model) candidates.push({ ...primary, model });
    }
  }
  const nebiusKey = process.env.NEBIUS_API_KEY;
  if (nebiusKey && nebiusKey !== primary.apiKey) {
    candidates.push({
      apiKey: nebiusKey,
      apiBaseUrl: process.env.NEBIUS_API_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/',
      model: process.env.NEBIUS_MODEL || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
    });
  }
  return candidates;
}

// Errors where trying a different model or provider is the right move: quota
// exhausted, rate limited, or the model retired. Anything else (a bad prompt, a
// malformed request) would fail identically everywhere.
const LLM_TRY_ELSEWHERE_RE = /quota|rate.?limit|429|resource.?exhausted|no longer available|not found|unsupported|insufficient|credit|balance|payment|402|50\d\b/i;

// Call an OpenAI-compatible chat-completions endpoint once and return the message
// content string (empty string on error). Centralised so the retry wrapper below
// doesn't duplicate request plumbing.
async function callLLMOnce(body, apiBaseUrl, apiKey, timeoutMs = 45000) {
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  let response = await fetchExternal(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    // Generation is slower than a normal API call, but still bounded — a stuck
    // provider must not hold the request open forever. The default suits the
    // background description backfill; callers that block a user request pass
    // something tighter.
    timeoutMs,
  });
  // Some OpenAI-compatible endpoints (e.g. Gemini) return errors wrapped in an
  // array — [{ "error": {...} }] — so unwrap before checking, otherwise a hard
  // 404/429 gets silently swallowed as empty content instead of a clear error.
  if (Array.isArray(response)) response = response[0] || {};
  if (response.error || response.detail) {
    const msg = response.error?.message || response.detail || JSON.stringify(response.error || response);
    throw new Error(`LLM API error: ${msg}`);
  }
  return response.choices?.[0]?.message?.content || '';
}

// Call Nebius API to get descriptions for real POIs.
// options.cautious: for places the model probably doesn't know (local bars,
// obscure trails) — tells it to describe type/context instead of inventing
// specifics. Used by the SEO page generator, where hallucinated "facts"
// In-memory cache for place descriptions. A description is stable for a given
// place, so caching avoids repeat LLM calls (cost + latency) when the same
// deck is reopened or different users explore the same city. Soft-capped with
// LRU-style eviction; lost on restart, which is fine — it just re-warms.
const DESCRIPTION_CACHE = new Map();
const DESCRIPTION_CACHE_MAX = 5000;

function descCacheKey(name, city, theme) {
  return `${String(name).trim().toLowerCase()}|${String(city).trim().toLowerCase()}|${theme}`;
}

function getCachedDescription(name, city, theme) {
  const key = descCacheKey(name, city, theme);
  if (!DESCRIPTION_CACHE.has(key)) return undefined;
  // Touch recency: re-insert moves the entry to the newest position.
  const val = DESCRIPTION_CACHE.get(key);
  DESCRIPTION_CACHE.delete(key);
  DESCRIPTION_CACHE.set(key, val);
  return val;
}

function setCachedDescription(name, city, theme, description) {
  if (!description) return;
  const key = descCacheKey(name, city, theme);
  if (DESCRIPTION_CACHE.has(key)) DESCRIPTION_CACHE.delete(key);
  DESCRIPTION_CACHE.set(key, description);
  while (DESCRIPTION_CACHE.size > DESCRIPTION_CACHE_MAX) {
    DESCRIPTION_CACHE.delete(DESCRIPTION_CACHE.keys().next().value); // evict oldest
  }
}

// would be published permanently.
// On the request path this is the THIRD-tier description source (see
// /api/descriptions): used only for POIs with no Wikipedia article, where a bare
// per-type template reads as generic. Also used by the offline SEO page generator
// (scripts/generateSeoPages.js). Returns null without a key, so callers must fall
// back to a template and NEBIUS_API_KEY stays optional.
async function getDescriptionsFromLLM(places, city, country, theme, options = {}) {
  const candidates = llmCandidates();
  if (!candidates.length) {
    console.warn('[LLM] No API key, skipping descriptions');
    return null;
  }
  for (let i = 0; i < candidates.length; i++) {
    const result = await describeWith(candidates[i], places, city, country, theme, options);
    if (result.descriptions) return result.descriptions;
    if (!result.tryElsewhere || i === candidates.length - 1) return null;
    const next = candidates[i + 1];
    console.warn(`[LLM] ${candidates[i].model} no disponible; probando ${next.model}`);
  }
  return null;
}

// One provider/model attempt. Resolves { descriptions } on success, or
// { tryElsewhere } when the failure is the kind another model could survive.
async function describeWith({ apiKey, apiBaseUrl, model }, places, city, country, theme, options = {}) {
  try {

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
Ejemplo: {"descriptions": ["Mercado cubierto de producto fresco, con puestos y barras donde comer de pie.", "Parque urbano amplio, buen sitio para descansar a mitad del recorrido.", ...]}

IMPORTANTE: Cada descripcion debe ser informativa y especifica sobre ese lugar concreto. NO uses descripciones genericas. No empieces la descripcion repitiendo el nombre del lugar. NO menciones barrios, distritos ni calles concretas: solo tienes el nombre y la ciudad, no puedes saber la zona con certeza y el mapa ya muestra donde esta. NO indiques el SIGLO, el año de construccion ni el ESTILO arquitectonico (barroco, neoclasico, art deco, modernista, gotico, renacentista...): son los datos que mas se inventan y quedan publicados como si fueran ciertos. NO nombres ninguna otra ciudad, pueblo, provincia ni monumento que no sea el lugar descrito. Centrate en QUE es el lugar y POR QUE merece la pena.${options.cautious ? '\nPRUDENCIA: si no conoces datos concretos y verificables de un lugar, describe su tipo y por que puede interesar, SIN inventar detalles especificos (fechas, siglos, estilos arquitectonicos, premios, platos estrella, barrios, hitos del recorrido o lugares por los que pasa).' : ''}`;

    console.log('[LLM] Requesting descriptions for', places.length, 'places in', city);

    // Nemotron burns completion tokens on hidden reasoning before emitting
    // the JSON; with 10 cards (and the longer cautious prompt) 3000 still
    // truncated mid-array. The cap is not a spend — only generated tokens
    // bill — so keep it roomy. The retry asks for one short sentence per
    // place at low temperature, which shrinks both reasoning and output.
    const buildBody = (attempt) => ({
      model,
      messages: [
        {
          role: 'system',
          content: attempt === 0
            ? 'Eres un experto en turismo. Responde con JSON valido. Todas las descripciones en español. Cada descripcion debe ser especifica e informativa sobre el lugar.'
            : 'Eres un experto en turismo. Devuelve EXCLUSIVAMENTE un objeto JSON valido y completo con la clave "descriptions". Sin markdown ni prosa. Descripciones en español, UNA sola frase corta por lugar (maximo 20 palabras).',
        },
        { role: 'user', content: prompt },
      ],
      temperature: attempt === 0 ? 0.7 : 0.3,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    // best = the longest partial we've salvaged; callers pad the missing
    // tail with local fallbacks per index, so partial output is still useful.
    let best = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let content = '';
      try {
        content = await callLLMOnce(buildBody(attempt), apiBaseUrl, apiKey);
      } catch (e) {
        console.error(`[LLM][ALERT] API error getting descriptions (${model}):`, e.message);
        const tryElsewhere = LLM_TRY_ELSEWHERE_RE.test(String(e.message));
        if (tryElsewhere) {
          console.error('[LLM][ALERT] Cuota, límite o modelo retirado en este proveedor. Si no hay alternativa configurada (LLM_FALLBACK_MODELS o NEBIUS_API_KEY), las descripciones caerán a plantillas.');
        }
        // Retrying the same model in-request won't help; another one might.
        return { tryElsewhere };
      }
      if (!content) {
        console.error('[LLM][ALERT] Respuesta de descripciones vacía (posible falta de crédito/cuota del proveedor LLM).');
        continue;
      }

      const parsed = parseLLMJsonSafe(content);
      let descriptions = parsed
        ? (parsed.descriptions || Object.values(parsed).find((v) => Array.isArray(v)))
        : salvageDescriptionsArray(content);
      if (!Array.isArray(descriptions) || descriptions.length === 0) descriptions = null;

      if (descriptions && descriptions.length >= places.length) return { descriptions };
      if (descriptions) {
        if (!best || descriptions.length > best.length) best = descriptions;
        console.warn(`[LLM] Truncated descriptions (${descriptions.length}/${places.length})${attempt === 0 ? ', retrying' : ''}`);
      } else if (attempt === 0) {
        console.warn('[LLM] Invalid descriptions JSON, retrying with stricter prompt:', content.substring(0, 200));
      }
    }

    if (best) return { descriptions: best };
    console.error('[LLM] No usable descriptions after retry');
    // Unparseable output is a model-quality problem, so another model is worth a go.
    return { tryElsewhere: true };
  } catch (e) {
    console.error('[LLM] Failed to get descriptions:', e.message);
    return {};
  }
}

// Fallback: Call Nebius API to get full tourist route (when Overpass has no data)
async function getTouristRouteFromLLM(city, lat, lng, country, theme, transport, maxRouteDistance) {
  const { apiKey, apiBaseUrl, model } = llmConfig();

  if (!apiKey) throw new Error('LLM API key not configured');

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
- description: Una frase atractiva en ESPAÑOL explicando por que merece la pena visitarlo (sin nombrar barrios, distritos ni calles)

Devuelve un objeto JSON con una clave "places" que contenga un array:
{"places": [{"name": "Nombre del Lugar", "type": "monument", "lat": ${lat.toFixed(2)}, "lng": ${lng.toFixed(2)}, "description": "Descripcion en español"}, ...]}

IMPORTANTE: Usa coordenadas REALES de lugares verificados que existan en ${city}. Si no estas seguro de que un lugar existe, NO lo incluyas. NO incluyas restaurantes, cafes, bares, locales gastronomicos, teatros ni cines: esta ruta es para VER lugares de interes (cosas que enseñaria una oficina de turismo a alguien que tiene un dia para visitar la ciudad). La app tiene una pestaña aparte para restaurantes y los teatros solo merecen la pena si hay un espectaculo ese dia. En las descripciones NO menciones barrios, distritos ni calles concretas: centrate en QUE es el lugar y POR QUE merece la pena. Devuelve exactamente ${placeCount} lugares. Ordenalos para una ruta ${modeLabel}.`;

  console.log('[LLM] Fallback: requesting full route for:', city, '| theme:', theme, '| transport:', transport);

  // Two attempts: first creative pass, then a stricter retry if the model
  // returns malformed JSON. Bumped max_tokens to avoid mid-array truncation
  // on longer routes.
  const buildBody = (attempt) => ({
    model,
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
    max_tokens: 5000,
    response_format: { type: 'json_object' },
  });

  let parsed = null;
  let lastContent = '';
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    // This path blocks a user staring at a spinner (it only runs where Overpass
    // genuinely has nothing), and two attempts at the 45s default meant a 90s
    // ceiling for an answer that is often "no places here" anyway. Keep both
    // attempts inside the client's own 25s cap.
    const content = await callLLMOnce(buildBody(attempt), apiBaseUrl, apiKey, 8000);
    lastContent = content;
    if (!content) {
      console.error('[LLM] Empty response on attempt', attempt);
      continue;
    }
    parsed = parseLLMJsonSafe(content);
    if (!parsed && attempt === 0) {
      console.warn('[LLM] Invalid JSON on first attempt, retrying with stricter prompt');
    }
  }
  if (!parsed) {
    console.error('[LLM] Failed to parse JSON after retry:', lastContent.substring(0, 300));
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

  console.log('[LLM] Parsed places count:', places.length);
  return places;
}

// Per-type fallback descriptions: the base layer, used when the LLM is
// unavailable (no key / outage) and as the always-on floor. Several variants per
// type, picked deterministically from the place name, so the same place is stable
// across requests but different places don't all read identically. Built from data
// we already have (type + city) at zero API cost.
const FALLBACK_DESC_BY_TYPE = {
  monument: [
    (c) => `Un monumento emblemático de ${c}; una parada que merece la pena en la ruta.`,
    (c) => `Uno de los hitos de ${c}, con carácter y siglos de historia a sus espaldas.`,
    (c) => `Un punto con solera de ${c}, ideal para detenerse un momento y hacer una foto.`,
  ],
  museum: [
    (c) => `Un museo de ${c} ideal para descubrir su historia y su cultura.`,
    (c) => `Un espacio de ${c} donde asomarse a su arte y su memoria con calma.`,
    (c) => `Una visita cultural de ${c}, perfecta para entender mejor la ciudad.`,
  ],
  viewpoint: [
    (c) => `Un mirador de ${c} con bonitas vistas para detenerse un momento.`,
    (c) => `Un balcón sobre ${c}: un buen sitio para respirar y mirar el paisaje.`,
    (c) => `Un punto elevado de ${c} desde el que la ciudad se ve de otra manera.`,
  ],
  palace: [
    (c) => `Un palacio histórico de ${c} que refleja su patrimonio arquitectónico.`,
    (c) => `Una antigua residencia señorial de ${c}, con fachadas que invitan a mirar hacia arriba.`,
    (c) => `Un edificio noble de ${c} que conserva el aire de otra época.`,
  ],
  historic: [
    (c) => `Un rincón histórico de ${c}, con encanto y siglos de historia.`,
    (c) => `Un lugar cargado de pasado en ${c}, de esos que cuentan cómo era la ciudad.`,
    (c) => `Un enclave con historia de ${c}, agradable para pasear sin prisa.`,
  ],
  church: [
    (c) => `Un templo de ${c} que destaca por su arquitectura y su valor histórico.`,
    (c) => `Una iglesia de ${c} que merece un vistazo por dentro y por fuera.`,
    (c) => `Un edificio religioso de ${c}, remanso de calma y buena arquitectura.`,
  ],
  market: [
    (c) => `Un mercado de ${c}, perfecto para descubrir el ambiente y los productos locales.`,
    (c) => `Un mercado de ${c} donde se palpa el pulso del día a día y se come bien.`,
    (c) => `Un punto de ${c} lleno de vida, ideal para picar algo y ver producto local.`,
  ],
  park: [
    (c) => `Un parque de ${c} ideal para un paseo tranquilo al aire libre.`,
    (c) => `Una zona verde de ${c} para descansar las piernas y tomar aire.`,
    (c) => `Un espacio al aire libre de ${c}, buen sitio para una pausa relajada.`,
  ],
  garden: [
    (c) => `Un jardín de ${c} donde relajarse rodeado de naturaleza.`,
    (c) => `Un jardín de ${c}, un respiro verde en mitad del recorrido.`,
    (c) => `Un rincón ajardinado de ${c}, agradable para pasear con calma.`,
  ],
  plaza: [
    (c) => `Una plaza con encanto de ${c}, un buen punto para hacer una pausa.`,
    (c) => `Una plaza de ${c} donde sentarse un rato y ver pasar la ciudad.`,
    (c) => `Un espacio abierto de ${c}, punto de encuentro y buena parada.`,
  ],
  theater: [
    (c) => `Un teatro de ${c}, parte de su vida cultural.`,
    (c) => `Un teatro de ${c} con historia sobre y bajo el escenario.`,
    (c) => `Un espacio escénico de ${c}, testigo de su agenda cultural.`,
  ],
  restaurant: [
    (c) => `Un local de ${c} bien valorado por los visitantes.`,
    (c) => `Un sitio de ${c} para probar la cocina de la zona.`,
    (c) => `Un local de ${c} donde hacer un alto y comer algo rico.`,
  ],
};

const FALLBACK_DESC_GENERIC = [
  (c) => `Un lugar de interés de ${c} que merece una parada en la ruta.`,
  (c) => `Un rincón de ${c} que aporta su punto al recorrido.`,
  (c) => `Un sitio de ${c} que vale un alto en el camino.`,
];

// Stable index from a string: the same name always maps to the same variant, so a
// place's description doesn't flicker between requests, while different places
// spread across the pool.
function stableIndex(str, mod) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function fallbackDescription(place, city) {
  const c = city && city !== 'la zona' ? city : 'la zona';
  const pool = FALLBACK_DESC_BY_TYPE[place.type] || FALLBACK_DESC_GENERIC;
  const key = String(place.name || place.type || 'x');
  return pool[stableIndex(key, pool.length)](c);
}

// Resolve a promise but give up after `ms`, yielding `fallback` instead. Keeps a
// slow external call (fetchExternal has no socket timeout) from stalling a batch
// — the same guard fetchAllPOIImages already uses for images.
function raceTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Trim a Wikipedia extract down to a short, card-sized blurb (1-2 sentences).
// Deck cards are compact and offer a "Ver más", so keep the default tight.
function trimExtract(extract) {
  if (!extract) return null;
  const clean = String(extract).replace(/\s+/g, ' ').trim();
  if (clean.length < 15) return null;
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  let out = sentences ? sentences[0].trim() : clean;
  if (sentences && out.length < 90 && sentences[1]) out += ' ' + sentences[1].trim();
  if (out.length > 220) out = out.slice(0, 200).replace(/\s+\S*$/, '') + '…';
  return out;
}

// Real, verified description straight from Wikipedia — for POIs that OSM tagged
// with a wikipedia article. Reuses the same REST summary endpoint that sources
// images (the extract ships in the same response), so it costs no API budget and
// no LLM. Returns null when there's no wiki tag or the fetch fails.
async function descriptionFromWikipedia(place) {
  if (!place || !place.wikipedia) return null;
  const parts = String(place.wikipedia).split(':');
  const lang = parts.length > 1 ? parts[0] : 'es';
  const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
  if (!title) return null;
  // Validated builder: the tag is client-supplied via POST /api/descriptions, and
  // the language segment used to land in the URL's host position (SSRF).
  const url = wikipediaSummaryUrl(lang, title);
  if (!url) return null;
  try {
    const data = await fetchExternal(url);
    return trimExtract(data && data.extract);
  } catch (_) {
    return null;
  }
}

// A place's description without any LLM: verified Wikipedia extract when the POI
// carries a wikipedia tag, per-type template otherwise. `fromWiki` lets callers
// cache only genuine extracts (never the generic template).
async function resolveDescription(place, city) {
  const wiki = await raceTimeout(descriptionFromWikipedia(place), 4000);
  if (wiki) return { text: wiki, fromWiki: true };
  return { text: fallbackDescription(place, city), fromWiki: false };
}

// Descriptions for a batch of POIs, resolved in parallel. No LLM, no API cost.
async function buildDescriptions(places, city) {
  const resolved = await Promise.all(places.map((p) => resolveDescription(p, city)));
  return resolved.map((r) => r.text);
}

// Main function: build route from real POIs + Wikipedia/template descriptions
// useGoogle=false: the daily Google budget is spent, so skip its (paid) photos,
// ratings and hours and serve the trip from OSM + Wikipedia only.
async function buildRoute(city, lat, lng, country, theme, transport, realPOIs, maxRouteDistance, candidateCount, fast = false, useGoogle = true) {
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
      try {
        pois = await getOverpassPOIs(lat, lng, fallbackR);
      } catch (e) {
        // Widening is opportunistic: if Overpass went down mid-way, keep the
        // POIs we already have rather than losing a route we could still build.
        console.warn('[Route] Overpass no disponible al ampliar el radio:', e.message);
        break;
      }
      if (pois.length >= 3) break;
    }
  }

  // The curation deck shows one big photo per card, so a card with no image is
  // dead weight. In deck mode we over-fetch, then keep only POIs that resolved
  // an image (below), trimming back down to desiredCount.
  const deckMode = isCandidateMode && fast;

  if (pois.length > 0) {
    const selectCount = deckMode
      ? Math.min(pois.length, desiredCount + 8)
      : Math.min(desiredCount, pois.length);
    let selected = selectPOIsForTheme(pois, theme, selectCount);
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

    // Resolve descriptions (Wikipedia extract + templates, no LLM), images and
    // Google data in parallel. In fast candidate mode we skip descriptions here
    // so the deck appears instantly; the client backfills via /api/descriptions.
    const wantDescriptions = !(fast && isCandidateMode);
    const [descriptions, placesWithImages, googleData] = await Promise.all([
      wantDescriptions ? buildDescriptions(sorted, city) : Promise.resolve(null),
      fetchAllPOIImages(sorted, city),
      useGoogle ? fetchAllPOIGoogleData(sorted, city) : Promise.resolve([])
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
        // Fast deck mode skips the slow LLM here, but a card should never be
        // blank: ship the instant local fallback now and let the client upgrade
        // it via the background /api/descriptions call.
        description: wantDescriptions
          ? ((descriptions && descriptions[i]) || fallbackDescription(p, city))
          : fallbackDescription(p, city),
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

    // Deck mode: drop the imageless cards, keep desiredCount. Guard against
    // pruning the deck into uselessness — if too few have images (a sparse
    // village), fall back to the full set rather than a 1-card deck.
    if (deckMode) {
      const withImg = places.filter(p => p.imageUrl);
      const finalPlaces = (withImg.length >= 3 ? withImg : places).slice(0, desiredCount);
      console.log(`[Route] Deck: ${withImg.length}/${places.length} POIs with image, returning ${finalPlaces.length}`);
      return { places: finalPlaces, poiSource: 'overpass' };
    }

    return { places, poiSource: 'overpass' };
  }

  // Last resort: no Overpass data at all (very remote area). This is the ONLY
  // remaining place the LLM invents places at runtime, and it's optional — if no
  // LLM key is configured (or the call fails) we return no places and the caller
  // responds 404 instead of a 500, so running without an LLM is safe.
  console.log('[Route] No Overpass POIs found at any radius, trying optional LLM fallback');
  let llmPlaces = [];
  try {
    llmPlaces = await getTouristRouteFromLLM(city, lat, lng, country, theme, transport, maxRouteDistance);
  } catch (e) {
    console.warn('[Route] LLM fallback unavailable:', e.message);
    return { places: [], poiSource: 'none' };
  }
  if (!Array.isArray(llmPlaces) || llmPlaces.length === 0) {
    return { places: [], poiSource: 'none' };
  }
  // LLM places have no wikipedia/wikidata tags — attempt Wikipedia + Google in parallel
  const [withImages, googleData] = await Promise.all([
    fetchAllPOIImages(llmPlaces, city),
    useGoogle ? fetchAllPOIGoogleData(llmPlaces, city) : Promise.resolve([])
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

// Google `types=geocode` predictions we drop: streets, house addresses and
// postal codes are noise in a "where do you want to explore" box. Everything
// else (locality, sublocality, neighborhood, administrative areas) is a
// valid trip origin.
const NON_AREA_GEOCODE_TYPES = new Set([
  'route', 'street_address', 'street_number', 'intersection',
  'premise', 'subpremise', 'floor', 'room', 'postal_code', 'plus_code'
]);

// Search cities via Google Places Autocomplete. Google matches alt names
// ("Ibiza" finds Eivissa and shows it as "Ibiza"), tolerates typos and ranks
// by popularity — the quality users expect from address boxes in online shops.
// Predictions carry no coordinates; the client resolves the chosen one via
// /api/resolve-city. `session` groups the keystrokes and the resolve into one
// Google billing session. Returns null (→ Photon fallback) when the key is
// missing, the daily budget is spent, or Google errors out.
async function searchCityGoogle(q, session) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `citysearch:${q.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached !== null) return cached;

  if (!tryReserveBudget(COST_PER_CITY_AUTOCOMPLETE_USD)) return null;

  const sessionParam = session && /^[\w-]{8,64}$/.test(session)
    ? `&sessiontoken=${session}` : '';
  // types=geocode (not `(cities)`) so neighborhoods come back too — "barrio
  // ibiza" should find Ibiza, Madrid, and "malasaña" isn't even a sublocality
  // in Google's data (the `(regions)` collection misses it; only geocode's
  // `neighborhood` type has it). Streets/addresses are filtered out below.
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
              `?input=${encodeURIComponent(q)}&types=geocode&language=es${sessionParam}&key=${apiKey}`;
  const data = await fetchExternal(url).catch(() => null);
  if (!data || (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) {
    console.warn(`[Search] Google autocomplete failed (${data?.status || 'no response'}), falling back to Photon`);
    return null;
  }

  const results = (data.predictions || [])
    .filter(p => !(p.types || []).some(t => NON_AREA_GEOCODE_TYPES.has(t)))
    .slice(0, 6)
    .map(p => {
      const terms = (p.terms || []).map(t => t.value);
      return {
        name: p.structured_formatting?.main_text || terms[0] || p.description,
        region: terms.length > 2 ? terms.slice(1, -1).join(', ') : '',
        country: terms.length > 1 ? terms[terms.length - 1] : '',
        countryCode: '',
        displayName: p.description,
        placeId: p.place_id,
        lat: null,
        lng: null
      };
    });
  cacheSet(cacheKey, results);
  return results;
}

// Fallback: search cities via Photon (Komoot's OSM-based autocomplete). Unlike
// Nominatim, Photon does real prefix matching so "Alham" matches "Alhama de Aragón".
async function searchCityPhoton(q) {
  // Ask Photon only for settlement-type places (repeated osm_tag params are
  // OR'ed). Without this, popular names can fill every slot with streets,
  // quarters and railway stops before any city appears — e.g. "Ibiza"
  // returned 20 non-settlement hits and the town (OSM name "Eivissa",
  // matched via its Spanish alt name) never made it into the response.
  // Photon only supports lang=default|de|en|fr; we omit lang so it returns
  // each place's local name (Spanish cities come back in Spanish, etc).
  const placeTags = [...CITYLIKE_PLACE_TYPES].map(t => `&osm_tag=place:${t}`).join('');
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
              `&limit=20${placeTags}`;
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
  return [...dedup.values()]
    .map(c => ({ ...c, _rankKey: cityRank(c.name, q, c._importance) }))
    .sort((a, b) => {
      if (a._rankKey[0] !== b._rankKey[0]) return a._rankKey[0] - b._rankKey[0];
      return a._rankKey[1] - b._rankKey[1];
    })
    .slice(0, 6)
    .map(({ _importance, _rankKey, ...c }) => c); // strip internals
}

app.get('/api/search-city', async (req, res) => {
  try {
    const { q, session } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }
    const google = await searchCityGoogle(q, session);
    res.json(google !== null ? google : await searchCityPhoton(q));
  } catch (error) {
    console.error('[Search] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Resolve a Google Autocomplete prediction to coordinates. Called once when
// the user picks a suggestion; with the same `session` token Google bills the
// whole autocomplete session as this single Place Details request.
app.get('/api/resolve-city', async (req, res) => {
  try {
    const { placeId, session } = req.query;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!placeId || !/^[\w-]+$/.test(placeId)) {
      return res.status(400).json({ error: 'placeId requerido' });
    }
    if (!apiKey) return res.status(503).json({ error: 'No disponible' });

    const cacheKey = `cityresolve:${placeId}`;
    const cached = cacheGet(cacheKey);
    if (cached !== null) return res.json(cached);

    if (!await tryReserveBudgetChecked(COST_PER_CITY_RESOLVE_USD)) {
      return budgetExceededResponse(res);
    }

    const sessionParam = session && /^[\w-]{8,64}$/.test(session)
      ? `&sessiontoken=${session}` : '';
    const url = `https://maps.googleapis.com/maps/api/place/details/json` +
                `?place_id=${placeId}&fields=geometry/location${sessionParam}&key=${apiKey}`;
    const data = await fetchExternal(url);
    const loc = data?.result?.geometry?.location;
    if (!Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lng)) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }

    const out = { lat: loc.lat, lng: loc.lng };
    cacheSet(cacheKey, out);
    res.json(out);
  } catch (error) {
    console.error('[Search] Resolve error:', error.message);
    res.status(500).json({ error: 'Resolve failed' });
  }
});

// Get place image by name + city.
// Tries Google Places (if key configured) first for food POIs, then falls back to
// our Wikipedia/Wikidata/Commons resolver. The resolver validates title match so
// we don't return images from unrelated places with similar names.
// For sights we accept Google's photo only when the matched place isn't a
// hospital/shop/hotel/restaurant (see NON_SIGHT_PHOTO_TYPES), and fall back to Wikipedia.
app.get('/api/place-image', async (req, res) => {
  const { name, city, type, lat, lng } = req.query;
  if (!name) return res.json({ url: null });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const isFood = type === 'restaurant';
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum)
    && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180;

  // 1. Google Places: precise photos for restaurants. For sights we accept its
  //    photo only when the matched place isn't a hospital/shop/hotel/etc.
  //    When the caller knows the POI's coordinates, the search is biased to
  //    them and far-away matches (same-named place across town) are rejected.
  // Google Places photos cost money and this endpoint is hit per card, so gate
  // it on the shared daily budget. If the budget is spent we skip Google and use
  // the free Wikipedia resolver below — an image request should degrade, not 429.
  if (apiKey && tryReserveBudget(COST_PER_PLACE_IMAGE_USD)) {
    // The reservation covers a text search + a photo. When we end up NOT using
    // Google's photo (no match, wrong place type, too far away, or an error) the
    // photo half was never billed, so give the reservation back instead of
    // letting the counter drift above real spend.
    let usedGoogle = false;
    try {
      const query = encodeURIComponent(`${name} ${city || ''}`);
      const bias = hasCoords ? `&location=${latNum},${lngNum}&radius=2000` : '';
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}${bias}&key=${apiKey}`;
      const data = await fetchExternal(searchUrl);
      const top = data.results?.[0];
      const gLoc = top?.geometry?.location;
      const nearOk = !hasCoords || !gLoc || !Number.isFinite(gLoc.lat) || !Number.isFinite(gLoc.lng)
        || haversineMeters(latNum, lngNum, gLoc.lat, gLoc.lng) <= GOOGLE_MATCH_MAX_METERS;
      const photoRef = top?.photos?.[0]?.photo_reference;
      const typesOk = isFood || !(top?.types || []).some((t) => NON_SIGHT_PHOTO_TYPES.has(t));
      // Same guard as fetchPOIGoogleData: near enough AND actually the same
      // place by name. Distance alone lets a fuzzy match inside the same town
      // through, which is how a park ended up wearing another park's photo.
      const nameOk = top && googleNameMatchesPOI(name, top.name);
      if (photoRef && typesOk && nearOk && nameOk) {
        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
        const cdnUrl = await followRedirect(photoApiUrl);
        if (cdnUrl) {
          usedGoogle = true;
          return res.json({ url: cdnUrl, source: 'google' });
        }
      }
    } catch (e) {
      console.error('[Places] Google error:', e.message);
    } finally {
      // Keep only the text-search share of the estimate when the photo was unused.
      if (!usedGoogle) releaseBudget(COST_PER_PLACE_IMAGE_USD - 0.032);
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

// ========== HIKING TRAILS ==========

// Haversine distance between two points (meters)
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Decimate a polyline to at most `maxPoints` vertices using regular sampling.
// Cheap alternative to Douglas-Peucker — good enough for visual rendering at
// the zoom levels this app uses.
function decimate(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

// Sum of haversine distances along an ordered list of [lat, lng] points.
function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Stitch a hiking relation's member ways into a single ordered polyline.
// Overpass returns each member's `geometry` as an array of {lat, lon}; we
// concatenate them, dropping consecutive duplicates at join points.
function buildTrailGeometry(relation) {
  const members = (relation.members || []).filter(m => m.type === 'way' && Array.isArray(m.geometry));
  if (members.length === 0) return [];
  const points = [];
  for (const m of members) {
    for (const pt of m.geometry) {
      const last = points[points.length - 1];
      if (!last || last[0] !== pt.lat || last[1] !== pt.lon) {
        points.push([pt.lat, pt.lon]);
      }
    }
  }
  return points;
}

// Difficulty rank for sac_scale — lower = easier. Used both for filtering and
// for picking a polyline color in the frontend.
const SAC_RANK = {
  hiking: 1,
  mountain_hiking: 2,
  demanding_mountain_hiking: 3,
  alpine_hiking: 4,
  demanding_alpine_hiking: 5,
  difficult_alpine_hiking: 6,
};

// Query Overpass for OSM-tagged hiking routes near a point and return a
// curated list with stitched polylines, length, difficulty and signposting
// network. Shared by the /api/hiking-trails endpoint and the SEO page
// generator (scripts/generateSeoPages.js).
async function fetchHikingTrails(latNum, lngNum, radiusMeters) {
  // `out geom;` returns each relation with full member geometry plus tags —
  // we need both to render the polyline and label it.
  const query = `[out:json][timeout:30];relation["route"="hiking"](around:${radiusMeters},${latNum},${lngNum});out geom;`;
  // Heavy query, and its callers are the SEO generator and an endpoint with no
  // UI client, so it gets a longer leash than the interactive path — including a
  // bigger byte cap. `out geom;` returns every node of every way of every hiking
  // relation, and around a mountainous city that is a lot: at a 25km radius
  // Bilbao blew past the 8MB default on both instances, which failed the page.
  let data;
  try {
    data = await overpassQuery(query, {
      label: 'hiking',
      attemptTimeoutMs: 35000,
      totalBudgetMs: 80000,
      maxBytes: 48 * 1024 * 1024,
    });
  } catch (e) {
    console.warn('[Hiking] Overpass no disponible:', e.message);
    return { trails: [], origin: { lat: latNum, lng: lngNum } };
  }

  const trails = [];
  for (const rel of data.elements) {
    if (rel.type !== 'relation' || !rel.tags) continue;
    const tags = rel.tags;
    const name = tags['name:es'] || tags.name;
    if (!name) continue;

    const geometry = buildTrailGeometry(rel);
    if (geometry.length < 2) continue;

    // Trail length: prefer the tag (authoritative, set by the mapper) but
    // fall back to summing the stitched polyline when missing.
    let distance = null;
    if (tags.distance) {
      const parsed = parseFloat(String(tags.distance).replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) distance = parsed * 1000; // km → meters
    }
    if (!distance) distance = polylineLength(geometry);

    // Distance from search origin to the nearest point on the trail —
    // used as the sort key so the closest trails appear first.
    let nearest = Infinity;
    for (const [plat, plng] of geometry) {
      const d = haversineMeters(latNum, lngNum, plat, plng);
      if (d < nearest) nearest = d;
      if (nearest < 200) break; // close enough, stop scanning
    }

    trails.push({
      id: rel.id,
      name,
      distance: Math.round(distance),
      sacScale: tags.sac_scale || null,
      sacRank: SAC_RANK[tags.sac_scale] || null,
      network: tags.network || null,
      operator: tags.operator || null,
      website: tags.website || tags['website:en'] || null,
      description: tags.description || tags['description:es'] || null,
      symbol: tags.symbol || null,
      colour: tags.colour || tags.color || null,
      roundtrip: tags.roundtrip === 'yes',
      ref: tags.ref || null,
      // Decimated for transport; client renders polylines, not pixel art.
      geometry: decimate(geometry, 200),
      distanceFromOrigin: Math.round(nearest),
    });
  }

  trails.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  const top = trails.slice(0, 20);

  console.log(`[Hiking] Returned ${top.length}/${trails.length} trails within ${radiusMeters}m of ${latNum},${lngNum}`);
  return {
    trails: top,
    origin: { lat: latNum, lng: lngNum },
    radius: radiusMeters,
    total: trails.length,
  };
}

// GET /api/hiking-trails — validation + caching around fetchHikingTrails.
// No /api/hiking-trails endpoint: the hiking tab was removed from the UI, and an
// endpoint with no client was still answering the heaviest Overpass query on the
// site to anyone who found it. fetchHikingTrails() stays — the SEO generator uses
// it to build the /ciudad/*/senderos pages.

// Generate trip
app.get('/api/generate-trip', async (req, res) => {
  try {
    const { lat, lng, theme = 'mixed', transport = 'driving', radius, count, city: cityParam, country: countryParam } = req.query;

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

    // Reserve daily Google Places budget. Running out must DEGRADE, not break:
    // the places themselves come from Overpass and images from Wikipedia, both
    // free, so a trip is still perfectly usable without Google's photos, ratings
    // and hours. Refusing the request outright made the whole app unusable for
    // the rest of the day over a self-imposed estimate — with Google having
    // billed nothing.
    const useGoogle = Boolean(process.env.GOOGLE_PLACES_API_KEY)
      && await tryReserveBudgetChecked(COST_PER_TRIP_USD);
    if (process.env.GOOGLE_PLACES_API_KEY && !useGoogle) {
      console.warn('[Budget] Daily cap reached — serving this trip without Google data (OSM + Wikipedia only)');
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

    // Resolve the city name. Prefer the name the client already knows (it came
    // from the city search), since reverse-geocoding Nominatim from a shared
    // server IP gets throttled and silently falls back to a generic label.
    // Only reverse-geocode when no city was provided (e.g. "use my location").
    const trimmedCity = (cityParam || '').trim();
    const locationPromise = trimmedCity
      ? Promise.resolve({ city: trimmedCity, country: (countryParam || '').trim(), displayName: trimmedCity })
      : getCityFromCoords(latNum, lngNum);
    let locationInfo;
    let realPOIs;
    try {
      [locationInfo, realPOIs] = await Promise.all([
        locationPromise,
        getOverpassPOIs(latNum, lngNum, searchRadius)
      ]);
    } catch (error) {
      // The map of places is unreachable. Say so. The alternative — what this
      // used to do — was to fall through to the LLM route and present invented
      // places as if they came from OpenStreetMap, in Madrid included.
      if (error instanceof OverpassUnavailableError) {
        if (useGoogle) releaseBudget(COST_PER_TRIP_USD);
        console.error('[API]', error.message);
        return res.status(503).json({
          error: 'No hemos podido consultar el mapa de lugares. Suele ser cosa de un momento: vuelve a intentarlo.',
          retryable: true
        });
      }
      throw error;
    }
    console.log('[API] Location:', locationInfo.city, locationInfo.country, '| Real POIs:', realPOIs.length);

    // fast=1: skip the slow LLM descriptions so the candidate deck appears in
    // seconds; the client backfills them via POST /api/descriptions.
    const fast = req.query.fast === '1';
    const { places, poiSource } = await buildRoute(
      locationInfo.city, latNum, lngNum, locationInfo.country, safeTheme, safeTransport, realPOIs, maxRouteDistance, candidateCount, fast, useGoogle
    );

    if (!places || places.length === 0) {
      // Nothing was found, so nothing paid for it: give the reservation back
      // instead of charging the daily cap for an empty answer.
      if (useGoogle) releaseBudget(COST_PER_TRIP_USD);
      return res.status(404).json({
        error: 'No hemos encontrado sitios que merezcan la pena por aquí. Prueba a ampliar la distancia o a buscar otro punto de partida.'
      });
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
    // Keep the detail in the logs. The client used to receive raw upstream URLs
    // and timeout numbers, and show them in a toast.
    console.error('[API] Error generating trip:', error);
    res.status(500).json({ error: 'No hemos podido generar la ruta. Vuelve a intentarlo en un momento.' });
  }
});

// Companion to /api/generate-trip?fast=1: the deck shows instantly without
// descriptions, then fetches them here in the background and merges them in.
app.post('/api/descriptions', async (req, res) => {
  try {
    const { places, city = '', country = '', theme = 'mixed' } = req.body || {};
    if (!Array.isArray(places) || places.length === 0) {
      return res.json({ descriptions: [] });
    }

    const VALID_THEMES = ['mixed', 'monuments', 'nature', 'food', 'historical', 'cultural', 'classic', 'surprise'];
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'mixed';
    const safeCity = String(city).slice(0, 80);
    const safe = places.slice(0, 12).map((p) => ({
      name: String(p?.name || '').slice(0, 120),
      type: String(p?.type || 'place').slice(0, 40),
      wikipedia: p?.wikipedia ? String(p.wikipedia).slice(0, 200) : null,
    }));

    // Three-tier description source, cheapest/most-trustworthy first:
    //   1. cache  2. verified Wikipedia extract (wiki-tagged POIs, free)
    //   3. LLM (cautious) for what's left — obscure POIs in small towns rarely
    //      have a Wikipedia article, and the per-type template alone reads as
    //      generic, so the LLM earns its keep here. Template only when the LLM
    //      is unavailable (no key / outage), so the key stays optional.
    const descriptions = new Array(safe.length);

    const afterCache = [];
    safe.forEach((p, i) => {
      const cached = getCachedDescription(p.name, safeCity, safeTheme);
      if (cached !== undefined) descriptions[i] = cached;
      else afterCache.push({ p, i });
    });

    // Tier 2: Wikipedia extract (parallel). Misses fall through to the LLM.
    const needLLM = [];
    await Promise.all(afterCache.map(async (m) => {
      const wiki = await raceTimeout(descriptionFromWikipedia(m.p), 4000);
      if (wiki) {
        descriptions[m.i] = wiki;
        setCachedDescription(m.p.name, safeCity, safeTheme, wiki);
      } else {
        needLLM.push(m);
      }
    }));

    // Tier 3: LLM in cautious mode (it only has name + type here). Pad each
    // index with the per-type template when the LLM has no key or returns short.
    if (needLLM.length > 0) {
      const llm = await getDescriptionsFromLLM(
        needLLM.map((m) => m.p),
        safeCity,
        String(country).slice(0, 80),
        safeTheme,
        { cautious: true }
      );
      needLLM.forEach((m, j) => {
        const real = llm && llm[j];
        descriptions[m.i] = real || fallbackDescription(m.p, safeCity);
        // Only cache genuine LLM output — never the generic template, so a
        // temporary outage doesn't poison the cache.
        if (real) setCachedDescription(m.p.name, safeCity, safeTheme, real);
      });
    }

    res.json({ descriptions });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    res.status(500).json({ error: 'Failed to generate descriptions' });
  }
});

// OpenRouteService profiles per transport mode. Primary router when
// ORS_API_KEY is set: a keyed account with a real quota (2.000 req/día gratis)
// and true foot/bike/car profiles, instead of community demo servers with no
// SLA. The profile must match the mode: routing a walk with the car profile
// follows one-way streets and multiplies a short stroll into many km.
const ORS_PROFILES = {
  driving: 'driving-car',
  walking: 'foot-walking',
  cycling: 'cycling-regular',
};

// Route via OpenRouteService. Returns the /api/route response shape, or null
// on any failure (no key, quota exhausted, point too far from a road) so the
// caller falls back to OSRM.
async function routeViaORS(coordsLngLat, mode) {
  const apiKey = process.env.ORS_API_KEY;
  const profile = ORS_PROFILES[mode];
  if (!apiKey || !profile) return null;
  try {
    const data = await fetchExternal(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        // radiuses -1 = unlimited snapping distance to the nearest routable
        // way. ORS defaults to ~350m per point, which breaks driving routes
        // that start on a plaza or pedestrian zone (e.g. Puerta del Sol):
        // there's no drivable street within 350m, ORS errors out and we'd
        // needlessly fall back to OSRM (which snaps without limit).
        body: JSON.stringify({
          coordinates: coordsLngLat,
          radiuses: coordsLngLat.map(() => -1),
        }),
      }
    );
    const feature = data?.features?.[0];
    const summary = feature?.properties?.summary;
    if (!feature?.geometry || !Number.isFinite(summary?.distance)) {
      console.warn(`[Route] ORS ${profile} returned no route (${data?.error?.message || 'unexpected response'})`);
      return null;
    }
    return {
      geometry: feature.geometry,
      distance: summary.distance,
      duration: summary.duration,
      legs: (feature.properties.segments || []).map(s => ({
        distance: s.distance,
        duration: s.duration,
      })),
    };
  } catch (error) {
    console.warn(`[Route] ORS ${profile} failed: ${error.message}`);
    return null;
  }
}

// Fallback OSRM demo servers per transport mode. The classic demo
// (router.project-osrm.org) only loads the car profile; FOSSGIS runs sibling
// instances with real foot/bike profiles — same API, same response shape.
const OSRM_SERVERS = {
  driving: 'https://router.project-osrm.org/route/v1/driving',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
};

// Get route via OpenRouteService, falling back to OSRM demos
app.get('/api/route', async (req, res) => {
  try {
    const { start, waypoints, mode = 'driving' } = req.query;

    if (!start || !waypoints) {
      return res.status(400).json({ error: 'Start and waypoints required' });
    }

    // The only endpoint taking coordinates that validated none of them: NaN went
    // straight through to the routers, and the waypoint list was unbounded, so a
    // single request could ask for a route through thousands of points. Verified
    // before this: 301 waypoints returned 200 with 49KB of geometry.
    const parsePoint = (raw) => {
      const parts = String(raw).split(',');
      if (parts.length !== 2) return null;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return [lng, lat]; // routers take lon,lat
    };

    const MAX_WAYPOINTS = 25; // the deck is capped at 12; this is generous
    const rawWaypoints = String(waypoints).split(';').filter(Boolean);
    if (rawWaypoints.length > MAX_WAYPOINTS) {
      return res.status(400).json({ error: `Demasiadas paradas (máximo ${MAX_WAYPOINTS})` });
    }

    const points = [start, ...rawWaypoints].map(parsePoint);
    if (points.some((p) => p === null)) {
      return res.status(400).json({ error: 'Coordenadas no válidas' });
    }
    const coordsLngLat = points;

    const ors = await routeViaORS(coordsLngLat, ORS_PROFILES[mode] ? mode : 'driving');
    if (ors) {
      return res.json({ ...ors, mode });
    }

    const osrmCoords = coordsLngLat.map(c => c.join(',')).join(';');
    const suffix = '?overview=full&geometries=geojson';
    let profileUsed = OSRM_SERVERS[mode] ? mode : 'driving';
    let data = null;
    try {
      data = await fetchExternal(`${OSRM_SERVERS[profileUsed]}/${osrmCoords}${suffix}`);
    } catch (_) { /* handled by the driving fallback below */ }

    // If the foot/bike instance is down, degrade to the car router rather
    // than failing: a detoured geometry beats no route at all.
    if ((!data || data.code !== 'Ok') && profileUsed !== 'driving') {
      console.warn(`[Route] ${profileUsed} OSRM failed (${(data && data.code) || 'network error'}), retrying with driving profile`);
      profileUsed = 'driving';
      data = await fetchExternal(`${OSRM_SERVERS.driving}/${osrmCoords}${suffix}`);
    }

    if (!data || data.code !== 'Ok') {
      return res.status(400).json({ error: 'No route found' });
    }

    const route = data.routes[0];
    let duration = route.duration;

    // Only on the driving fallback: car durations (and one-way detours) say
    // nothing about walking/cycling, so re-derive time from distance.
    const transportConfig = TRANSPORT_CONFIG[mode];
    if (profileUsed !== mode && transportConfig && transportConfig.speedKmh) {
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
      return res.status(503).json({ error: 'La búsqueda de restaurantes no está disponible ahora mismo' });
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

    // Restaurants genuinely need Google (there's no free substitute for ratings
    // and photos here), so this one still refuses — but only after reconciling,
    // so a dropped write can't lock the feature out for the rest of the day.
    if (!await tryReserveBudgetChecked(COST_PER_RESTAURANTS_USD)) {
      return budgetExceededResponse(res);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latNum},${lngNum}&radius=${radiusMeters}&type=restaurant&language=es&key=${apiKey}`;
    const data = await fetchExternal(url);

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places] Nearby status:', data.status, data.error_message);
      return res.status(502).json({ error: 'Google Places error: ' + data.status });
    }

    const results = Array.isArray(data.results) ? data.results : [];

    // Google matches type=restaurant against ANY of a place's types, so big
    // venues with food service inside (stadiums, hotels, malls…) sneak in.
    // If a result also carries one of these types, it's not a restaurant.
    const NON_RESTAURANT_TYPES = new Set([
      'stadium', 'lodging', 'shopping_mall', 'movie_theater', 'casino',
      'bowling_alley', 'amusement_park', 'night_club', 'gym',
      'department_store', 'supermarket', 'gas_station', 'tourist_attraction'
    ]);

    const ranked = results
      .filter(r => typeof r.rating === 'number' && (r.user_ratings_total || 0) >= 20)
      .filter(r => !(r.types || []).some(t => NON_RESTAURANT_TYPES.has(t)))
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
    const { city, country, origin_lat, origin_lng, theme, transport_mode, places, route_distance, route_duration, trip_type } = req.body;
    const safeType = trip_type === 'hiking' ? 'hiking' : 'route';

    const result = await query(
      `INSERT INTO trips (user_id, city, country, origin_lat, origin_lng, theme, transport_mode, places, route_distance, route_duration, trip_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        route_duration,
        safeType
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

// ========== SHARED ROUTES (public, no auth) ==========

// Whitelist-copy one place of a share payload. Anything not listed here never
// reaches the DB, and URLs must be http(s) so a share can't smuggle javascript:
// links into another visitor's browser.
function sanitizeSharedPlace(p) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : null);
  const httpUrl = (v, max) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v.slice(0, max) : null);
  const name = str(p.name, 160);
  if (!name) return null;
  return {
    name,
    lat,
    lng,
    type: str(p.type, 40) || 'place',
    description: str(p.description, 600),
    imageUrl: httpUrl(p.imageUrl, 600),
    rating: typeof p.rating === 'number' ? p.rating : null,
    userRatingsTotal: typeof p.userRatingsTotal === 'number' ? p.userRatingsTotal : null,
    website: httpUrl(p.website, 300),
    phone: str(p.phone, 40),
    openNow: typeof p.openNow === 'boolean' ? p.openNow : null,
    openingHours: Array.isArray(p.openingHours)
      ? p.openingHours.slice(0, 7).map((s) => String(s).slice(0, 120))
      : null,
    placeId: str(p.placeId, 160),
    wikipedia: str(p.wikipedia, 200),
    wikidata: str(p.wikidata, 40),
  };
}

const SHARE_SLUG_RE = /^[A-Za-z0-9_-]{4,16}$/;

async function getSharedTripCached(slug) {
  const cacheKey = `share:${slug}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached === '__none__' ? null : cached;
  const result = await query(
    `SELECT slug, city, country, transport, origin_lat, origin_lng, places,
            route_distance, route_duration, created_at
     FROM shared_trips WHERE slug = $1`,
    [slug]
  );
  const row = result.rows[0] || null;
  cacheSet(cacheKey, row || '__none__');
  return row;
}

// Create a share link for a built route. Public on purpose: sharing is the
// growth loop and must not require login.
app.post('/api/share', shareLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const originLat = Number(b.origin_lat);
    const originLng = Number(b.origin_lng);
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)
        || Math.abs(originLat) > 90 || Math.abs(originLng) > 180) {
      return res.status(400).json({ error: 'Origen inválido' });
    }
    const places = (Array.isArray(b.places) ? b.places : [])
      .map(sanitizeSharedPlace)
      .filter(Boolean)
      .slice(0, 15);
    if (places.length < 2) {
      return res.status(400).json({ error: 'La ruta necesita al menos 2 paradas' });
    }
    const transport = ['driving', 'walking', 'cycling'].includes(b.transport) ? b.transport : 'walking';
    const city = String(b.city || '').slice(0, 80);
    const country = String(b.country || '').slice(0, 80);
    const dist = Number.isFinite(Number(b.route_distance)) ? Number(b.route_distance) : null;
    const dur = Number.isFinite(Number(b.route_duration)) ? Number(b.route_duration) : null;

    // 48 random bits → collisions are ~impossible, but retry once anyway.
    let slug = null;
    for (let attempt = 0; attempt < 2 && !slug; attempt++) {
      const candidate = crypto.randomBytes(6).toString('base64url');
      try {
        await query(
          `INSERT INTO shared_trips
             (slug, city, country, transport, origin_lat, origin_lng, places, route_distance, route_duration)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [candidate, city, country, transport, originLat, originLng, JSON.stringify(places), dist, dur]
        );
        slug = candidate;
      } catch (e) {
        if (e.code !== '23505') throw e; // 23505 = unique_violation → retry
      }
    }
    if (!slug) throw new Error('Could not allocate a share slug');

    console.log(`[Share] Created /r/${slug} — ${city || 'sin ciudad'}, ${places.length} paradas`);
    res.json({ slug });
  } catch (error) {
    console.error('Error sharing trip:', error);
    res.status(500).json({ error: 'No se pudo crear el enlace' });
  }
});

app.get('/api/share/:slug', async (req, res) => {
  const slug = String(req.params.slug || '');
  if (!SHARE_SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Enlace no válido' });
  }
  try {
    const trip = await getSharedTripCached(slug);
    if (!trip) return res.status(404).json({ error: 'Esta ruta ya no está disponible' });
    res.json(trip);
  } catch (error) {
    console.error('Error fetching shared trip:', error);
    res.status(500).json({ error: 'No se pudo cargar la ruta' });
  }
});

// ---------------------------------------------------------------------------
// SEO: per-city landing pages, pre-generated variant pages + dynamic sitemap
// ---------------------------------------------------------------------------
const {
  SITE_ORIGIN,
  escapeHtml,
  PAGE_TYPES,
  PAGE_TYPE_BY_URL_SLUG,
  buildVariantHtml,
  injectSeoContent,
  assertIndexPatterns,
  getPublishedPage,
  listPublishedPages,
  buildSiblingLinks,
} = require('./seoPages');

// Published variant pages (slug+type+date), cached 10 min like everything else.
// Returns [] on DB hiccups so the hand-written city pages keep working.
async function getPublishedListCached() {
  const cached = cacheGet('seopages:published');
  if (cached) return cached;
  try {
    const list = await listPublishedPages();
    cacheSet('seopages:published', list);
    return list;
  } catch (err) {
    console.error('[SEO] Could not list published pages:', err.message);
    return [];
  }
}

const INDEX_HTML_PATH = path.join(clientDist, 'index.html');

function readIndexHtml() {
  return fs.readFileSync(INDEX_HTML_PATH, 'utf8');
}

// Activities affiliate for the /ciudad pages. Same provider priority as the
// client (services/affiliates.js): Civitatis → GetYourGuide. One value can
// serve both layers: the client reads the VITE_ name at build time and the
// server accepts either name at runtime (Render exposes the same env to
// both). With nothing configured, affiliate sections vanish.
const CIVITATIS_AID = process.env.CIVITATIS_AID || process.env.VITE_CIVITATIS_AID || '';
const GYG_PARTNER_ID = process.env.GYG_PARTNER_ID || process.env.VITE_GYG_PARTNER_ID || '';

function activityAffiliateLink(city) {
  if (CIVITATIS_AID) {
    return {
      provider: 'Civitatis',
      url: `https://www.civitatis.com/es/${city.slug}/?aid=${encodeURIComponent(CIVITATIS_AID)}`,
    };
  }
  if (GYG_PARTNER_ID) {
    // GYG city pages need internal location ids, so deep-link the search
    // page — any getyourguide.com URL with ?partner_id= attributes the sale.
    return {
      provider: 'GetYourGuide',
      url: `https://www.getyourguide.es/s/?q=${encodeURIComponent(city.name)}&partner_id=${encodeURIComponent(GYG_PARTNER_ID)}`,
    };
  }
  return null;
}

// Build the pre-rendered #seo-prerender block for a city landing page.
// publishedList feeds the "Más rutas" section linking this city's
// pre-generated variant pages (only the ones that passed the quality gates).
function buildCitySeoBlock(city, publishedList = []) {
  const items = city.highlights
    .map((h) => `        <li><strong>${escapeHtml(h.name)}:</strong> ${escapeHtml(h.blurb)}</li>`)
    .join('\n');
  const otherCities = CITIES.filter((c) => c.slug !== city.slug)
    .map((c) => `        <li><a href="/ciudad/${c.slug}">Qué visitar en ${escapeHtml(c.name)}</a></li>`)
    .join('\n');

  const variantLinks = publishedList
    .filter((p) => p.city_slug === city.slug && PAGE_TYPES[p.page_type])
    .map((p) => {
      const def = PAGE_TYPES[p.page_type];
      return `        <li><a href="/ciudad/${city.slug}/${def.urlSlug}">${escapeHtml(def.linkLabel(city))}</a></li>`;
    });
  const variantSection = variantLinks.length
    ? `
      <h2>Más rutas por ${escapeHtml(city.name)}</h2>
      <ul>
${variantLinks.join('\n')}
      </ul>
`
    : '';

  const aff = activityAffiliateLink(city);
  const activitiesSection = aff
    ? `
      <h2>Reserva actividades en ${escapeHtml(city.name)}</h2>
      <p>
        ¿Prefieres una visita con guía? Reserva
        <a href="${aff.url}" rel="sponsored noopener" target="_blank">tours, entradas y visitas guiadas
        en ${escapeHtml(city.name)}</a> con ${escapeHtml(aff.provider)} (enlace de afiliado).
      </p>
`
    : '';

  return `<div id="seo-prerender">
      <h1>Qué visitar en ${escapeHtml(city.name)}</h1>
      <p>${escapeHtml(city.intro)}</p>

      <h2>Lugares imprescindibles en ${escapeHtml(city.name)}</h2>
      <ul>
${items}
      </ul>
${variantSection}
      <h2>Genera tu ruta turística por ${escapeHtml(city.name)} con IA</h2>
      <p>
        RandomTrip crea un <strong>itinerario personalizado por ${escapeHtml(city.name)}</strong> en
        segundos: combina lugares reales de OpenStreetMap con descripciones escritas por
        inteligencia artificial y los ordena para recorrerlos a pie.
        Gratis y sin registro. <a href="/">Generar mi ruta por ${escapeHtml(city.name)}</a>.
      </p>
${activitiesSection}
      <h2>Rutas en otras ciudades</h2>
      <ul>
${otherCities}
      </ul>

      <p><noscript>Necesitas activar JavaScript para usar la aplicación interactiva.</noscript></p>
    </div>`;
}

// Render a full city page by injecting city-specific SEO into the built index.html.
function buildCityHtml(city, publishedList = []) {
  const url = `${SITE_ORIGIN}/ciudad/${city.slug}`;
  const title = `Qué visitar en ${city.name}: ruta turística con IA — RandomTrip`;
  const topNames = city.highlights.slice(0, 3).map((h) => h.name).join(', ');
  const desc = `Descubre qué visitar en ${city.name} y genera una ruta turística personalizada con IA: ${topNames} y más. Gratis y sin registro.`;

  let html = readIndexHtml();
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta name="description" content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: `Qué visitar en ${city.name}`, item: url },
    ],
  };
  html = html.replace(
    '</head>',
    `  <script type="application/ld+json">\n${JSON.stringify(breadcrumb)}\n  </script>\n</head>`
  );

  html = injectSeoContent(html, buildCitySeoBlock(city, publishedList), city);
  return html;
}

app.get('/ciudad/:slug', async (req, res, next) => {
  const city = CITY_BY_SLUG[req.params.slug];
  if (!city) return next(); // unknown city → fall through to SPA catch-all
  try {
    const publishedList = await getPublishedListCached();
    res.type('html').send(buildCityHtml(city, publishedList));
  } catch (err) {
    console.error('[ciudad] render failed:', err.message);
    next();
  }
});

// Pre-generated variant pages (e.g. /ciudad/toledo/senderos), served from the
// seo_pages table. Unknown variant slugs fall through to the SPA; a known
// variant without a published row returns an explicit 404 (never a soft-404)
// so Google doesn't index half-empty pages.
app.get('/ciudad/:slug/:variant', async (req, res, next) => {
  const city = CITY_BY_SLUG[req.params.slug];
  const pageType = PAGE_TYPE_BY_URL_SLUG[req.params.variant];
  if (!city || !pageType) return next();
  try {
    const cacheKey = `seopage:${city.slug}:${pageType}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.type('html').send(cached);

    const page = await getPublishedPage(city.slug, pageType);
    if (!page) return res.status(404).type('html').send(readIndexHtml());

    const publishedList = await getPublishedListCached();
    const links = buildSiblingLinks(city, pageType, publishedList);
    const html = buildVariantHtml(readIndexHtml(), city, page, links);
    cacheSet(cacheKey, html);
    res.type('html').send(html);
  } catch (err) {
    console.error('[ciudad/variant] render failed:', err.message);
    next();
  }
});

// Inject page-specific metadata into the built index.html. Same regexes the
// /ciudad pages rely on — assertIndexPatterns guards them at startup.
function applyMetaTags(html, { title, desc, url }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
    // Twitter reads its own tags and ignores og:* when they're present, so
    // leaving these at the template values made every shared page announce the
    // homepage.
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
}

// Shared route pages: the same SPA, but with the share's own title/description
// so a WhatsApp/Twitter preview says "Ruta a pie por Sevilla: 6 paradas"
// instead of the generic homepage blurb. Unknown/expired slugs fall through to
// the SPA, which shows its "ruta no disponible" state.
// Privacy and Terms as real, linkable URLs. They were modals only, which meant
// the policy had no address: it couldn't be linked from a post, and an affiliate
// programme's signup form asks for a public privacy-policy URL.
//
// The legal TEXT stays in the client (Footer.jsx) as the single source of truth —
// keeping a second server-side copy in sync is how legal pages end up
// contradicting each other. The server supplies the metadata and tells the app
// to render that document as a page instead of a modal.
const LEGAL_PAGES = {
  privacidad: {
    title: 'Política de Privacidad — RandomTrip',
    desc: 'Qué datos trata RandomTrip, con qué finalidad, qué terceros intervienen (Auth0, Google Places, Umami) y cómo ejercer tus derechos.',
  },
  terminos: {
    title: 'Términos de Uso — RandomTrip',
    desc: 'Condiciones de uso de RandomTrip: qué ofrece el servicio, tu responsabilidad al seguir una ruta a pie y los límites de responsabilidad.',
  },
};

app.get(['/privacidad', '/terminos'], (req, res) => {
  const key = req.path.replace(/^\//, '');
  const def = LEGAL_PAGES[key];
  const url = `${SITE_ORIGIN}/${key}`;
  const html = applyMetaTags(readIndexHtml(), { title: def.title, desc: def.desc, url })
    // The homepage's prerendered body is the wrong content for these pages.
    .replace(/<div id="seo-prerender">[\s\S]*?<\/div>/, '')
    .replace('</head>', `<script>window.__LEGAL__=${JSON.stringify(key)};</script>\n</head>`);
  res.type('html').send(html);
});

app.get('/r/:slug', async (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!SHARE_SLUG_RE.test(slug)) return next();
  try {
    const trip = await getSharedTripCached(slug);
    if (!trip) return next();
    const stops = Array.isArray(trip.places) ? trip.places : [];
    const names = stops.slice(0, 3).map((p) => p && p.name).filter(Boolean).join(', ');
    const modeLabel = trip.transport === 'cycling' ? 'en bici' : trip.transport === 'driving' ? 'en coche' : 'a pie';
    const title = `Ruta ${modeLabel} por ${trip.city || 'la zona'}: ${stops.length} paradas — RandomTrip`;
    const desc = `Ruta compartida por ${trip.city || 'la zona'}${names ? `: ${names} y más` : ''}. Ábrela en el mapa y empieza a caminar.`;
    // Shared routes are for the person who received the link, not for search.
    // They carry a self-referencing canonical and the homepage's prerendered
    // body, so left indexable they compete with the pages that are meant to
    // rank. `follow` keeps any link equity flowing to the home.
    const html = applyMetaTags(readIndexHtml(), { title, desc, url: `${SITE_ORIGIN}/r/${slug}` })
      .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex,follow" />');
    res.type('html').send(html);
  } catch (err) {
    console.error('[share page] render failed:', err.message);
    next();
  }
});

// Dynamic sitemap: hand-written city pages (cityData.js) + published
// pre-generated variant pages (seo_pages). Rejected variants never appear.
app.get('/sitemap.xml', async (req, res) => {
  const cachedXml = cacheGet('sitemap:xml');
  if (cachedXml) return res.type('application/xml').send(cachedXml);

  const publishedList = await getPublishedListCached();
  const urls = [
    { loc: `${SITE_ORIGIN}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${SITE_ORIGIN}/privacidad`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${SITE_ORIGIN}/terminos`, changefreq: 'yearly', priority: '0.2' },
    ...CITIES.map((c) => ({
      loc: `${SITE_ORIGIN}/ciudad/${c.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
    })),
    ...publishedList
      .filter((p) => PAGE_TYPES[p.page_type] && CITY_BY_SLUG[p.city_slug])
      .map((p) => ({
        loc: `${SITE_ORIGIN}/ciudad/${p.city_slug}/${PAGE_TYPES[p.page_type].urlSlug}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : null,
      })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  cacheSet('sitemap:xml', body);
  res.type('application/xml').send(body);
});

// SPA catch-all. Every route the app actually understands is handled above, so
// anything reaching here is a URL that doesn't exist — and answering 200 with the
// homepage made it a soft 404: /ciudad/pepito, /ciudad/lisboa and /privacidad all
// used to return the home with a canonical pointing at "/". Google can't classify
// those, and they clutter the coverage report.
//
// The one legitimate case is a client-side route the server doesn't know about,
// which today is only /r/<slug> — the share handler already answers for valid
// slugs, so an expired one lands here and the app shows its "ruta no disponible"
// state. That still isn't a page, so 404 is the honest answer there too.
const SPA_OK_PATHS = new Set(['/']);

app.get('*', (req, res) => {
  if (SPA_OK_PATHS.has(req.path)) return res.sendFile(INDEX_HTML_PATH);

  // 404 with the app shell so the visitor still gets a usable page, and a flag so
  // it can say so instead of silently pretending to be the homepage.
  let html;
  try {
    html = readIndexHtml();
  } catch (e) {
    return res.status(404).type('text').send('Not found');
  }
  html = html
    .replace(/<div id="seo-prerender">[\s\S]*?<\/div>/, '')
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex,follow" />')
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Esta página no existe — RandomTrip</title>')
    .replace('</head>', '<script>window.__NOTFOUND__=true;</script>\n</head>');
  res.status(404).type('html').send(html);
});

// Start server
async function startServer() {
  // There is no fallback build any more. `public/` used to hold the pre-React app
  // from March and was silently served whenever client/dist was missing, so a
  // failed build looked like a working site five months out of date. Say it
  // instead: `npm run build` is part of starting this app.
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error(`[FATAL] No existe ${INDEX_HTML_PATH}. Ejecuta \`npm run build\` antes de arrancar.`);
    process.exitCode = 1;
    return;
  }

  await initDatabase();
  await loadBudgetFromDb();

  // The SEO page builders inject metadata into index.html via regex
  // replacement. If the head markup changes shape, replacements silently
  // no-op and every /ciudad page ships with the homepage's title/canonical —
  // catch that here instead of in Search Console weeks later.
  try {
    const missing = assertIndexPatterns(readIndexHtml());
    if (missing.length) {
      console.error(`[SEO][ALERT] index.html ya no casa con los patrones: ${missing.join(', ')}. Las páginas /ciudad/* saldrán con metadatos del home hasta arreglarlo.`);
    }
  } catch (e) {
    console.warn('[SEO] No se pudo verificar index.html:', e.message);
  }

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

// Only listen when run directly (`node server.js`); requiring this module is
// side-effect-free so scripts/generateSeoPages.js can reuse the data pipeline.
if (require.main === module) {
  startServer();
}

module.exports = {
  getOverpassPOIs,
  getOverpassFoodPOIs,
  fetchHikingTrails,
  selectPOIsForTheme,
  sortByProximity,
  estimateRouteDistance,
  getDescriptionsFromLLM,
  fetchAllPOIImages,
  fetchExternal,
  parseLLMJsonSafe,
  salvageDescriptionsArray,
  // The SEO generator needs the same provider plumbing the app uses, instead of
  // reading NEBIUS_API_KEY on its own and pinning a model by hand.
  llmConfig,
  llmCandidates,
  callLLMOnce,
  googleNameMatchesPOI,
};
