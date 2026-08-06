# RandomTrip

Genera una **ruta a pie por lugares reales** en cualquier ciudad del mundo, en segundos.
Dices desde dónde quieres explorar, la app te muestra los sitios de alrededor uno a uno,
quitas los que no te encajen y te devuelve el recorrido trazado sobre el mapa, ordenado
para no dar vueltas y listo para abrir en Google Maps.

**En producción: [randomtripgenerator.com](https://randomtripgenerator.com)** · gratis, sin registro, en español.

![RandomTrip](client/public/icons/og-default.png)

## Qué lo diferencia

Los sitios **no los elige un modelo de lenguaje**. Salen de OpenStreetMap y los ordena un
algoritmo, no una alucinación:

- **Los lugares son reales.** Vienen de OpenStreetMap vía Overpass, filtrados por tipo y
  ordenados por un criterio de notabilidad determinista (etiqueta `wikipedia`/`wikidata` +
  puntuación por tipo). El LLM solo **escribe las descripciones**, y únicamente para los
  POIs que no tienen artículo en Wikipedia.
- **La ruta es a pie de verdad.** OpenRouteService con perfil peatonal, no la distancia en
  línea recta ni un perfil de coche.
- **Degrada en vez de romperse.** Sin clave de LLM funciona con plantillas; sin Google
  Places funciona con imágenes de Wikipedia; si Overpass no responde lo dice en lugar de
  inventarse los sitios.
- **Páginas SEO pregeneradas.** 12 ciudades × 3 tipos de ruta, con contenido único
  persistido y controles de calidad antes de publicarse.

## Cómo funciona una petición

```
1. El navegador resuelve la posición (GPS) o el usuario busca una ciudad
     └─ Google Places Autocomplete (fallback: Photon/Komoot)
2. GET /api/generate-trip
     ├─ Nominatim ......... geocodificación inversa → nombre de ciudad
     ├─ Overpass .......... POIs reales de OpenStreetMap (petición cubierta
     │                      entre varias instancias, caché 6 h, ventana
     │                      rancia de 24 h si la instancia se cae)
     ├─ notabilidad ....... selección determinista + vecino más cercano
     ├─ Wikipedia ......... extracto e imagen (gratis, primero)
     ├─ LLM ............... descripción solo para lo que Wikipedia no cubre
     └─ Google Places ..... foto, valoración y horarios (con tope de gasto diario)
3. El usuario cura el mazo de tarjetas y pulsa "Crear ruta"
4. GET /api/route ........ OpenRouteService peatonal (fallback: OSRM demo)
5. Open-Meteo ............ meteorología del destino
6. Leaflet ............... mapa y trazado
```

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node ≥ 20, Express 4 (`server.js`) |
| Frontend | React 19 + Vite 6, Context API, react-leaflet |
| Base de datos | PostgreSQL (`pg`) — rutas guardadas, enlaces compartidos, páginas SEO, contador de gasto |
| Datos de lugares | OpenStreetMap (Overpass), Wikipedia/Wikimedia, Google Places |
| Rutas | OpenRouteService (fallback OSRM) |
| Meteorología | Open-Meteo |
| Autenticación | Auth0 (opcional) |
| Analítica | Umami (sin cookies) |

## Puesta en marcha

```bash
npm install
cp .env.example .env      # rellena al menos DATABASE_URL
npm start                 # API + build de React en http://localhost:3000
```

Para desarrollo del frontend, con recarga en caliente:

```bash
npm start                 # terminal 1 — API en :3000
npm run client:dev        # terminal 2 — Vite en :5173, proxy de /api a :3000
```

Producción local: `npm run client:build && npm start` → http://localhost:3000
(el servidor sirve `client/dist/` si existe).

### Scripts

| Script | Qué hace |
|---|---|
| `npm start` | Arranca el servidor Express |
| `npm run client:dev` | Servidor de desarrollo de Vite (:5173) |
| `npm run client:build` | Compila el frontend a `client/dist/` |
| `npm run build` | Lo que ejecuta Render: instala y compila el cliente |
| `npm run seo:generate` | Genera y publica las páginas SEO (Overpass + LLM, escribe en BD) |
| `npm run seo:status` | Estado de publicación de las páginas SEO |

## Variables de entorno

**Obligatoria:**

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |

**Opcionales** — la app arranca sin ninguna de ellas, con menos prestaciones:

| Variable | Sin ella |
|---|---|
| `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL` | Las descripciones usan plantillas variadas por tipo. Cualquier proveedor compatible con OpenAI; recomendado el tramo gratuito de Gemini. Los antiguos `NEBIUS_*` siguen valiendo como fallback |
| `GOOGLE_PLACES_API_KEY` | Sin fotos/valoraciones de Google (se usan las de Wikipedia), sin pestaña de Restaurantes, autocompletado con Photon |
| `GOOGLE_PLACES_DAILY_BUDGET_USD` | Tope de gasto diario estimado, por defecto `6`. Al alcanzarlo la app **degrada**, no bloquea |
| `ORS_API_KEY` | El cálculo de rutas cae a las instancias demo de OSRM, sin SLA |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE` | Login desactivado; las rutas se guardan solo en el dispositivo |
| `OVERPASS_ENDPOINTS` | Lista de instancias de Overpass separadas por comas. Por defecto usa la principal más `overpass.openstreetmap.fr` como cubierta |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos, separados por comas. Por defecto solo el dominio de producción y localhost |
| `API_SPEND_SCOPE` | Aísla el contador de gasto por entorno. **Ponlo a `local` en desarrollo**: el `.env` local puede apuntar a la misma base de datos que producción |
| `CIVITATIS_AID`, `GYG_PARTNER_ID` | No se renderiza la sección de actividades de afiliados |
| `PORT` | Por defecto `3000` |

**De compilación (Vite)** — deben existir al ejecutar `npm run build`, no en tiempo de ejecución:

| Variable | Sin ella |
|---|---|
| `VITE_UMAMI_WEBSITE_ID` | La analítica no hace nada |
| `VITE_UMAMI_SRC` | Por defecto `https://cloud.umami.is/script.js` |
| `VITE_CIVITATIS_AID`, `VITE_GYG_PARTNER_ID` | Sin secciones de afiliados en el cliente |

## API

| Método | Ruta | Auth | Para qué |
|---|---|---|---|
| GET | `/api/health` | — | Comprobación de vida |
| GET | `/api/auth-config` | — | Configuración de Auth0 para el frontend |
| GET | `/api/generate-trip` | — | Candidatos o ruta a partir de coordenadas |
| POST | `/api/descriptions` | — | Rellena descripciones de un mazo servido en modo rápido |
| GET | `/api/route` | — | Trazado peatonal entre paradas |
| GET | `/api/search-city` | — | Autocompletado de ciudades |
| GET | `/api/resolve-city` | — | Resuelve un `placeId` a coordenadas |
| GET | `/api/restaurants` | — | Restaurantes cercanos mejor valorados |
| GET | `/api/hiking-trails` | — | Rutas de senderismo de OSM cercanas |
| GET | `/api/place-image` | — | Resuelve la imagen de un lugar (Google → Wikipedia) |
| POST | `/api/share` | — | Crea un enlace público para una ruta |
| GET | `/api/share/:slug` | — | Recupera una ruta compartida |
| POST | `/api/trips` | JWT | Guarda una ruta |
| GET | `/api/trips` | JWT | Lista las rutas del usuario |
| DELETE | `/api/trips/:id` | JWT | Borra una ruta (comprueba propiedad) |

Páginas servidas desde el servidor, inyectando metadatos y contenido en el `index.html`
compilado: `/ciudad/:slug`, `/ciudad/:slug/:variante`, `/r/:slug` (rutas compartidas) y
`/sitemap.xml`, que se genera dinámicamente desde `cityData.js` y la tabla `seo_pages`.

## Estructura

```
server.js                 API, páginas SEO, sitemap, integraciones externas
database.js               Pool de PostgreSQL y creación de tablas
seoPages.js               Tipos de página SEO, controles de calidad, plantillas HTML
cityData.js               Contenido escrito a mano de las 12 ciudades
scripts/generateSeoPages.js   Generación offline de las páginas SEO
client/
  index.html              Plantilla + contenido pre-renderizado para buscadores
  src/
    components/explore/   Interfaz principal: mazo de tarjetas, mapa, hoja inferior
    components/hero/      Portada, buscador de ciudad, selector de distancia
    components/layout/    Cabecera, pie con textos legales, navegación inferior
    components/saved/ trips/ profile/   Rutas guardadas y cuenta
    components/ui/        Toast, iconos, tema, error boundary
    context/              Trip, Routes, Saved, Auth, Theme, Toast
    services/             api.js, trips.js, analytics.js, affiliates.js
```

## Despliegue

Desplegado en Render (Frankfurt) con PostgreSQL en Neon.

- Build: `npm install && npm run build`
- Start: `npm start`
- Healthcheck: `/api/health`

Las variables de entorno **se configuran a mano en el panel de Render**: el `render.yaml`
del repositorio documenta cuáles hacen falta, pero el servicio no está conectado como
blueprint, así que añadir una clave al yaml no surte efecto en producción.

## Licencia

Código propietario, todos los derechos reservados. El repositorio es público para que se
pueda leer y revisar, no como base para redistribución. Ver [LICENSE](LICENSE).
