# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start            # Start Express server (serves React build or public/ fallback)
npm run dev          # Same as start
npm run client:dev   # Start Vite dev server (port 5173, proxies /api to :3000)
npm run client:build # Build React app to client/dist/
```

Development workflow: run `npm start` in one terminal, `npm run client:dev` in another. Access via http://localhost:5173.

Production: run `npm run client:build`, then `npm start`. Access via http://localhost:3000.

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@host/dbname`)

Optional:
- `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` — any OpenAI-compatible chat-completions provider, used only to write place descriptions for POIs not covered by Wikipedia. Recommended: Google Gemini free tier (`LLM_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`). **Pin the model; do not use a `-latest` alias.** Gemini's free-tier quota is *per model* and the alias moves: `gemini-flash-latest` rolled onto `gemini-3.6-flash`, whose free tier is **20 requests a day**, so descriptions silently degraded to templates after twenty decks. Flash-Lite is the high-volume tier — `gemini-3.5-flash-lite` verified working 2026-08. The 2.5 family is listed by the models endpoint but answers "no longer available to new users". `LLM_FALLBACK_MODELS` (comma-separated) is tried in order on quota/rate-limit/retired-model errors, then legacy `NEBIUS_API_KEY` / `NEBIUS_API_BASE_URL` last — see `llmCandidates()`. Descriptions resolve in tiers: cache → Wikipedia extract → LLM → varied per-type templates, so **without any LLM key the app still works** (templates only).
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE` — enables Auth0 login (app works without these)
- `GOOGLE_PLACES_API_KEY` — enables Google photos/ratings/hours on POIs, the Restaurantes tab, and Google-quality city autocomplete (typo-tolerant, alt names); without it those degrade to Wikipedia images / 503 / Photon autocomplete
- `GOOGLE_PLACES_DAILY_BUDGET_USD` — daily in-memory spend cap for Google Places (default `6`)
- `ORS_API_KEY` — OpenRouteService key (free tier: 2000 directions/day); makes it the primary router for `/api/route`. Without it, routing falls back to community OSRM demo servers (no SLA)
- `OVERPASS_ENDPOINTS` — comma-separated Overpass instances in order of preference. Default:
  the main instance plus `overpass.openstreetmap.fr` as the hedge (measured 0.9–1.7s on the
  real POI query vs 2.8–8s and frequent 429s on the main one, which allows only 2 concurrent
  slots per IP — and Render's egress IP is shared)
- `CORS_ALLOWED_ORIGINS` — comma-separated allowed origins; unset means production + localhost
- `API_SPEND_SCOPE` — which `api_spend` row this process owns. **Set it to `local` when
  running locally**: the local `.env` points at the production database, so without it a dev
  run spends production's daily Google allowance
- `PORT` — defaults to `3000`

Client build-time (Vite, set in the build environment):
- `VITE_UMAMI_WEBSITE_ID` — enables Umami analytics (cookieless); without it analytics no-ops
- `VITE_UMAMI_SRC` — Umami script URL, defaults to `https://cloud.umami.is/script.js`
- `VITE_CIVITATIS_AID` — Civitatis affiliate id; enables the activities promo in the route view and on `/ciudad/*` SEO pages (the server also reads it, or `CIVITATIS_AID`, at runtime)
- `VITE_GYG_PARTNER_ID` — GetYourGuide partner id, same promo surfaces (server also reads `GYG_PARTNER_ID`). Provider priority when both are set: Civitatis → GetYourGuide. With neither, affiliate sections don't render

## Architecture

Express backend (`server.js`) + React frontend (`client/`) built with Vite.

### Frontend (client/src/)
React 19 + Vite. Component-based with Context API for state management.

**Key directories** (verified against the tree — the UI is the explore deck, not the
original planner form; there is no `components/trip/`, no theme or transport selector, and
no `constants/themes`):
- `context/` — TripContext (generation + route pipeline), RoutesContext (local-first saved
  routes), SavedContext, AuthContext, ThemeContext, ToastContext
- `components/explore/` — **the main interface**: ExploreMode (the overlay that owns the
  flow), ExploreDeck (full-screen swipeable cards), DeckPlaceCard, DeckRestaurantCard,
  ExploreMap, ExploreSheet (bottom sheet for the built route), RestaurantStrip, SaveHeart,
  ActivityPromo
- `components/hero/` — Hero (single CTA + "Restaurantes cerca" shortcut), CitySearch,
  CityPlanner, DistanceSlider, transportIcons
- `components/layout/` — Header, Footer (also holds the Privacy/Terms modals), BottomNav,
  TrustBand, Logo
- `components/saved/`, `components/trips/`, `components/profile/` — SavedView, SavedRoutes,
  ProfileView
- `components/carousel/` — InspirationCarousel (auto-scrolling infinite loop)
- `components/ui/` — Toast, Icon, ThemeToggle, ErrorBoundary
- `constants/` — transport, weather codes, inspiration examples, POI types
- `services/` — api.js (all fetch calls), trips.js (auth'd CRUD), analytics.js (Umami),
  affiliates.js

### Backend (server.js)
- Serves `client/dist/` (React build) if it exists, otherwise falls back to `public/`
- All API routes unchanged

### Request flow for trip generation
1. Frontend sends `GET /api/generate-trip?lat=&lng=&theme=&transport=&radius=`
2. Server reverse-geocodes via **Nominatim** (OpenStreetMap) → city name
3. Server fetches real POIs via **Overpass API** (OpenStreetMap) through `overpassQuery`,
   a hedged request across several instances (`OVERPASS_ENDPOINTS`): it fires the first and,
   if that hasn't answered in 2.5s, starts the next one alongside it and takes whichever
   replies. Two rules this code exists to enforce: `[timeout:N]` inside the query must stay
   GENEROUS (it's the point at which Overpass aborts our query and returns 504 — a low value
   manufactures the failure it looks like it prevents), and an upstream failure must never
   be flattened into an empty POI list. It throws `OverpassUnavailableError`, the handler
   answers 503, and stale cached POIs (6h TTL, 24h stale window) are served while an
   instance is down. Returning `[]` on failure is what made the app serve LLM-invented
   places for Madrid.
4. Server adds descriptions in tiers: **Wikipedia extract → LLM (Gemini/Nebius, OpenAI-compatible) → varied templates** (or a full LLM route if no Overpass data)
5. POIs sorted by nearest-neighbor algorithm, trimmed to fit max distance
6. Response includes `poiSource: 'overpass' | 'llm'` flag
7. Frontend calculates route via `GET /api/route` → **OpenRouteService** (fallback: OSRM demos)
8. Frontend fetches weather via **Open-Meteo** API (free, no key)
9. Frontend renders on **Leaflet** map (react-leaflet)
10. Trip auto-saved if user is authenticated

### Auth0 (optional)
- Backend: `express-oauth2-jwt-bearer` validates JWTs on `/api/trips` CRUD endpoints
- Frontend: `@auth0/auth0-spa-js` npm package, config fetched from `GET /api/auth-config`
- If Auth0 env vars not set, auth is disabled and my-trips section is hidden

### API endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Liveness probe (Render healthcheck) |
| GET | `/api/auth-config` | No | Auth0 config for frontend |
| GET | `/api/generate-trip` | No | Generate trip via Overpass + LLM |
| GET | `/api/route` | No | Get route via OpenRouteService (fallback: OSRM) |
| GET | `/api/search-city` | No | City autocomplete via Google Places (fallback: Photon/Komoot) |
| GET | `/api/resolve-city` | No | Resolve a Google autocomplete `placeId` to lat/lng |
| POST | `/api/descriptions` | No | Backfill LLM descriptions for a fast deck |
| GET | `/api/restaurants` | No | Nearby restaurants via Google Places |
| GET | `/api/hiking-trails` | No | OSM hiking routes near a point |
| GET | `/api/place-image` | No | Resolve a POI image (Google → Wikipedia), accepts optional `lat`/`lng` for geo-validation |
| POST | `/api/share` | No | Create a public share link for a route (rate-limited) |
| GET | `/api/share/:slug` | No | Fetch a shared route |
| POST | `/api/trips` | JWT | Save trip |
| GET | `/api/trips` | JWT | List user's trips |
| DELETE | `/api/trips/:id` | JWT | Delete trip (ownership verified) |

Shared routes are served as HTML at `/r/:slug` with per-route OG/meta tags injected into the built `index.html` (same pattern as `/ciudad/*` SEO pages). The frontend detects `/r/:slug` on load and opens the route view directly.

### Database (PostgreSQL via `pg`)
`trips` table: id (SERIAL PK), user_id (indexed), city, country, theme, transport_mode, origin_lat, origin_lng, places (JSON string), route_distance, route_duration, created_at. Connection via `DATABASE_URL` env var. SSL enabled in production.

### LLM prompt
Temperature 0.7 for descriptions, 0.85 for full routes. Random "variety seed" phrase from `VARIETY_SEEDS` array + theme-specific descriptions in `THEME_PROMPTS`. Dynamic radius hint based on user-selected max distance. Themes: classic, historical, gastro, cultural, nature, surprise.
