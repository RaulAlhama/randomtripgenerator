// Programmatic SEO pages: definitions, quality gates, HTML builders and DB
// accessors for the pre-generated /ciudad/:slug/:variant landing pages.
//
// The content of these pages is generated ONCE by scripts/generateSeoPages.js
// (Overpass POIs + Nebius descriptions), validated by the gates below and
// persisted in the seo_pages table. server.js only ever serves published rows.
// The site was once de-indexed by Google for thin/duplicated boilerplate, so
// every gate here exists to make that impossible to repeat: no fallback text,
// no near-duplicate descriptions, no template-only pages.

const { query } = require('./database');
const { CITY_BY_SLUG } = require('./cityData');

const SITE_ORIGIN = 'https://randomtripgenerator.com';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Page type definitions — single source of truth for URLs, titles and labels.
// ---------------------------------------------------------------------------

const PAGE_TYPES = {
  'paseo-2h': {
    urlSlug: 'en-2-horas-a-pie',
    ordered: true,
    h1: (city) => `Qué ver en ${city.name} en 2 horas a pie`,
    title: (city) => `Qué ver en ${city.name} en 2 horas a pie: ruta por el centro — RandomTrip`,
    metaDescription: (city, items) => {
      const top = items.slice(0, 3).map((i) => i.name).join(', ');
      return `Ruta a pie de unas 2 horas por ${city.name} con ${items.length} paradas reales: ${top} y más. Itinerario ordenado, gratis y sin registro.`;
    },
    listHeading: (city, items) => `Las ${items.length} paradas de la ruta`,
    linkLabel: (city) => `${city.name} en 2 horas a pie`,
    siblingHeading: 'Rutas de 2 horas en otras ciudades',
  },
  gastro: {
    urlSlug: 'ruta-gastronomica',
    ordered: true,
    h1: (city) => `Ruta gastronómica por ${city.name}`,
    title: (city) => `Ruta gastronómica por ${city.name}: mercados, bares y locales con solera — RandomTrip`,
    metaDescription: (city, items) => {
      const top = items.slice(0, 3).map((i) => i.name).join(', ');
      return `Ruta gastronómica a pie por ${city.name} con ${items.length} paradas: ${top} y más. Mercados y locales reales, ordenados para recorrerlos sin prisa.`;
    },
    listHeading: (city, items) => `Las paradas de la ruta gastronómica`,
    linkLabel: (city) => `Ruta gastronómica por ${city.name}`,
    siblingHeading: 'Rutas gastronómicas en otras ciudades',
  },
  senderos: {
    urlSlug: 'senderos',
    ordered: false,
    h1: (city) => `Senderos cerca de ${city.name}`,
    title: (city) => `Senderos cerca de ${city.name}: rutas de senderismo señalizadas — RandomTrip`,
    metaDescription: (city, items) => {
      const top = items.slice(0, 2).map((i) => i.name).join(' y ');
      return `${items.length} rutas de senderismo señalizadas cerca de ${city.name}, como ${top}. Con distancia, dificultad y descripción de cada sendero.`;
    },
    listHeading: (city) => `Rutas de senderismo cerca de ${city.name}`,
    linkLabel: (city) => `Senderos cerca de ${city.name}`,
    siblingHeading: 'Senderos en otras ciudades',
  },
};

const PAGE_TYPE_BY_URL_SLUG = Object.fromEntries(
  Object.entries(PAGE_TYPES).map(([key, def]) => [def.urlSlug, key])
);

const SAC_LABELS = {
  hiking: 'fácil',
  mountain_hiking: 'media',
  demanding_mountain_hiking: 'exigente',
  alpine_hiking: 'alpina',
  demanding_alpine_hiking: 'alpina exigente',
  difficult_alpine_hiking: 'alpina difícil',
};

function formatKm(meters) {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

// ---------------------------------------------------------------------------
// Quality gates — the generator publishes a page only if this passes.
// ---------------------------------------------------------------------------

// Distinctive tails of the fallbackDescription() templates in server.js.
// A description containing one means LLM output was silently replaced by
// boilerplate — exactly the thin content that got the site de-indexed.
// Matched on the tail (not the "Un mercado de..." opening) because the LLM
// legitimately writes openings like "Un mercado de San Fernando..." and a
// prefix match rejected those as false positives.
const GENERIC_DESC_RE = /(con encanto y siglos de historia|que destaca por su arquitectura y su valor historico|perfecto para descubrir el ambiente y los productos locales|ideal para un paseo tranquilo al aire libre|donde relajarse rodeado de naturaleza|un buen punto para hacer una pausa|parte de su vida cultural|bien valorado por los visitantes|que merece una parada en la ruta)/i;

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// items: content array for the page; intro: LLM-written opening paragraph;
// llmOk: whether getDescriptionsFromLLM returned a real array (vs null);
// existingIntros: intros already stored for OTHER pages (duplicate check).
function validatePage(pageType, { items, intro, llmOk, cityName, existingIntros = [] }) {
  const isTrailPage = pageType === 'senderos';

  if (!llmOk) return { ok: false, reason: 'llm_failed' };

  if (isTrailPage) {
    const longEnough = (items || []).filter((t) => t.name && t.distanceM > 1000);
    if (longEnough.length < 3) return { ok: false, reason: `trails_insufficient:${(items || []).length}` };
  } else {
    if (!items || items.length < 5) return { ok: false, reason: `overpass_insufficient:${(items || []).length}` };
  }

  const seenStarts = new Set();
  for (const item of items) {
    const desc = String(item.description || '').trim();
    if (desc.length < 60) return { ok: false, reason: `desc_too_short:${item.name}` };
    if (desc.length > 400) return { ok: false, reason: `desc_too_long:${item.name}` };
    if (normalizeText(desc) === normalizeText(item.name)) return { ok: false, reason: `desc_generic:${item.name}` };
    if (GENERIC_DESC_RE.test(normalizeText(desc))) return { ok: false, reason: `desc_generic:${item.name}` };
    const start = normalizeText(desc).slice(0, 40);
    if (seenStarts.has(start)) return { ok: false, reason: `desc_duplicate:${item.name}` };
    seenStarts.add(start);
  }

  const introTrimmed = String(intro || '').trim();
  if (introTrimmed.length < 150) return { ok: false, reason: 'intro_too_short' };
  if (!normalizeText(introTrimmed).includes(normalizeText(cityName))) {
    return { ok: false, reason: 'intro_missing_city' };
  }
  const introNorm = normalizeText(introTrimmed);
  if (existingIntros.some((other) => normalizeText(other) === introNorm)) {
    return { ok: false, reason: 'intro_duplicate' };
  }

  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// HTML builders — same index.html-injection technique as the /ciudad pages.
// ---------------------------------------------------------------------------

function buildItemHtml(pageType, item) {
  if (pageType === 'senderos') {
    const meta = [formatKm(item.distanceM)];
    if (item.sacScale && SAC_LABELS[item.sacScale]) meta.push(`dificultad ${SAC_LABELS[item.sacScale]}`);
    meta.push(item.roundtrip ? 'circular' : 'lineal');
    return `        <li><strong>${escapeHtml(item.name)}</strong> (${meta.join(' · ')}): ${escapeHtml(item.description)}</li>`;
  }
  return `        <li><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.description)}</li>`;
}

// links: { cityVariants: [{href,label}], siblingCities: [{href,label}] }
function buildVariantSeoBlock(city, page, links) {
  const def = PAGE_TYPES[page.page_type];
  const items = page.content;
  const tag = def.ordered ? 'ol' : 'ul';
  const itemsHtml = items.map((item) => buildItemHtml(page.page_type, item)).join('\n');

  const distanceLine =
    page.page_type !== 'senderos' && page.total_distance_m
      ? `\n      <p>Recorrido estimado: ${formatKm(page.total_distance_m)} a pie, unas 2 horas con paradas incluidas.</p>`
      : '';

  const cityLinks = [
    `        <li><a href="/ciudad/${city.slug}">Qué visitar en ${escapeHtml(city.name)}</a></li>`,
    ...links.cityVariants.map((l) => `        <li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`),
  ].join('\n');

  const siblingSection = links.siblingCities.length
    ? `
      <h2>${escapeHtml(def.siblingHeading)}</h2>
      <ul>
${links.siblingCities.map((l) => `        <li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join('\n')}
      </ul>`
    : '';

  return `<div id="seo-prerender">
      <h1>${escapeHtml(def.h1(city))}</h1>
      <p>${escapeHtml(page.intro)}</p>

      <h2>${escapeHtml(def.listHeading(city, items))}</h2>
      <${tag}>
${itemsHtml}
      </${tag}>${distanceLine}

      <h2>Genera tu propia ruta por ${escapeHtml(city.name)} con IA</h2>
      <p>
        Esta página recoge una selección fija. Si quieres un itinerario a tu medida —otro punto
        de partida, otra temática u otra distancia—, RandomTrip lo genera en segundos con lugares
        reales de OpenStreetMap. Gratis y sin registro.
        <a href="/">Generar mi ruta por ${escapeHtml(city.name)}</a>.
      </p>

      <h2>Más rutas por ${escapeHtml(city.name)}</h2>
      <ul>
${cityLinks}
      </ul>${siblingSection}

      <p><noscript>Necesitas activar JavaScript para usar la aplicación interactiva.</noscript></p>
    </div>`;
}

function buildVariantHtml(indexHtml, city, page, links) {
  const def = PAGE_TYPES[page.page_type];
  const url = `${SITE_ORIGIN}/ciudad/${city.slug}/${def.urlSlug}`;
  const title = page.title || def.title(city);
  const desc = page.meta_description || def.metaDescription(city, page.content);

  let html = indexHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta name="description" content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: `Qué visitar en ${city.name}`, item: `${SITE_ORIGIN}/ciudad/${city.slug}` },
      { '@type': 'ListItem', position: 3, name: def.h1(city), item: url },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: def.h1(city),
    numberOfItems: page.content.length,
    itemListOrder: def.ordered ? 'https://schema.org/ItemListOrderAscending' : 'https://schema.org/ItemListUnordered',
    itemListElement: page.content.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      description: item.description,
    })),
  };
  html = html.replace(
    '</head>',
    `  <script type="application/ld+json">\n${JSON.stringify(breadcrumb)}\n  </script>\n` +
      `  <script type="application/ld+json">\n${JSON.stringify(itemList)}\n  </script>\n</head>`
  );

  html = html.replace(/<div id="seo-prerender">[\s\S]*?<\/div>/, buildVariantSeoBlock(city, page, links));
  return html;
}

// The builders above rely on regex replacement against the built index.html.
// If the head markup changes shape, replacements silently no-op and pages ship
// with the homepage's title/canonical — a soft duplicate-content bug. Run this
// at server startup and log loudly if anything stops matching.
function assertIndexPatterns(indexHtml) {
  const patterns = [
    ['title', /<title>[\s\S]*?<\/title>/],
    ['meta description', /<meta name="description" content="[\s\S]*?"\s*\/>/],
    ['canonical', /<link rel="canonical" href="[^"]*"\s*\/>/],
    ['og:url', /<meta property="og:url" content="[^"]*"\s*\/>/],
    ['og:title', /<meta property="og:title" content="[^"]*"\s*\/>/],
    ['og:description', /<meta property="og:description" content="[^"]*"\s*\/>/],
    ['seo-prerender block', /<div id="seo-prerender">[\s\S]*?<\/div>/],
    ['head close', /<\/head>/],
  ];
  return patterns.filter(([, re]) => !re.test(indexHtml)).map(([name]) => name);
}

// ---------------------------------------------------------------------------
// DB accessors — only published rows are ever exposed.
// ---------------------------------------------------------------------------

async function getPublishedPage(citySlug, pageType) {
  const result = await query(
    `SELECT * FROM seo_pages WHERE city_slug = $1 AND page_type = $2 AND status = 'published'`,
    [citySlug, pageType]
  );
  return result.rows[0] || null;
}

async function listPublishedPages() {
  const result = await query(
    `SELECT city_slug, page_type, updated_at FROM seo_pages WHERE status = 'published' ORDER BY city_slug, page_type`
  );
  return result.rows;
}

// Internal links for a variant page: the city's other published variants plus
// up to 6 sibling cities with the same page type. Rotation starts right after
// the current city (alphabetical by slug) so link equity spreads evenly
// instead of every page pointing at the same few cities.
function buildSiblingLinks(city, pageType, publishedList) {
  const cityVariants = publishedList
    .filter((p) => p.city_slug === city.slug && p.page_type !== pageType && PAGE_TYPES[p.page_type])
    .map((p) => ({
      href: `/ciudad/${p.city_slug}/${PAGE_TYPES[p.page_type].urlSlug}`,
      label: PAGE_TYPES[p.page_type].linkLabel(city),
    }));

  const sameType = publishedList
    .filter((p) => p.page_type === pageType && p.city_slug !== city.slug && CITY_BY_SLUG[p.city_slug])
    .sort((a, b) => a.city_slug.localeCompare(b.city_slug));
  const startIdx = sameType.findIndex((p) => p.city_slug.localeCompare(city.slug) > 0);
  const rotated = startIdx === -1 ? sameType : [...sameType.slice(startIdx), ...sameType.slice(0, startIdx)];
  const siblingCities = rotated.slice(0, 6).map((p) => ({
    href: `/ciudad/${p.city_slug}/${PAGE_TYPES[pageType].urlSlug}`,
    label: PAGE_TYPES[pageType].linkLabel(CITY_BY_SLUG[p.city_slug]),
  }));

  return { cityVariants, siblingCities };
}

module.exports = {
  SITE_ORIGIN,
  escapeHtml,
  PAGE_TYPES,
  PAGE_TYPE_BY_URL_SLUG,
  validatePage,
  buildVariantHtml,
  buildVariantSeoBlock,
  assertIndexPatterns,
  getPublishedPage,
  listPublishedPages,
  buildSiblingLinks,
};
