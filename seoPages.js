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
};

const PAGE_TYPE_BY_URL_SLUG = Object.fromEntries(
  Object.entries(PAGE_TYPES).map(([key, def]) => [def.urlSlug, key])
);

// Variant URLs that existed and no longer do, mapped to where they now send the
// reader (301). /ciudad/*/senderos outlived the app's hiking feature: the tab
// went in 2026-06, but the twelve pages stayed published until 2026-11,
// promising trails to a visitor whose "Genera tu propia ruta" button opened an
// app with none. They earned 4 clicks in 16 months. The 2-hour walk page is the
// closest thing the city still has, and every city that had trails has one.
const RETIRED_URL_SLUGS = {
  senderos: 'en-2-horas-a-pie',
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
// Every description these gates see is model-written. The trail pages were the
// only ones carrying human-written OSM text, and they are gone.

// Strips accents but keeps capitalisation, because capitalisation is the signal
// this gate runs on.
function deaccentKeepCase(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Whether `text` names `cityName` as a place. Whole-word and case-sensitive on
// purpose: several cities we publish are also Spanish words, or the inside of
// one — "la cuenca del Ebro", "una ronda de vinos", "las palmeras", "Napoleón" —
// and the lowercase substring match this replaced would have read each of those
// as a description wandering off to Cuenca, Ronda, Palma or León. A city named
// as a place is capitalised; that is what this keys on.
function namesCity(text, cityName) {
  const name = deaccentKeepCase(cityName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z])${name}(?![A-Za-z])`).test(deaccentKeepCase(text));
}

// Another published city that a description names when the item's own name
// doesn't ("Puerta de Toledo" in Madrid may say Toledo). A description naming
// somewhere else is describing somewhere else. Returns the city or null.
function strayCity(description, itemName, cityName) {
  const nameNorm = normalizeText(itemName);
  return Object.values(CITY_BY_SLUG).find((c) =>
    normalizeText(c.name) !== normalizeText(cityName) &&
    namesCity(description, c.name) &&
    !nameNorm.includes(normalizeText(c.name))
  ) || null;
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

// A place's own name is not a leak. Outside Spain names carry these words all
// the time: Berlin's page was rejected for citing its "Neues Museum", and
// London has a "Royal Academy of Arts". The names are taken out before looking.
function leaksEnglish(text, names = []) {
  let rest = String(text || '');
  for (const name of names) {
    if (name) rest = rest.split(name).join(' ');
  }
  return ENGLISH_LEAK_RE.test(rest);
}

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

// The rule above needs two shared distinctive words, and some places only have
// one: "Museo Nacional de Escultura" and "Museo de Escultura Colegio de San
// Gregorio" are one museum under two OSM records, 102 m apart, and Valladolid's
// page listed them as consecutive stops. One shared word is weak evidence on its
// own, so it also takes being next door. Two names of two words each ("Catedral
// Vieja", "Catedral Nueva") never reach this rule.
const ONE_WORD_TWIN_METERS = 120;

function oneWordTwins(a, b) {
  const coreA = nameCore(a.name);
  const coreB = nameCore(b.name);
  const [shorter, longer] = coreA.length <= coreB.length ? [coreA, coreB] : [coreB, coreA];
  return shorter.length === 1 && longer.includes(shorter[0]) &&
    typeof a.lat === 'number' && typeof b.lat === 'number' &&
    metersBetween(a, b) < ONE_WORD_TWIN_METERS;
}

function samePlace(a, b) {
  return (typeof a.lat === 'number' && typeof b.lat === 'number' && metersBetween(a, b) < SAME_PLACE_METERS) ||
    namesLookLikeSamePlace(a.name, b.name) ||
    oneWordTwins(a, b);
}

// Drops the items a page should not publish, instead of failing the whole page.
// Rejecting a page because one of eight descriptions guessed a neighbourhood
// throws away seven good ones and, at the measured rates (24% of descriptions
// asserted a zone, 12% a century or style), published nothing at all.
// Returns { items, dropped: [{ name, reason }] }.
function sanitizeItems(pageType, items, cityName) {
  const dropped = [];

  let kept = [];
  for (const item of items) {
    const desc = String(item.description || '').trim();

    let reason = null;
    if (leaksEnglish(desc, [item.name])) reason = 'not_spanish';
    if (!reason) reason = textDefect(desc, item.name);
    if (!reason) reason = unverifiableClaim(desc, item.name);
    if (!reason && strayCity(desc, item.name, cityName)) reason = 'claim_other_city';

    if (reason) dropped.push({ name: item.name, reason });
    else kept.push(item);
  }

  // Two stops on the same building are one stop. Keep the one OSM considers
  // more notable (a wikipedia tag), otherwise the first.
  const deduped = [];
  for (const item of kept) {
    const twin = deduped.find((other) => samePlace(item, other));
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
  if (!llmOk) return { ok: false, reason: 'llm_failed' };

  if (!items || items.length < 5) return { ok: false, reason: `overpass_insufficient:${(items || []).length}` };

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
    if (leaksEnglish(desc, [item.name])) return { ok: false, reason: `not_spanish:${item.name}` };
    const claim = unverifiableClaim(desc, item.name);
    if (claim) return { ok: false, reason: `${claim}:${item.name}` };
    if (strayCity(desc, item.name, cityName)) return { ok: false, reason: `claim_other_city:${item.name}` };
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (samePlace(a, b)) {
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
  if (leaksEnglish(introTrimmed, items.map((i) => i.name))) return { ok: false, reason: 'intro_not_spanish' };
  const introDefect = textDefect(introTrimmed, introContext);
  if (introDefect) return { ok: false, reason: `intro_${introDefect}` };
  // Order claims are false by construction: the intro never sees the order.
  if (ROUTE_ORDER_CLAIM_RE.test(introTrimmed)) return { ok: false, reason: 'intro_route_order' };

  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// Activities affiliate, for the city pages AND the 2-hour pages. It used to
// live in server.js and only the city landing page used it, while the 2-hour
// pages — where 57% of search clicks land — had none.
//
// Same provider priority as the client (services/affiliates.js): Civitatis →
// GetYourGuide. One value can serve both layers: the client reads the VITE_
// name at build time and the server accepts either name at runtime (Render
// exposes the same env to both). With nothing configured, the section vanishes.
// ---------------------------------------------------------------------------

const AFFILIATE_IDS = {
  civitatis: process.env.CIVITATIS_AID || process.env.VITE_CIVITATIS_AID || '',
  gyg: process.env.GYG_PARTNER_ID || process.env.VITE_GYG_PARTNER_ID || '',
};

// ids is a parameter so tests can exercise a configured provider.
function activityAffiliateLink(city, ids = AFFILIATE_IDS) {
  if (ids.civitatis) {
    // Checked against civitatis.com for every city: 26 slugs match ours, and
    // the two that don't (Girona, Palma) redirect to the homepage, so cityData
    // carries Civitatis' own slug for those.
    return {
      provider: 'Civitatis',
      url: `https://www.civitatis.com/es/${city.civitatisSlug || city.slug}/?aid=${encodeURIComponent(ids.civitatis)}`,
    };
  }
  if (ids.gyg) {
    // GYG city pages need internal location ids, so deep-link the search
    // page — any getyourguide.com URL with ?partner_id= attributes the sale.
    return {
      provider: 'GetYourGuide',
      url: `https://www.getyourguide.es/s/?q=${encodeURIComponent(city.name)}&partner_id=${encodeURIComponent(ids.gyg)}`,
    };
  }
  return null;
}

// The data-umami-event attributes are how a server-rendered link gets tracked:
// Umami's script records clicks on them without any JS of ours, which matters
// because this markup is adopted into React as inert HTML.
function activitiesSectionHtml(city, placement, ids = AFFILIATE_IDS) {
  const aff = activityAffiliateLink(city, ids);
  if (!aff) return '';
  return `
      <h2>Reserva actividades en ${escapeHtml(city.name)}</h2>
      <p>
        ¿Prefieres una visita con guía? Reserva
        <a href="${escapeHtml(aff.url)}" rel="sponsored noopener" target="_blank"
          data-umami-event="activities_clicked" data-umami-event-provider="${escapeHtml(aff.provider)}"
          data-umami-event-placement="${escapeHtml(placement)}" data-umami-event-city="${escapeHtml(city.name)}">tours, entradas y visitas guiadas
        en ${escapeHtml(city.name)}</a> con ${escapeHtml(aff.provider)} (enlace de afiliado).
      </p>
`;
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

// ---------------------------------------------------------------------------
// Practical detail for the 2-hour pages, computed from what the page stores.
//
// These pages sat at positions 12-16 for the big cities with ~300 words of
// description and nothing a walker could use. Everything added here is
// arithmetic on the stops' coordinates or a restatement of how the two hours
// are budgeted: no opening hours, no prices, no "worth going inside", because
// nothing in the stored data can back those up and this site has already
// published invented facts once.
// ---------------------------------------------------------------------------

// Straight line to street distance: the same factor the generator applies to
// total_distance_m, so the legs and the page's total tell one story.
const STREET_FACTOR = 1.4;
const WALK_M_PER_MIN = 75; // 4.5 km/h, as in estimateWalkTime

const hasCoords = (s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lng);

function walkMinutes(meters) {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

// "350 m" below a kilometre, "1,2 km" from there on.
function formatWalkDistance(meters) {
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return formatKm(meters);
}

// Distance from each stop to the one before it; null for the first stop and
// for any pair missing coordinates.
function walkLegs(items) {
  return items.map((item, i) => {
    const prev = items[i - 1];
    if (!prev || !hasCoords(prev) || !hasCoords(item)) return null;
    const meters = metersBetween(prev, item) * STREET_FACTOR;
    return { from: prev.name, to: item.name, meters, minutes: walkMinutes(meters) };
  });
}

// Always the Spanish article: the server resolves the stop's `wikipedia` tag
// (which may name any language) to its Spanish title before it gets here.
function spanishArticleUrl(title) {
  const t = String(title || '').trim();
  return t ? `https://es.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}` : null;
}

// Questions a person planning this walk actually has, answered only from the
// route's own numbers. Returns [] when the page lacks what an answer needs.
function walkFaq(city, page) {
  const items = (page.content || []).filter(hasCoords);
  const total = page.total_distance_m;
  if (page.page_type !== 'paseo-2h' || items.length < 2 || !total) return [];

  const faq = [];
  const walking = walkMinutes(total);
  const perStop = Math.floor((120 - walking) / items.length);
  faq.push({
    q: `¿Cuánto se tarda en hacer esta ruta por ${city.name}?`,
    a: `Son ${formatKm(total)} a pie, unos ${walking} minutos andando sin detenerse.` +
      (perStop >= 3
        ? ` El resto hasta las 2 horas se reparte entre las ${items.length} paradas: unos ${perStop} minutos en cada una, lo justo para verla por fuera y hacer fotos.`
        : ''),
  });

  const first = items[0];
  const last = items[items.length - 1];
  const back = metersBetween(first, last) * STREET_FACTOR;
  faq.push({
    q: '¿Dónde empieza y dónde termina?',
    a: `La primera parada es ${first.name} y la última, ${last.name}. El final queda a unos ${formatWalkDistance(back)} del punto de partida (unos ${walkMinutes(back)} minutos andando), por si tienes que volver.`,
  });

  faq.push({
    q: '¿Da tiempo a entrar en los monumentos y museos?',
    a: 'No dentro de las 2 horas: el tiempo está calculado para ver cada parada por fuera. Si quieres entrar en alguna, resérvale tiempo aparte o genera una ruta con menos paradas.',
  });

  const legs = walkLegs(items).filter(Boolean);
  if (legs.length >= 2) {
    const longest = legs.reduce((a, b) => (b.meters > a.meters ? b : a));
    const shortest = legs.reduce((a, b) => (b.meters < a.meters ? b : a));
    faq.push({
      q: '¿Cuál es el tramo más largo?',
      a: `El que va de ${longest.from} a ${longest.to}: unos ${formatWalkDistance(longest.meters)}, unos ${longest.minutes} minutos andando. El más corto, de ${shortest.from} a ${shortest.to}, son unos ${formatWalkDistance(shortest.meters)}.`,
    });
  }
  return faq;
}

// extra: { leg, media, alt } — only the 2-hour pages pass any.
//   leg   — walkLegs() entry for this stop
//   media — { title, image: { src, width, height } | null } resolved by the
//           server from the stop's own Wikipedia article. The photo links to
//           that article, which is also its credit. Without media the stop
//           shows neither: there is no Spanish article to send anyone to.
function buildItemHtml(item, extra = {}) {
  const wiki = extra.media ? spanishArticleUrl(extra.media.title) : null;
  const image = extra.media && extra.media.image;
  const photo = image && image.src && wiki
    ? `<a class="seo-stop-photo" href="${escapeHtml(wiki)}" rel="noopener" target="_blank"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(extra.alt || item.name)}" loading="lazy" decoding="async" width="${Number(image.width) || 320}" height="${Number(image.height) || 240}" /></a>`
    : '';
  const meta = [];
  if (extra.leg) {
    meta.push(`A unos ${formatWalkDistance(extra.leg.meters)} de la parada anterior, unos ${extra.leg.minutes} min andando.`);
  }
  if (wiki) {
    meta.push(`<a href="${escapeHtml(wiki)}" rel="noopener" target="_blank">${photo ? 'Foto y más información' : 'Más información'} en Wikipedia</a>`);
  }
  const metaHtml = meta.length ? ` <span class="seo-stop-meta">${meta.join(' ')}</span>` : '';
  const cls = photo ? ' class="seo-stop"' : '';
  return `        <li${cls}>${photo}<strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.description)}${metaHtml}</li>`;
}

// links: { cityVariants: [{href,label}], siblingCities: [{href,label}] }
// media: { [stop name]: { title, image } } — optional, 2-hour pages only.
function buildVariantSeoBlock(city, page, links, media = {}) {
  const def = PAGE_TYPES[page.page_type];
  const items = page.content;
  const tag = def.ordered ? 'ol' : 'ul';
  const isWalk = page.page_type === 'paseo-2h';
  const legs = isWalk ? walkLegs(items) : [];
  const itemsHtml = items
    .map((item, i) => buildItemHtml(item, isWalk
      ? { leg: legs[i], media: media[item.name], alt: `${item.name}, ${city.name}` }
      : {}))
    .join('\n');
  const faq = walkFaq(city, page);
  const faqSection = faq.length
    ? `
      <h2>Preguntas frecuentes sobre la ruta</h2>
${faq.map((f) => `      <h3>${escapeHtml(f.q)}</h3>\n      <p>${escapeHtml(f.a)}</p>`).join('\n')}
`
    : '';

  // The walk page's title, URL and intro all promise two hours, and the
  // generator now fits the route to that budget, so it states two hours rather
  // than a computed figure that could contradict its own headline. The gastro
  // page makes no duration claim of its own, so there the estimate is the only
  // number and it has to follow the actual distance.
  const duration = page.page_type === 'paseo-2h'
    ? 'unas 2 horas'
    : estimateWalkTime(page.total_distance_m, items.length);
  const distanceLine = page.total_distance_m
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
${faqSection}${activitiesSectionHtml(city, page.page_type)}
      <h2>Genera tu propia ruta por ${escapeHtml(city.name)}</h2>
      <p>
        Esta página recoge una selección fija. Si quieres un itinerario a tu medida —otro punto
        de partida u otra distancia—, RandomTrip lo genera en segundos con lugares
        reales. Gratis y sin registro.
        <a href="/">Generar mi ruta por ${escapeHtml(city.name)}</a>.
      </p>

      <h2>Más rutas por ${escapeHtml(city.name)}</h2>
      <ul>
${cityLinks}
      </ul>${siblingSection}

      <p><noscript>Necesitas activar JavaScript para usar la aplicación interactiva.</noscript></p>
    </div>`;
}

function buildVariantHtml(indexHtml, city, page, links, media = {}) {
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

  // The template carries the homepage's FAQPage ("¿Qué es RandomTrip?"), whose
  // questions aren't on this page. Where the page has its own FAQ, that one
  // replaces it: structured data has to describe what the reader can see.
  const faq = walkFaq(city, page);
  if (faq.length) {
    const faqLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
    const own = `<script type="application/ld+json">\n${JSON.stringify(faqLd).replace(/</g, '\\u003c')}\n  </script>`;
    let replaced = false;
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (block) => {
      if (replaced || !/"@type"\s*:\s*"FAQPage"/.test(block)) return block;
      replaced = true;
      return own;
    });
    if (!replaced) html = html.replace('</head>', `  ${own}\n</head>`);
  }

  html = injectSeoContent(html, buildVariantSeoBlock(city, page, links, media), city, walkPayload(page));
  return html;
}

// The 2-hour page is a finished route, so it carries its stops for the "Hacer
// esta ruta ahora" button. 83% of visitors read the page and never touched the
// app: the only button offered to generate a DIFFERENT route from scratch. Only
// the fields the route view and walk mode read, in the page's walking order.
function walkPayload(page) {
  if (page.page_type !== 'paseo-2h' || !Array.isArray(page.content)) return null;
  const stops = page.content
    .filter((s) => s && s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map(({ name, type, lat, lng, description }) => ({ name, type: type || 'monument', lat, lng, description: description || '' }));
  return stops.length >= 2 ? { stops, distanceM: page.total_distance_m || null } : null;
}

// The builders above rely on regex replacement against the built index.html.
// If the head markup changes shape, replacements silently no-op and pages ship
// with the homepage's title/canonical — a soft duplicate-content bug. Run this
// at server startup and log loudly if anything stops matching.
// Moves a page's SEO block out of #root and into #seo-content, and tells the
// client which city the page is for.
//
// This is the fix for the bug that made the whole programmatic-SEO effort inert:
// the block used to be injected INSIDE #root, and `createRoot(...).render(...)`
// throws away whatever is in #root. Crawlers that execute JS — Google does —
// therefore indexed the rendered homepage on every /ciudad/* URL, so 48 pages
// with 300-500 unique words each looked like 48 copies of the home.
// `walk`, when given, is the page's own route: the stops a visitor just read, so
// the app can open exactly that walk instead of generating a different one.
function injectSeoContent(html, block, city, walk = null) {
  const payload = JSON.stringify({
    slug: city.slug,
    name: city.name,
    lat: city.lat,
    lng: city.lng,
    country: city.country || 'España',
    ...(walk ? { walk } : {}),
  }).replace(/</g, '\\u003c'); // can't break out of the script tag
  return html
    // Drop the homepage block: this page has its own, and two elements with the
    // same id would be invalid.
    .replace(/<div id="seo-prerender">[\s\S]*?<\/div>/, '')
    .replace('<div id="seo-content"></div>', `<div id="seo-content">${block}</div>`)
    .replace('</head>', `<script>window.__CITY__=${payload};</script>\n</head>`);
}

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
    // The mount point injectSeoContent fills. If a template change loses it, the
    // city pages silently go back to indexing the homepage.
    ['seo-content mount', /<div id="seo-content"><\/div>/],
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
  RETIRED_URL_SLUGS,
  namesCity,
  activityAffiliateLink,
  activitiesSectionHtml,
  sanitizeItems,
  validatePage,
  injectSeoContent,
  buildVariantHtml,
  buildVariantSeoBlock,
  walkLegs,
  walkFaq,
  assertIndexPatterns,
  getPublishedPage,
  listPublishedPages,
  buildSiblingLinks,
};
