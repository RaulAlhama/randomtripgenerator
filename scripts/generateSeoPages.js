// Pre-generates the programmatic SEO pages (seo_pages table) for every city
// in cityData.js × every page type in seoPages.js, using the same production
// pipeline as the interactive app (Overpass + Nebius). Run manually:
//
//   npm run seo:generate                  # all cities × all types
//   npm run seo:generate -- --city toledo # one city
//   npm run seo:generate -- --type gastro # one type
//   npm run seo:generate -- --dry-run     # no DB writes, print gate results
//   npm run seo:generate -- --force       # regenerate already-published rows
//   npm run seo:status                    # print current table state
//
// Published rows are skipped unless --force; rejected rows are always retried
// (they are never served, so retrying is risk-free). Runs sequentially with
// generous sleeps: Overpass is a shared free service and Nebius costs money.

require('dotenv').config();
const { initDatabase, query, getPool } = require('../database');
const { CITIES } = require('../cityData');
const {
  PAGE_TYPES,
  validatePage,
} = require('../seoPages');
const {
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
} = require('../server');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SLEEP_BETWEEN_CALLS = 3000;
const SLEEP_BETWEEN_PAGES = 8000;
const MAX_CONSECUTIVE_LLM_FAILURES = 3;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const STATUS_ONLY = flag('status');
const DRY_RUN = flag('dry-run');
const FORCE = flag('force');
const ONLY_CITY = opt('city');
const ONLY_TYPE = opt('type');

// ---------------------------------------------------------------------------
// LLM intro — one Nebius call per page asking for a unique opening paragraph
// that names the city and a few of the actual items. This is what makes each
// page's opening genuinely distinct (the de-indexing lesson: no boilerplate).
// ---------------------------------------------------------------------------
const INTRO_BRIEFS = {
  'paseo-2h': (city) =>
    `una ruta a pie de unas 2 horas por el centro de ${city.name} (${city.region})`,
  gastro: (city) =>
    `una ruta gastronómica a pie por ${city.name} (${city.region}): mercados, bares y locales con historia`,
  senderos: (city) =>
    `las rutas de senderismo señalizadas que rodean ${city.name} (${city.region})`,
};

async function getSeoIntroFromLLM(pageType, city, itemNames) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return null;
  const apiBaseUrl = (process.env.NEBIUS_API_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/').replace(/\/+$/, '');

  const prompt = `Escribe el párrafo de apertura (2-3 frases, EN ESPAÑOL) de una página web sobre ${INTRO_BRIEFS[pageType](city)}.
Debe mencionar ${city.name} y citar de forma natural 2 o 3 de estos lugares reales: ${itemNames.slice(0, 5).join(', ')}.
Tono informativo y cercano, sin exclamaciones ni clichés de folleto turístico ("joya escondida", "rincón mágico", etc.).
Devuelve un JSON: {"intro": "..."}`;

  try {
    const response = await fetchExternal(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
        messages: [
          { role: 'system', content: 'Eres un redactor de guías de viaje. Responde con JSON valido. Texto en español.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        // Nemotron burns completion tokens on hidden reasoning; leave room.
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });
    if (response.error || response.detail) {
      console.error('[Intro] Nebius error:', response.error?.message || response.detail);
      return null;
    }
    const content = response.choices?.[0]?.message?.content || '';
    const parsed = parseLLMJsonSafe(content);
    return parsed && typeof parsed.intro === 'string' ? parsed.intro.trim() : null;
  } catch (e) {
    console.error('[Intro] Failed:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-type content builders. Each returns { items, llmOk, totalDistanceM }.
// ---------------------------------------------------------------------------

// Prefer POIs the OSM community linked to Wikipedia/Wikidata — a strong
// notability signal. These pages are static showcases, so unlike the
// interactive app we want the famous places, not a fresh random mix.
function pickNotable(pois, theme, count) {
  const notable = pois.filter((p) => p.wikipedia || p.wikidata);
  const rest = pois.filter((p) => !p.wikipedia && !p.wikidata);
  const pool = notable.length >= count ? notable : [...notable, ...rest];
  return selectPOIsForTheme(pool, theme, count);
}

async function buildWalkContent(city) {
  const pois = await getOverpassPOIs(city.lat, city.lng, 1200);
  await sleep(SLEEP_BETWEEN_CALLS);

  let selected = sortByProximity(pickNotable(pois, 'monuments', 8), city.lat, city.lng);
  // ~2h walking with stops ≈ 6 km of street distance (straight-line × 1.4).
  while (selected.length > 5 && estimateRouteDistance(selected, city.lat, city.lng) * 1.4 > 6000) {
    selected = selected.slice(0, -1);
  }

  const descriptions = await getDescriptionsFromLLM(selected, city.name, 'España', 'monuments');
  await sleep(SLEEP_BETWEEN_CALLS);
  const withImages = await fetchAllPOIImages(selected, city.name);

  const items = withImages.map((p, i) => ({
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    description: (descriptions && descriptions[i]) || '',
    imageUrl: p.imageUrl || null,
    wikipedia: p.wikipedia || null,
  }));
  return {
    items,
    llmOk: Array.isArray(descriptions),
    totalDistanceM: Math.round(estimateRouteDistance(selected, city.lat, city.lng) * 1.4),
  };
}

async function buildGastroContent(city) {
  const pois = await getOverpassFoodPOIs(city.lat, city.lng, 1500);
  await sleep(SLEEP_BETWEEN_CALLS);

  // getOverpassFoodPOIs already ranks markets first, then cuisine-tagged venues.
  const selected = sortByProximity(pois.slice(0, 8), city.lat, city.lng);
  // cautious: the model doesn't actually know most local bars — don't let it
  // invent signature dishes or awards that end up published.
  const descriptions = await getDescriptionsFromLLM(selected, city.name, 'España', 'food', { cautious: true });

  const items = selected.map((p, i) => ({
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    description: (descriptions && descriptions[i]) || '',
    imageUrl: null,
    wikipedia: p.wikipedia || null,
  }));
  return {
    items,
    llmOk: Array.isArray(descriptions),
    totalDistanceM: Math.round(estimateRouteDistance(selected, city.lat, city.lng) * 1.4),
  };
}

async function buildTrailsContent(city) {
  const payload = await fetchHikingTrails(city.lat, city.lng, 25000);
  await sleep(SLEEP_BETWEEN_CALLS);

  // Day-hike material first: a "senderos cerca de X" reader wants local
  // routes, not the 1.000 km national caminos that happen to pass nearby.
  // Long-distance routes only fill in when there aren't enough local ones.
  const usable = (payload.trails || []).filter((t) => t.name && t.distance > 1000);
  const local = usable.filter((t) => t.distance <= 60000);
  const longDistance = usable.filter((t) => t.distance > 60000);
  const trails = [...local, ...longDistance].slice(0, 6);
  if (!trails.length) return { items: [], llmOk: true, totalDistanceM: null };

  // OSM description tag wins when substantial; LLM fills the gaps.
  const needLLM = trails.filter((t) => !(t.description && t.description.trim().length >= 60));
  let llmDescs = null;
  if (needLLM.length) {
    llmDescs = await getDescriptionsFromLLM(
      needLLM.map((t) => ({ name: t.name, type: 'sendero' })),
      city.name,
      'España',
      'nature',
      { cautious: true }
    );
  }

  let llmIdx = 0;
  const items = trails.map((t) => {
    const osmDesc = t.description && t.description.trim().length >= 60 ? t.description.trim() : null;
    const description = osmDesc || (llmDescs && llmDescs[llmIdx++]) || '';
    return {
      name: t.name,
      distanceM: t.distance,
      sacScale: t.sacScale || null,
      network: t.network || null,
      ref: t.ref || null,
      roundtrip: Boolean(t.roundtrip),
      description,
    };
  });
  return {
    items,
    llmOk: needLLM.length === 0 || Array.isArray(llmDescs),
    totalDistanceM: null,
  };
}

const CONTENT_BUILDERS = {
  'paseo-2h': buildWalkContent,
  gastro: buildGastroContent,
  senderos: buildTrailsContent,
};

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getExistingRows() {
  const r = await query('SELECT city_slug, page_type, status, intro FROM seo_pages');
  return r.rows;
}

async function upsertPage(row) {
  await query(
    `INSERT INTO seo_pages
       (city_slug, page_type, status, reject_reason, title, meta_description, intro, content, total_distance_m, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (city_slug, page_type) DO UPDATE SET
       status = EXCLUDED.status,
       reject_reason = EXCLUDED.reject_reason,
       title = EXCLUDED.title,
       meta_description = EXCLUDED.meta_description,
       intro = EXCLUDED.intro,
       content = EXCLUDED.content,
       total_distance_m = EXCLUDED.total_distance_m,
       updated_at = NOW()`,
    [
      row.citySlug,
      row.pageType,
      row.status,
      row.rejectReason,
      row.title,
      row.metaDescription,
      row.intro,
      JSON.stringify(row.items),
      row.totalDistanceM,
    ]
  );
}

async function printStatus() {
  const r = await query(
    `SELECT city_slug, page_type, status, reject_reason,
            jsonb_array_length(content) AS items, length(intro) AS intro_chars, updated_at
     FROM seo_pages ORDER BY city_slug, page_type`
  );
  if (!r.rows.length) {
    console.log('seo_pages está vacía. Ejecuta npm run seo:generate');
    return;
  }
  console.table(
    r.rows.map((row) => ({
      ciudad: row.city_slug,
      tipo: row.page_type,
      estado: row.status,
      motivo: row.reject_reason || '',
      items: row.items,
      intro: row.intro_chars || 0,
      actualizada: row.updated_at?.toISOString?.().slice(0, 16) || '',
    }))
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await initDatabase();

  if (STATUS_ONLY) {
    await printStatus();
    return;
  }

  const cities = ONLY_CITY ? CITIES.filter((c) => c.slug === ONLY_CITY) : CITIES;
  if (!cities.length) {
    console.error(`Ciudad desconocida: ${ONLY_CITY}. Slugs: ${CITIES.map((c) => c.slug).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const types = ONLY_TYPE ? [ONLY_TYPE] : Object.keys(PAGE_TYPES);
  if (ONLY_TYPE && !PAGE_TYPES[ONLY_TYPE]) {
    console.error(`Tipo desconocido: ${ONLY_TYPE}. Tipos: ${Object.keys(PAGE_TYPES).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const existing = await getExistingRows();
  const existingByKey = new Map(existing.map((r) => [`${r.city_slug}|${r.page_type}`, r]));

  const results = [];
  let consecutiveLLMFailures = 0;

  for (const city of cities) {
    for (const pageType of types) {
      const key = `${city.slug}|${pageType}`;
      const prior = existingByKey.get(key);
      if (prior?.status === 'published' && !FORCE) {
        results.push({ ciudad: city.slug, tipo: pageType, estado: 'skip (published)', motivo: '', items: '' });
        continue;
      }

      console.log(`\n=== ${city.name} · ${pageType} ===`);
      let status = 'rejected';
      let reason = null;
      let items = [];
      let intro = null;
      let totalDistanceM = null;

      try {
        const built = await CONTENT_BUILDERS[pageType](city);
        items = built.items;
        totalDistanceM = built.totalDistanceM;

        // Don't spend an intro call on pages that already failed on content.
        let llmOk = built.llmOk;
        if (llmOk && items.length) {
          await sleep(SLEEP_BETWEEN_CALLS);
          intro = await getSeoIntroFromLLM(pageType, city, items.map((i) => i.name));
          llmOk = llmOk && intro !== null;
        }

        const existingIntros = existing
          .filter((r) => !(r.city_slug === city.slug && r.page_type === pageType))
          .map((r) => r.intro)
          .filter(Boolean);

        const verdict = validatePage(pageType, {
          items,
          intro,
          llmOk,
          cityName: city.name,
          existingIntros,
        });
        status = verdict.ok ? 'published' : 'rejected';
        reason = verdict.reason;
      } catch (e) {
        reason = `error:${e.message}`;
        console.error(`[${city.slug}/${pageType}] Falló la generación:`, e.message);
      }

      if (reason === 'llm_failed') {
        consecutiveLLMFailures += 1;
        if (consecutiveLLMFailures >= MAX_CONSECUTIVE_LLM_FAILURES) {
          console.error(
            `\n⚠ ${MAX_CONSECUTIVE_LLM_FAILURES} fallos de LLM seguidos — Nebius parece sin crédito o caído. ` +
              'Abortando para no quemar cuota de Overpass. Vuelve a ejecutar más tarde: las páginas rechazadas se reintentan solas.'
          );
          results.push({ ciudad: city.slug, tipo: pageType, estado: 'abort', motivo: reason, items: items.length });
          break;
        }
      } else {
        consecutiveLLMFailures = 0;
      }

      const def = PAGE_TYPES[pageType];
      const row = {
        citySlug: city.slug,
        pageType,
        status,
        rejectReason: status === 'rejected' ? reason : null,
        title: def.title(city),
        metaDescription: items.length ? def.metaDescription(city, items) : null,
        intro,
        items,
        totalDistanceM,
      };

      if (DRY_RUN) {
        console.log(`[dry-run] ${status}${reason ? ` (${reason})` : ''} — ${items.length} items, intro ${intro ? intro.length : 0} chars`);
      } else {
        await upsertPage(row);
        console.log(`${status === 'published' ? '✓ publicada' : `✗ rechazada (${reason})`} — ${items.length} items`);
        // Keep the in-memory intro list current so duplicate detection works
        // within a single run, not only across runs.
        existingByKey.set(key, { city_slug: city.slug, page_type: pageType, status, intro });
        const idx = existing.findIndex((r) => r.city_slug === city.slug && r.page_type === pageType);
        if (idx === -1) existing.push({ city_slug: city.slug, page_type: pageType, status, intro });
        else existing[idx] = { city_slug: city.slug, page_type: pageType, status, intro };
      }

      results.push({ ciudad: city.slug, tipo: pageType, estado: status, motivo: reason || '', items: items.length });
      await sleep(SLEEP_BETWEEN_PAGES);
    }
    if (consecutiveLLMFailures >= MAX_CONSECUTIVE_LLM_FAILURES) break;
  }

  console.log('\nResumen:');
  console.table(results);
  const published = results.filter((r) => r.estado === 'published').length;
  console.log(`${published} publicadas de ${results.length} procesadas.${DRY_RUN ? ' (dry-run: sin escrituras)' : ''}`);
}

main()
  .catch((e) => {
    console.error('Fallo fatal:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    if (pool) await pool.end();
  });
