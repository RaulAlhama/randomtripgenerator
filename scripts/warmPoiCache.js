// Fills the persistent POI cache (poi_cache) for the request every city page
// makes: "Generar mi ruta por X" on /ciudad/:slug and "O genera otra ruta" on
// the 2-hour page both open the explore deck at the city's own coordinates.
// Almost every visitor arrives from Google on one of those pages, so these are
// the queries most worth having answered before Overpass is asked at all.
//
//   npm run poi:warm                 # every city (fresh rows are skipped)
//   npm run poi:warm -- --city leon  # one city
//
// Rows already fresh in the database cost nothing: getOverpassPOIs serves them
// without calling Overpass. Sequential with a pause, because the public
// instances are shared and often at capacity.

require('dotenv').config();
const { initDatabase, getPool } = require('../database');
const { CITIES } = require('../cityData');
const { getOverpassPOIs } = require('../server');

// Must produce the radius /api/generate-trip computes for the city CTA, or the
// cache key won't match: ExploreMode's EXPLORE_RADIUS_KM (2 km of walk) divided
// by the walking divisor in the handler (4.5).
const EXPLORE_ROUTE_M = 2000;
const WALKING_DIVISOR = 4.5;
const SEARCH_RADIUS_M = Math.round(EXPLORE_ROUTE_M / WALKING_DIVISOR);

// A batch job can wait for a slow instance; a person can't.
const PATIENT_OVERPASS = { attemptTimeoutMs: 30000, totalBudgetMs: 70000 };
const PAUSE_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const i = process.argv.indexOf('--city');
  const only = i !== -1 ? process.argv[i + 1] : null;
  const cities = only ? CITIES.filter((c) => c.slug === only) : CITIES;
  if (!cities.length) throw new Error(`No hay ninguna ciudad con slug "${only}"`);

  await initDatabase();
  const failed = [];
  for (const city of cities) {
    const started = Date.now();
    try {
      const pois = await getOverpassPOIs(city.lat, city.lng, SEARCH_RADIUS_M, { overpass: PATIENT_OVERPASS });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${city.slug}: ${pois.length} lugares (${secs}s)`);
      if (!pois.length) failed.push(city.slug);
    } catch (e) {
      console.log(`${city.slug}: FALLO — ${e.message}`);
      failed.push(city.slug);
    }
    // A fresh database row answers in milliseconds; only pause after real calls.
    if (Date.now() - started > 1000) await sleep(PAUSE_MS);
  }

  console.log(failed.length
    ? `\nSin caché: ${failed.join(', ')}. Vuelve a lanzarlo más tarde; las ya guardadas se saltan.`
    : `\nLas ${cities.length} ciudades tienen sus lugares guardados.`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(async () => { const pool = getPool(); if (pool) await pool.end(); });
