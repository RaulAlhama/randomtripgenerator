// Quality gates for the pre-generated SEO pages.
//
// Every case here is a real one. The published pages carried 186 false or
// self-contradicting statements before these gates existed, and the first
// versions of the gates were too aggressive: matching the WORD "barrio" instead
// of the claim pattern flagged 74 of 254 descriptions, most of them legitimate.
// The "keeps" tests are therefore as important as the "drops" ones — they are
// what stops a stricter regex from quietly unpublishing the whole site.
const test = require('node:test');
const assert = require('node:assert');
const { sanitizeItems, validatePage } = require('../seoPages');

const item = (over = {}) => ({
  name: 'Mercado de Prueba',
  description: 'Mercado cubierto de producto fresco, con puestos y barras donde comer de pie sin reserva previa.',
  lat: 40.4168,
  lng: -3.7038,
  ...over,
});

// Distinct coordinates so the dedupe pass doesn't interfere.
const spread = (items) => items.map((it, i) => ({ ...it, lat: 40.4 + i * 0.01, lng: -3.7 - i * 0.01 }));

// A page's worth of items that all pass. Descriptions have to differ in their
// first 40 characters or the pre-existing near-duplicate gate fires — which it
// should, and which caught these fixtures when they were all copies.
const CLEAN = [
  'Mercado cubierto de producto fresco, con puestos y barras donde comer de pie sin reserva.',
  'Plaza porticada con terrazas a la sombra, buen sitio para descansar a mitad del recorrido.',
  'Parque urbano amplio, con paseos arbolados y bancos suficientes para hacer una pausa larga.',
  'Iglesia parroquial abierta al público, sobria por dentro y tranquila a casi cualquier hora.',
  'Museo pequeño de entrada rápida, cómodo de encajar entre dos paradas sin romper el ritmo.',
  'Mirador sobre los tejados del centro, el punto donde casi todo el mundo acaba haciendo fotos.',
];
const cleanPage = (n = 5) =>
  spread(CLEAN.slice(0, n).map((description, i) => item({ name: `Parada ${i + 1}`, description })));

const dropped = (items, city = 'Madrid') =>
  sanitizeItems('paseo-2h', spread(items), city).dropped.map((d) => d.reason);

test('drops a description that places the POI in a named neighbourhood', () => {
  const reasons = dropped([item({ name: 'Mercado de San Fernando', description: 'En el barrio de Chamberí, este mercado destaca por su ambiente tradicional y sus productos de temporada.' })]);
  assert.deepStrictEqual(reasons, ['claim_location']);
});

test('keeps "un mercado de barrio": a type of market, not a placement claim', () => {
  const reasons = dropped([item({ name: 'Zabalguneko azoka', description: 'Un pequeño mercado de barrio donde encontrar fruta, verdura y producto fresco a diario.' })]);
  assert.deepStrictEqual(reasons, []);
});

test('keeps generic prose about the old town or the city centre', () => {
  const reasons = dropped([
    item({ name: 'Plaza Vieja', description: 'Plaza porticada en pleno casco antiguo, buen sitio para sentarse a media mañana.' }),
    item({ name: 'Zona de tapas', description: 'Concentración de barras en una zona de tapas animada, ideal para picar algo de pie.' }),
  ]);
  assert.deepStrictEqual(reasons, []);
});

test('keeps a neighbourhood the POI is literally named after', () => {
  const reasons = dropped([item({ name: 'Mercat del Fort Pienc', description: 'Situado en el barrio de Fort Pienc, conserva los puestos de producto fresco de siempre.' })]);
  assert.deepStrictEqual(reasons, []);
});

test('drops an invented century or architectural style', () => {
  const reasons = dropped([
    item({ name: 'Palacio del Marqués', description: 'El palacio art déco del marqués, con salas que conservan su decoración original completa.' }),
    item({ name: 'Casón del Buen Retiro', description: 'Antiguo salón de baile del siglo XVIII, hoy dedicado a exposiciones temporales de pintura.' }),
  ]);
  assert.deepStrictEqual(reasons, ['claim_period_style', 'claim_period_style']);
});

test('keeps a style that is part of the POI name', () => {
  const reasons = dropped([item({ name: 'Museu del Modernisme Català', description: 'Un homenaje al estilo modernista catalán, con mobiliario y objetos decorativos de la época.' })]);
  assert.deepStrictEqual(reasons, []);
});

test('drops a description naming a different city we publish', () => {
  const reasons = dropped([item({ name: 'Camino Real', description: 'Enlaza la zona norte con el monasterio, ya muy cerca de Sevilla, entre campos de cultivo.' })]);
  assert.ok(reasons.includes('claim_other_city'), `esperaba claim_other_city, salió ${reasons}`);
});

test('drops English leaking into the Spanish copy', () => {
  const reasons = dropped([item({ name: 'Mirador', description: 'Un punto elevado que enamora a los visitantes por its beauty y sus vistas del entorno.' })]);
  assert.deepStrictEqual(reasons, ['not_spanish']);
});

test('drops two words fused together, but not a venue named that way', () => {
  assert.deepStrictEqual(
    dropped([item({ name: 'Museu Marítim', description: 'El museo narra laBarcelona marinera a través de embarcaciones originales y cartografía.' })]),
    ['fused_words']
  );
  assert.deepStrictEqual(
    dropped([item({ name: 'CosmoCaixa', description: 'CosmoCaixa reúne exposiciones científicas interactivas repartidas en varias plantas del edificio.' })]),
    []
  );
});

test('drops a trail whose prose contradicts the OSM roundtrip flag', () => {
  const trails = [
    { name: 'Vuelta a Ulía', distanceM: 6500, roundtrip: false, description: 'Un trazado circular alrededor del pico que permite contemplar la bahía desde lo alto.' },
    { name: 'Senda del Río', distanceM: 4000, roundtrip: true, description: 'Un recorrido lineal junto al cauce, cómodo y bien sombreado durante casi todo el trayecto.' },
  ];
  const reasons = sanitizeItems('senderos', trails, 'San Sebastián').dropped.map((d) => d.reason);
  assert.deepStrictEqual(reasons, ['contradiction_circular', 'contradiction_linear']);
});

test('trusts OSM-authored text: a mapper dating a chapel is a fact, not a guess', () => {
  const trails = [{
    name: 'Ruta de las Ermitas',
    distanceM: 8000,
    roundtrip: true,
    descSource: 'osm',
    description: 'Sendero circular que pasa por la ermita del siglo XVI, en el barrio de Santa Cruz, con fuerte desnivel.',
  }];
  assert.deepStrictEqual(sanitizeItems('senderos', trails, 'Toledo').dropped, []);
});

test('collapses two names for one building, keeping the one OSM considers notable', () => {
  const items = [
    { name: 'Museo sefardi', description: item().description, lat: 39.8575, lng: -4.0289 },
    { name: 'Sinagoga del Tránsito', description: item().description, lat: 39.85752, lng: -4.02892, wikipedia: 'es:Sinagoga del Tránsito' },
  ];
  const out = sanitizeItems('paseo-2h', items, 'Toledo');
  assert.strictEqual(out.items.length, 1);
  assert.strictEqual(out.items[0].name, 'Sinagoga del Tránsito');
});

test('does not collapse distinct places that merely share the city name', () => {
  const items = spread([
    item({ name: 'Museo de Málaga' }),
    item({ name: 'Centro Pompidou Málaga', description: 'Espacio de arte contemporáneo con exposiciones que rotan a lo largo del año entero.' }),
  ]);
  assert.deepStrictEqual(sanitizeItems('paseo-2h', items, 'Málaga').dropped, []);
});

test('does not collapse numbered stages of the same long route', () => {
  const trails = [
    { name: 'Camino de los Montes - Etapa 1', distanceM: 12000, roundtrip: false, description: 'Primera etapa entre robledales, con desnivel suave y buenas vistas del valle al fondo.' },
    { name: 'Camino de los Montes - Etapa 2', distanceM: 14000, roundtrip: false, description: 'Segunda etapa por crestas rocosas, algo más exigente y con tramos expuestos al sol.' },
  ];
  assert.deepStrictEqual(sanitizeItems('senderos', trails, 'Toledo').dropped, []);
});

test('validatePage refuses a page left short after the gates ran', () => {
  const verdict = validatePage('paseo-2h', {
    items: cleanPage(3),
    intro: 'Una ruta a pie por el centro de Madrid que reúne varias paradas cercanas entre sí y se recorre con calma en poco más de dos horas, sin prisas.',
    llmOk: true,
    cityName: 'Madrid',
  });
  assert.strictEqual(verdict.ok, false);
  assert.match(verdict.reason, /overpass_insufficient/);
});

test('validatePage rejects an intro claiming where the route starts or ends', () => {
  const verdict = validatePage('paseo-2h', {
    items: cleanPage(5),
    intro: 'Esta ruta a pie por el centro de Madrid recorre varios mercados históricos y termina en la Parada 3, ya muy cerca del río, tras poco más de dos horas de paseo tranquilo.',
    llmOk: true,
    cityName: 'Madrid',
  });
  assert.strictEqual(verdict.ok, false);
  assert.strictEqual(verdict.reason, 'intro_route_order');
});

test('validatePage accepts a clean page', () => {
  const verdict = validatePage('paseo-2h', {
    items: cleanPage(5),
    intro: 'Una ruta a pie por el centro de Madrid que reúne cinco paradas cercanas entre sí: mercados cubiertos y plazas donde pararse un rato, recorribles con calma sin necesidad de prisas ni reservas.',
    llmOk: true,
    cityName: 'Madrid',
  });
  assert.strictEqual(verdict.reason, null);
  assert.strictEqual(verdict.ok, true);
});
