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
  sanitizeItems,
  validatePage,
} = require('../seoPages');
const {
  getOverpassPOIs,
  getOverpassFoodPOIs,
  fetchHikingTrails,
  sortByProximity,
  estimateRouteDistance,
  getDescriptionsFromLLM,
  fetchAllPOIImages,
  parseLLMJsonSafe,
  llmCandidates,
  callLLMOnce,
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
  // Not "señalizadas": that claim was ours, not the data's. OSM route=hiking
  // relations are usually signposted but nothing here proves it.
  senderos: (city) =>
    `las rutas de senderismo que rodean ${city.name} (${city.region})`,
};

async function getSeoIntroFromLLM(pageType, city, itemNames) {
  // Uses the app's configured providers (llmCandidates), not NEBIUS_API_KEY read
  // directly with the model pinned by hand. That older shape was a silent
  // landmine: the runtime moved to LLM_* (Gemini) while this still asked Nebius,
  // so the day that key lapses every page fails validation with `llm_failed`
  // and nothing says why.
  const candidates = llmCandidates();
  if (!candidates.length) {
    console.error('[Intro] Sin clave de LLM (LLM_API_KEY o NEBIUS_API_KEY): la página se rechazará por llm_failed.');
    return null;
  }

  const prompt = `Escribe el párrafo de apertura (2-3 frases, EN ESPAÑOL) de una página web sobre ${INTRO_BRIEFS[pageType](city)}.
Debe mencionar ${city.name} y citar de forma natural 2 o 3 de estos lugares reales: ${itemNames.slice(0, 5).join(', ')}.
Tono informativo y cercano, sin exclamaciones ni clichés de folleto turístico ("joya escondida", "rincón mágico", etc.).
NO inventes datos que no puedas verificar: ni siglos, ni años, ni estilos arquitectónicos, ni barrios o calles concretas, ni distancias, ni otras ciudades o monumentos que no estén en la lista.
NO digas por dónde empieza, por dónde termina ni en qué orden se recorren: esa lista no va en orden y cualquier afirmación sobre el recorrido sería falsa.
NO afirmes que los senderos están señalizados, ni describas el terreno o el paisaje: no tienes ese dato.
Devuelve un JSON: {"intro": "..."}`;

  // Same fallback chain the descriptions use: a page rejected as `llm_failed`
  // because one model ran out of daily quota is a page taken off the site.
  for (const { apiKey, apiBaseUrl, model } of candidates) {
    try {
      const content = await callLLMOnce(
        {
          model,
          messages: [
            { role: 'system', content: 'Eres un redactor de guías de viaje. Responde con JSON valido. Texto en español.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          // Nemotron burns completion tokens on hidden reasoning; leave room.
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        },
        apiBaseUrl,
        apiKey
      );
      const parsed = content ? parseLLMJsonSafe(content) : null;
      if (parsed && typeof parsed.intro === 'string' && parsed.intro.trim()) {
        return parsed.intro.trim();
      }
      console.error(`[Intro] Respuesta inservible de ${model}.`);
    } catch (e) {
      // callLLMOnce throws with the provider's own message, which is what tells
      // "quota exceeded" apart from "wrong model id".
      console.error(`[Intro] Falló ${model}:`, e.message);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-type content builders. Each returns { items, llmOk, totalDistanceM }.
// ---------------------------------------------------------------------------

// Deterministic notability ranking. These pages are static showcases titled
// "qué ver en X", so they must feature the landmarks, not whatever bust or
// neighborhood theater a random shuffle surfaces (downtown Madrid has 600+
// POIs and the app's randomized selectPOIsForTheme buried Plaza Mayor under
// minor memorials). A Wikipedia article is the strongest free notability
// signal OSM carries; major building types break the ties.
// MAX_PER_TYPE exists because pure scoring produced monotonous pages: Toledo's
// walk came out as six churches and a chapel out of eight stops. Ranking alone
// can't fix that — a city with forty churches will always have churches at the
// top — so the pick is capped per type and topped up afterwards if the cap left
// it short.
const MAX_PER_TYPE = 3;

function pickNotable(pois, count, maxPerType = MAX_PER_TYPE) {
  const TYPE_SCORE = {
    palace: 3, castle: 3, museum: 3, church: 2, historic: 2, market: 2,
    viewpoint: 2, plaza: 2, park: 2, monument: 1, garden: 1,
  };
  const scored = [...pois]
    .map((p) => ({ p, s: (p.wikipedia ? 4 : p.wikidata ? 1 : 0) + (TYPE_SCORE[p.type] || 1) }))
    .sort((a, b) => b.s - a.s);

  const perType = new Map();
  const picked = [];
  for (const { p } of scored) {
    if (picked.length >= count) break;
    const t = p.type || 'other';
    if ((perType.get(t) || 0) >= maxPerType) continue;
    perType.set(t, (perType.get(t) || 0) + 1);
    picked.push(p);
  }
  // Small towns may not have enough variety to fill the pool under the cap. Top
  // up only to the slack a page actually needs (5 to publish, a couple spare),
  // not all the way to `count` — padding back to a full pool with the same type
  // undid the cap entirely and the page came out monotonous anyway.
  const MIN_POOL = 7;
  if (picked.length < Math.min(count, MIN_POOL)) {
    for (const { p } of scored) {
      if (picked.length >= Math.min(count, MIN_POOL)) break;
      if (!picked.includes(p)) picked.push(p);
    }
  }
  return picked;
}

// A page needs 5 stops to publish, and the quality gates drop the ones whose
// description guessed something. Describing a wider pool costs tokens on one
// call, not extra calls, and it's what stops a single bad description from
// taking the whole page below the minimum.
const POOL_SIZE = 12;

async function buildWalkContent(city) {
  const pois = await getOverpassPOIs(city.lat, city.lng, 1200);
  await sleep(SLEEP_BETWEEN_CALLS);

  // notabilityRank is carried through so fitWalkBudget can keep the LANDMARKS
  // when it trims. Without it the trim kept whatever was nearest the centroid,
  // which is how a "que ver en Toledo" page ended up as six minor churches with
  // no cathedral: pickNotable ranked them correctly and then the proximity sort
  // plus a plain slice threw that ranking away.
  const notable = pickNotable(pois, POOL_SIZE).map((p, i) => ({ ...p, notabilityRank: i }));
  // Trimmed to the ~2h budget later, once the gates have had their say —
  // dropping a stop for a bad description and THEN fitting the route gives a
  // better page than fitting first and being left short.
  const selected = sortByProximity(notable, city.lat, city.lng);

  // cautious: even with notability ranking some stops are lesser-known —
  // better a sober description than an invented fact set in stone.
  const descriptions = await getDescriptionsFromLLM(selected, city.name, 'España', 'monuments', { cautious: true });
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
    // fetchAllPOIImages rebuilds the objects, so carry this over explicitly.
    notabilityRank: selected[i]?.notabilityRank ?? i,
  }));
  return {
    items,
    llmOk: Array.isArray(descriptions),
    totalDistanceM: Math.round(estimateRouteDistance(selected, city.lat, city.lng) * 1.4),
  };
}

// ~2h walking with stops ≈ 6 km of street distance (straight-line × 1.4). Run
// AFTER the gates, so the surviving stops are the ones that get fitted.
function fitWalkBudget(items, city, maxStops = 8, budgetM = 6000) {
  // Choose WHICH stops by notability, then order them by proximity so the walk
  // still flows, then drop from the far end until it fits the time budget.
  const byNotability = [...items].sort(
    (a, b) => (a.notabilityRank ?? 99) - (b.notabilityRank ?? 99)
  ).slice(0, maxStops);
  let kept = sortByProximity(byNotability, city.lat, city.lng);
  while (kept.length > 5 && estimateRouteDistance(kept, city.lat, city.lng) * 1.4 > budgetM) {
    kept = kept.slice(0, -1);
  }
  return {
    // notabilityRank is a working field, not page content.
    items: kept.map(({ notabilityRank, ...rest }) => rest),
    totalDistanceM: Math.round(estimateRouteDistance(kept, city.lat, city.lng) * 1.4),
  };
}

async function buildGastroContent(city) {
  const pois = await getOverpassFoodPOIs(city.lat, city.lng, 1500);
  await sleep(SLEEP_BETWEEN_CALLS);

  // getOverpassFoodPOIs already ranks markets first, then cuisine-tagged venues.
  const selected = sortByProximity(pois.slice(0, POOL_SIZE), city.lat, city.lng);
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
      // Who wrote it. The unverifiable-claim gates in validatePage only police
      // the model: a human mapper naming a hamlet or dating a chapel is fine.
      descSource: osmDesc ? 'osm' : 'llm',
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
        totalDistanceM = built.totalDistanceM;

        // Drop the stops we can't publish (a guessed neighbourhood, an invented
        // century, a description contradicting the OSM data, the same place
        // twice) BEFORE asking for the intro, so the intro never names a stop
        // that isn't on the page. The builders over-fetch precisely so there's
        // room to lose a few here.
        const sanitized = sanitizeItems(pageType, built.items, city.name);
        items = sanitized.items;
        if (sanitized.dropped.length) {
          console.log(
            `[gates] descartados ${sanitized.dropped.length}/${built.items.length}: ` +
              sanitized.dropped.map((d) => `${d.name} (${d.reason})`).join(', ')
          );
        }

        // Only now, with the surviving stops known, fit the walk to its 2h claim.
        if (pageType === 'paseo-2h') {
          const fitted = fitWalkBudget(items, city);
          if (fitted.items.length !== items.length) {
            console.log(`[ruta] recortada a ${fitted.items.length} paradas para caber en ~2 h`);
          }
          items = fitted.items;
          totalDistanceM = fitted.totalDistanceM;
        } else if (pageType === 'gastro') {
          items = items.slice(0, 8);
          totalDistanceM = Math.round(estimateRouteDistance(items, city.lat, city.lng) * 1.4);
        }

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
            `\n⚠ ${MAX_CONSECUTIVE_LLM_FAILURES} fallos de LLM seguidos — el proveedor configurado ` +
              '(LLM_API_KEY, o NEBIUS_API_KEY como fallback) parece sin cuota o caído; el mensaje de error de arriba lo dice. ' +
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

      // Never take a live page down to record a failure. upsertPage replaces the
      // row wholesale and server.js only serves status='published', so writing a
      // rejection over a published page would 404 a URL that was fine a minute
      // earlier — on a --force rerun that could be a dozen live URLs at once.
      const wouldUnpublish = status === 'rejected' && prior?.status === 'published';

      if (DRY_RUN) {
        console.log(`[dry-run] ${status}${reason ? ` (${reason})` : ''} — ${items.length} items, intro ${intro ? intro.length : 0} chars`);
        // A dry run exists to be read: show the text the gates judged, so a
        // rejection can be understood without a second run.
        if (intro) console.log(`  intro: ${intro}`);
        items.forEach((it) => console.log(`  · ${it.name}: ${it.description}`));
        if (wouldUnpublish) console.log('  (en real no se escribiría: se conservaría la versión publicada y la URL seguiría viva)');
      } else if (wouldUnpublish) {
        console.log(`✗ rechazada (${reason}) — se CONSERVA la versión publicada anterior, la URL sigue viva`);
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
