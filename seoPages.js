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
    // Not "señalizadas": OSM route=hiking relations are usually signposted but
    // nothing guarantees it, and the claim was coming from this template rather
    // than from any data we hold.
    title: (city) => `Senderos cerca de ${city.name}: rutas de senderismo — RandomTrip`,
    metaDescription: (city, items) => {
      const top = items.slice(0, 2).map((i) => i.name).join(' y ');
      // Only promise difficulty when OSM actually tagged it. sac_scale is rare,
      // and buildItemHtml omits it when missing, so this meta description used
      // to advertise a field that appeared in the body of none of the pages.
      const hasDifficulty = items.some((i) => i.sacScale && SAC_LABELS[i.sacScale]);
      const fields = hasDifficulty ? 'distancia, dificultad y descripción' : 'distancia y descripción';
      return `${items.length} rutas de senderismo cerca de ${city.name}, como ${top}. Con ${fields} de cada sendero.`;
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

// ---------------------------------------------------------------------------
// Unverifiable-claim gates. The gates above catch thin and boilerplate text;
// these catch text that reads well and is simply false.
//
// The model only writes descriptions for POIs it does not know (that is the
// whole point of the third tier), so anything it asserts beyond "what this is
// and why it's worth a stop" is a guess that gets published as fact. Real
// examples that shipped in 2026-06 and stayed live for two months:
//   "Mercado de San Fernando: En el barrio de Chamberi"      (it's Lavapies)
//   "Mercado de San Anton: En pleno corazon del barrio de Chamberi" (Chueca)
//   "Mercado de la Corredera: Ubicado en la zona de La Latina"  (Cordoba)
//   "El palacio art deco del Marques de Salamanca"           (1846, neoclassical)
//   "Cason del Buen Retiro, antiguo salon de baile del siglo XVIII" (1637)
// These are not verifiable from a name and a city, so the fix is to forbid the
// CLASS of claim rather than try to fact-check it.
//
// Applied only to model-written text. OSM `description` tags are written by
// human mappers and may legitimately date a building or name a hamlet, so
// items carrying descSource === 'osm' are exempt.

// Strips accents but keeps capitalisation, because capitalisation is the signal
// this gate runs on.
function deaccentKeepCase(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Asserting WHERE something is, and naming the place. The proper noun is the
// giveaway: the model cannot know a POI's neighbourhood from its name, and every
// error that shipped names one — "barrio de Chamberi", "zona de La Latina",
// "corazon del Born", "barrio de Poble Sec", "zona de Montjuic".
//
// Tuned empirically against the 254 published descriptions. Matching the WORD
// (barrio, zona, casco) instead of the pattern dropped 74 of them, most
// legitimately: "un mercado de barrio" is a type of market, "el casco antiguo"
// and "en pleno corazon de la ciudad" are generic prose, "zona de tapas" is a
// category. Those all survive now; the invented placements do not.
// The captured group is the place being named, so it can be compared against the
// item's own name: "Mercat del Fort Pienc" saying "en el barrio de Fort Pienc"
// is repeating itself, not guessing.
const LOCATION_CLAIM_RE = new RegExp([
  // "barrio de Chamberi", "distrito de Salamanca", "zona de La Latina"
  '\\b(?:barrio|barri|distrito|arrabal|zona)\\s+(?:de\\s+|del\\s+|d\')?(?:la\\s+|el\\s+|los\\s+|las\\s+)?([A-Z][A-Za-z]+)',
  // "en el corazon del Born", "en pleno corazon de Gracia"
  '\\bcorazon\\s+(?:de\\s+|del\\s+)(?:la\\s+|el\\s+)?([A-Z][A-Za-z]+)',
  // "a orillas del Manzanares"
  '\\ba\\s+orillas\\s+del?\\s+([A-Z][A-Za-z]+)',
].join('|'));

// A century or an architectural style: the two facts most often invented.
const PERIOD_STYLE_CLAIM_RE = /\bsiglo\s+[ivxlcdm]+\b|\bs\.\s*[ivxlcdm]+\b|\b(barroc[oa]|neoclasic[oa]|art\s?deco|modernist[ao]|gotic[oa]|renacentist[ao]|romanic[oa]|mudejar|plateresc[oa]|herrerian[oa]|churrigueresc[oa])\b/i;

// Returns a reason code, or null when nothing unverifiable is asserted.
// itemName matters: "Museu del Modernisme Catala" describing "el estilo
// modernista" is repeating its own name, not guessing a building's style.
function unverifiableClaim(text, itemName = '') {
  const nameNorm = normalizeText(itemName);

  // Case-sensitive on purpose: see LOCATION_CLAIM_RE.
  const place = LOCATION_CLAIM_RE.exec(deaccentKeepCase(text));
  if (place) {
    // Groups 1..3 are the three alternatives; only one ever matches.
    const named = place.slice(1).find(Boolean) || '';
    if (!nameNorm.includes(normalizeText(named))) return 'claim_location';
  }

  const t = normalizeText(text);
  const match = t.match(PERIOD_STYLE_CLAIM_RE);
  if (match) {
    const stem = match[0].slice(0, 7);
    if (!nameNorm.includes(stem)) return 'claim_period_style';
  }
  return null;
}

// English leaking into Spanish copy. Seen in a fresh generation: "que enamora a
// los visitantes por its beauty." Only function words and adjectives that have
// no Spanish homograph, so Basque/Catalan/Galician POI names stay safe.
const ENGLISH_LEAK_RE = /\b(the|its|and|with|from|this|these|those|which|where|their|there|about|through|beautiful|beauty|stunning|located|features|offers|visitors|stalls|crafts|vibe|building|church|museum|street|city)\b/i;

// Mechanical defects in the generated prose. Every one of these was found in
// the published pages, and none of them needs any knowledge of the world:
//   "narra laBarcelona"        two words fused, a lowercase letter then a capital
//   "en la La margen izquierda"  duplicated article
//   "de unos dos horas"        number/noun disagreement
//   "al Alhambra"              wrong gender on a known feminine name
const TEXT_DEFECTS = [
  ['duplicated_article', /\b(el|la|los|las)\s+(El|La|Los|Las)\b/],
  ['number_agreement', /\bunos\s+\S+\s+(horas|paradas|rutas|calles|plazas)\b/i],
  ['wrong_article', /\b(al|el)\s+(Alhambra|Canada|Acequia|Catedral|Iglesia|Plaza|Sierra|Via)\b/],
];

// Two words run together. Checked separately from the list above because
// venue names legitimately do this (CaixaForum, CosmoCaixa), so a hit is only
// a defect when the fused token isn't part of the place's own name.
const FUSED_WORDS_RE = /[A-Za-z]*[a-z][A-Z][A-Za-z]*/g;

// Claims about a route's shape or order. The intro is handed the stop names
// UNORDERED, so anything about where the walk starts or ends is false by
// construction, not by bad luck.
const ROUTE_ORDER_CLAIM_RE = /\b(?:termina|acaba|culmina|finaliza|arranca|comienza|empieza)\b(?:\s+\S+){0,3}\s+(?:en|con)\b/i;

function textDefect(text, itemName = '') {
  const raw = deaccentKeepCase(text);
  for (const [reason, re] of TEXT_DEFECTS) {
    if (re.test(raw)) return reason;
  }
  const nameRaw = deaccentKeepCase(itemName);
  for (const token of raw.match(FUSED_WORDS_RE) || []) {
    if (!nameRaw.includes(token)) return 'fused_words';
  }
  return null;
}

// Contradicts data we already hold from OSM. "Vuelta a Ulia (6,5 km - lineal):
// Un trazado circular" shipped with roundtrip=false and the prose saying the
// opposite, on the same line.
function contradictsTrailData(item) {
  const d = normalizeText(item.description);
  if (typeof item.roundtrip !== 'boolean') return null;
  const saysCircular = /\b(circular|en circuito)\b/.test(d) && !/\bno es circular\b/.test(d);
  const saysLinear = /\b(lineal|de ida y vuelta|no circular)\b/.test(d);
  if (saysCircular && !item.roundtrip) return 'contradiction_circular';
  if (saysLinear && item.roundtrip) return 'contradiction_linear';
  return null;
}

// Metres between two coordinates. Two stops on the same building are the same
// stop under two names — the Toledo page listed "Sinagoga del Transito" and
// "Museo Sefardi" as stops 6 and 7 of 8, which are one place.
function metersBetween(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// 40m also caught genuinely distinct neighbours (Museo de Bellas Artes and
// Museo de Julio Romero de Torres share a Cordoba square, 24m apart), so this
// is tuned to the pairs that really are one place under two names — the Toledo
// page's "Museo sefardi" and "Sinagoga del Transito" sit 22m apart.
const SAME_PLACE_METERS = 25;

// Words too common to prove two names are the same place. The city names are in
// here because otherwise "Museo de Malaga" and "Centro Pompidou Malaga" looked
// like one place: both reduce to ["malaga"] once the generic nouns are gone.
const NAME_STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'a', 'al', 'en', 'san', 'santa', 'santo',
  'mercado', 'mercat', 'museo', 'museu', 'iglesia', 'eliza', 'plaza', 'placa', 'palacio',
  'parque', 'jardin', 'puerta', 'calle', 'casa', 'centro', 'antiguo', 'antigua', 'nuestra',
  'senora', 'real', 'nacional', 'municipal', 'ruta', 'sendero', 'camino', 'via', 'gr', 'pr', 'sl',
  'etapa', 'tramo', 'variante', 'arte', 'bellas', 'artes', 'azoka', 'merkatua',
  ...Object.values(CITY_BY_SLUG).map((c) => normalizeText(c.name)).flatMap((n) => n.split(' ')),
]);

function nameCore(name) {
  return normalizeText(name)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !NAME_STOPWORDS.has(w));
}

// Digits in a name usually enumerate stages of one long route ("Camino de los
// Montes de Toledo - Etapa 1" / "Etapa 2"): same words, different walks.
function differentNumberedVariants(a, b) {
  const numsA = (String(a).match(/\d+/g) || []).join(',');
  const numsB = (String(b).match(/\d+/g) || []).join(',');
  return Boolean(numsA || numsB) && numsA !== numsB;
}

// Two names describing one place: every distinctive word of the shorter appears
// in the longer, and there are at least two of them.
function namesLookLikeSamePlace(a, b) {
  if (differentNumberedVariants(a, b)) return false;
  const coreA = nameCore(a);
  const coreB = nameCore(b);
  const shorter = coreA.length <= coreB.length ? coreA : coreB;
  const longer = coreA.length <= coreB.length ? coreB : coreA;
  if (shorter.length < 2) return false;
  return shorter.every((w) => longer.includes(w));
}

// Drops the items a page should not publish, instead of failing the whole page.
// Rejecting a page because one of eight descriptions guessed a neighbourhood
// throws away seven good ones and, at the measured rates (24% of descriptions
// asserted a zone, 12% a century or style), published nothing at all.
// Returns { items, dropped: [{ name, reason }] }.
function sanitizeItems(pageType, items, cityName) {
  const dropped = [];
  const otherCities = Object.values(CITY_BY_SLUG)
    .filter((c) => normalizeText(c.name) !== normalizeText(cityName))
    .map((c) => normalizeText(c.name));

  let kept = [];
  for (const item of items) {
    const desc = String(item.description || '').trim();
    // OSM `description` tags are written by human mappers: a mapper naming a
    // hamlet or dating a chapel is a fact, not a guess.
    const modelWritten = item.descSource !== 'osm';

    let reason = null;
    if (modelWritten) {
      if (ENGLISH_LEAK_RE.test(desc)) reason = 'not_spanish';
      if (!reason) reason = textDefect(desc, item.name);
      if (!reason) reason = unverifiableClaim(desc, item.name);
      if (!reason) {
        const nameNorm = normalizeText(item.name);
        const descNorm = normalizeText(desc);
        const stray = otherCities.find((c) => descNorm.includes(c) && !nameNorm.includes(c));
        if (stray) reason = 'claim_other_city';
      }
    }
    // Checked whoever wrote it: this one contradicts our own data.
    if (!reason && pageType === 'senderos') reason = contradictsTrailData(item);

    if (reason) dropped.push({ name: item.name, reason });
    else kept.push(item);
  }

  // Two stops on the same building are one stop. Keep the one OSM considers
  // more notable (a wikipedia tag), otherwise the first.
  const deduped = [];
  for (const item of kept) {
    const twin = deduped.find((other) =>
      (typeof item.lat === 'number' && typeof other.lat === 'number' &&
        metersBetween(item, other) < SAME_PLACE_METERS) ||
      namesLookLikeSamePlace(item.name, other.name)
    );
    if (!twin) { deduped.push(item); continue; }
    if (item.wikipedia && !twin.wikipedia) {
      deduped[deduped.indexOf(twin)] = item;
      dropped.push({ name: twin.name, reason: `duplicate_place:${item.name}` });
    } else {
      dropped.push({ name: item.name, reason: `duplicate_place:${twin.name}` });
    }
  }

  return { items: deduped, dropped };
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

  // Other cities we publish pages for. A description naming one of them, when
  // the item's own name doesn't, is describing somewhere else.
  const otherCities = Object.values(CITY_BY_SLUG)
    .filter((c) => normalizeText(c.name) !== normalizeText(cityName))
    .map((c) => normalizeText(c.name));

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

    // Backstop only. sanitizeItems should already have dropped these, so
    // reaching here means the generator skipped it — fail loudly rather than
    // publish. Same helpers, so the two can't drift apart.
    if (item.descSource !== 'osm') {
      if (ENGLISH_LEAK_RE.test(desc)) return { ok: false, reason: `not_spanish:${item.name}` };
      const claim = unverifiableClaim(desc, item.name);
      if (claim) return { ok: false, reason: `${claim}:${item.name}` };
      const nameNorm = normalizeText(item.name);
      const descNorm = normalizeText(desc);
      const stray = otherCities.find((c) => descNorm.includes(c) && !nameNorm.includes(c));
      if (stray) return { ok: false, reason: `claim_other_city:${item.name}` };
    }
    if (isTrailPage) {
      const contradiction = contradictsTrailData(item);
      if (contradiction) return { ok: false, reason: `${contradiction}:${item.name}` };
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const sameSpot =
        typeof a.lat === 'number' && typeof b.lat === 'number' &&
        metersBetween(a, b) < SAME_PLACE_METERS;
      if (sameSpot || namesLookLikeSamePlace(a.name, b.name)) {
        return { ok: false, reason: `duplicate_place:${a.name}|${b.name}` };
      }
    }
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
  // The intro is always model-written, and it's the first paragraph a reader and
  // a crawler see, so it gets the same treatment as the item descriptions. The
  // stop names are passed as context because the intro is explicitly asked to
  // cite them: "el barrio de las Letras" is a guess, but naming a stop that is
  // literally on the page is not.
  // The city's own name counts as known context: "en el corazon de Toledo" on
  // the Toledo page is not a guess.
  const introContext = [cityName, ...items.map((i) => i.name)].join(' ');
  const introClaim = unverifiableClaim(introTrimmed, introContext);
  if (introClaim) return { ok: false, reason: `intro_${introClaim}` };
  if (ENGLISH_LEAK_RE.test(introTrimmed)) return { ok: false, reason: 'intro_not_spanish' };
  const introDefect = textDefect(introTrimmed, introContext);
  if (introDefect) return { ok: false, reason: `intro_${introDefect}` };
  // Order claims are false by construction: the intro never sees the order.
  if (ROUTE_ORDER_CLAIM_RE.test(introTrimmed)) return { ok: false, reason: 'intro_route_order' };

  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// HTML builders — same index.html-injection technique as the /ciudad pages.
// ---------------------------------------------------------------------------

// "unas 2 horas" was hardcoded on every route page regardless of its length, so
// a 1.2 km stroll and a 6 km walk made the same promise. Walking pace ~4.5 km/h
// plus a short stop per stop, rounded to the half hour so it reads as an
// estimate and not a timetable.
function estimateWalkTime(distanceM, stopCount) {
  const walkMin = ((distanceM / 1000) / 4.5) * 60;
  const stopMin = Math.max(0, stopCount) * 8;
  const hours = (walkMin + stopMin) / 60;
  if (hours < 0.75) return 'unos 45 minutos';
  const rounded = Math.round(hours * 2) / 2;
  if (rounded === 1) return 'una hora';
  if (rounded === 1.5) return 'una hora y media';
  if (Number.isInteger(rounded)) return `unas ${rounded} horas`;
  return `unas ${Math.floor(rounded)} horas y media`;
}

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

  // The walk page's title, URL and intro all promise two hours, and the
  // generator now fits the route to that budget, so it states two hours rather
  // than a computed figure that could contradict its own headline. The gastro
  // page makes no duration claim of its own, so there the estimate is the only
  // number and it has to follow the actual distance.
  const duration = page.page_type === 'paseo-2h'
    ? 'unas 2 horas'
    : estimateWalkTime(page.total_distance_m, items.length);
  const distanceLine =
    page.page_type !== 'senderos' && page.total_distance_m
      ? `\n      <p>Recorrido estimado: ${formatKm(page.total_distance_m)} a pie, ${duration} con paradas incluidas.</p>`
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
        de partida u otra distancia—, RandomTrip lo genera en segundos con lugares
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
  // Twitter prefers its own tags over og:*, so without these a shared variant
  // page announced the homepage headline.
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);

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
    ['twitter:title', /<meta name="twitter:title" content="[^"]*"\s*\/>/],
    ['twitter:description', /<meta name="twitter:description" content="[^"]*"\s*\/>/],
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
  sanitizeItems,
  validatePage,
  buildVariantHtml,
  buildVariantSeoBlock,
  assertIndexPatterns,
  getPublishedPage,
  listPublishedPages,
  buildSiblingLinks,
};
