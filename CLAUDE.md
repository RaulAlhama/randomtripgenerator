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
- `NEBIUS_API_KEY` — Nebius AI API key (OpenAI-compatible endpoint, model: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`)
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@host/dbname`)

Optional:
- `NEBIUS_API_BASE_URL` — defaults to `https://api.tokenfactory.nebius.com/v1/`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE` — enables Auth0 login (app works without these)
- `GOOGLE_PLACES_API_KEY` — enables Google photos/ratings/hours on POIs and the Restaurantes tab; without it those degrade to Wikipedia images / 503
- `GOOGLE_PLACES_DAILY_BUDGET_USD` — daily in-memory spend cap for Google Places (default `6`)
- `PORT` — defaults to `3000`

Client build-time (Vite, set in the build environment):
- `VITE_UMAMI_WEBSITE_ID` — enables Umami analytics (cookieless); without it analytics no-ops
- `VITE_UMAMI_SRC` — Umami script URL, defaults to `https://cloud.umami.is/script.js`
- `VITE_CIVITATIS_AID` — Civitatis affiliate id; enables the activities promo in the route view and on `/ciudad/*` SEO pages (the server also reads it, or `CIVITATIS_AID`, at runtime). Without it, affiliate sections don't render

## Architecture

Express backend (`server.js`) + React frontend (`client/`) built with Vite.

### Frontend (client/src/)
React 19 + Vite. Component-based with Context API for state management.

**Key directories:**
- `context/` — AuthContext, TripContext, ToastContext (global state)
- `components/hero/` — LocationPicker, ThemeSelector, TransportSelector, DistanceSlider
- `components/trip/` — MapView (react-leaflet), PlacesPanel, WeatherWidget, RouteOverlay
- `components/carousel/` — InspirationCarousel (auto-scrolling infinite loop)
- `components/trips/` — MyTrips, TripCard (saved trips CRUD)
- `constants/` — themes, transport, weather codes, inspiration examples, POI types
- `services/` — api.js (all fetch calls), trips.js (auth'd CRUD)

### Backend (server.js)
- Serves `client/dist/` (React build) if it exists, otherwise falls back to `public/`
- All API routes unchanged

### Request flow for trip generation
1. Frontend sends `GET /api/generate-trip?lat=&lng=&theme=&transport=&radius=`
2. Server reverse-geocodes via **Nominatim** (OpenStreetMap) → city name
3. Server fetches real POIs via **Overpass API** (OpenStreetMap)
4. Server calls **Nebius AI** for descriptions (or full route if no Overpass data)
5. POIs sorted by nearest-neighbor algorithm, trimmed to fit max distance
6. Response includes `poiSource: 'overpass' | 'llm'` flag
7. Frontend calculates route via `GET /api/route` → **OSRM**
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
| GET | `/api/auth-config` | No | Auth0 config for frontend |
| GET | `/api/generate-trip` | No | Generate trip via Overpass + LLM |
| GET | `/api/route` | No | Get route via OSRM |
| GET | `/api/search-city` | No | Search cities via Photon (Komoot) |
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
