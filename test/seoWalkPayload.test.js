// The 2-hour pages hand their own stops to the app for "Hacer esta ruta ahora".
// What must hold: only the walk page carries them, in the page's order, and
// nothing in a stop name can break out of the inline script that carries them.
const test = require('node:test');
const assert = require('node:assert');
const { buildVariantHtml } = require('../seoPages');

const INDEX = '<html><head><title>x</title></head><body><div id="seo-content"></div></body></html>';
const CITY = { slug: 'toledo', name: 'Toledo', lat: 39.8581, lng: -4.0226 };
const LINKS = { cityVariants: [], siblingCities: [] };
const STOPS = [
  { name: 'Catedral de Santa María', type: 'church', lat: 39.8568, lng: -4.0237, description: 'Templo principal.', wikipedia: 'es:x' },
  { name: 'Alcázar de Toledo', type: 'castle', lat: 39.8582, lng: -4.0207, description: 'Fortaleza.' },
];

function cityPayload(html) {
  const m = html.match(/window\.__CITY__=(.*?);<\/script>/);
  assert.ok(m, 'la página no inyecta window.__CITY__');
  return JSON.parse(m[1]);
}

test('the 2-hour page carries its stops, in order, with only the fields the app reads', () => {
  const html = buildVariantHtml(INDEX, CITY, { page_type: 'paseo-2h', content: STOPS, total_distance_m: 2900, intro: 'x' }, LINKS);
  const { walk } = cityPayload(html);
  assert.deepStrictEqual(walk.stops.map((s) => s.name), ['Catedral de Santa María', 'Alcázar de Toledo']);
  assert.deepStrictEqual(Object.keys(walk.stops[0]).sort(), ['description', 'lat', 'lng', 'name', 'type']);
  assert.strictEqual(walk.distanceM, 2900);
});

test('the gastro page carries no walk', () => {
  const html = buildVariantHtml(INDEX, CITY, { page_type: 'gastro', content: STOPS, total_distance_m: 2900, intro: 'x' }, LINKS);
  assert.strictEqual(cityPayload(html).walk, undefined);
});

test('the activities section uses Civitatis\' own slug where it differs, and is tracked', () => {
  const { activitiesSectionHtml } = require('../seoPages');
  const { CITY_BY_SLUG } = require('../cityData');
  const html = activitiesSectionHtml(CITY_BY_SLUG.girona, 'paseo-2h', { civitatis: 'AID1', gyg: '' });
  assert.match(html, /civitatis\.com\/es\/gerona\/\?aid=AID1/);
  assert.match(html, /data-umami-event="activities_clicked"/);
  assert.match(html, /data-umami-event-placement="paseo-2h"/);
  assert.match(html, /rel="sponsored noopener"/);
  assert.match(activitiesSectionHtml(CITY_BY_SLUG.toledo, 'city_page', { civitatis: 'AID1', gyg: '' }), /\/es\/toledo\//);
});

test('with no affiliate configured there is no activities section', () => {
  const { activitiesSectionHtml } = require('../seoPages');
  assert.strictEqual(activitiesSectionHtml(CITY, 'paseo-2h', { civitatis: '', gyg: '' }), '');
});

test('a stop name cannot close the script tag that carries it', () => {
  const evil = [{ ...STOPS[0], name: 'Bar </script><script>alert(1)</script>' }, STOPS[1]];
  const html = buildVariantHtml(INDEX, CITY, { page_type: 'paseo-2h', content: evil, total_distance_m: 2900, intro: 'x' }, LINKS);
  const script = html.match(/<script>window\.__CITY__=[\s\S]*?<\/script>/)[0];
  assert.ok(!script.slice(0, -'</script>'.length).includes('</script>'));
  assert.strictEqual(cityPayload(html).walk.stops[0].name, 'Bar </script><script>alert(1)</script>');
});

// The practical detail on the 2-hour pages is arithmetic on the stops, so it
// can be checked: a figure here that the coordinates don't support is exactly
// the kind of invented fact these pages were once full of.
const THREE = [
  { name: 'A', type: 'church', lat: 39.8568, lng: -4.0237, description: 'Uno.', wikipedia: 'es:Catedral de Toledo' },
  { name: 'B', type: 'castle', lat: 39.8582, lng: -4.0207, description: 'Dos.' },
  { name: 'C', type: 'museum', lat: 39.8660, lng: -4.0207, description: 'Tres.', wikipedia: 'evil.example#:X' },
];
const WALK = { page_type: 'paseo-2h', content: THREE, total_distance_m: 3000, intro: 'x' };

test('each stop after the first says how far it is from the one before', () => {
  const { walkLegs } = require('../seoPages');
  const legs = walkLegs(THREE);
  assert.strictEqual(legs[0], null);
  // A→B is ~300 m in a straight line, B→C ~870 m; street distance is 1.4x.
  assert.ok(legs[1].meters > 350 && legs[1].meters < 480, `A→B ${legs[1].meters}`);
  assert.ok(legs[2].meters > 1150 && legs[2].meters < 1300, `B→C ${legs[2].meters}`);
  assert.strictEqual(legs[2].minutes, Math.round(legs[2].meters / 75));
});

test('the FAQ answers from the route: its ends, its budget and its longest leg', () => {
  const { walkFaq } = require('../seoPages');
  const faq = walkFaq(CITY, WALK);
  const text = faq.map((f) => `${f.q} ${f.a}`).join('\n');
  assert.match(text, /Son 3,0 km a pie, unos 40 minutos andando/);
  // 120 − 40 = 80 minutes over 3 stops.
  assert.match(text, /unos 26 minutos en cada una/);
  assert.match(text, /La primera parada es A y la última, C/);
  assert.match(text, /El que va de B a C/);
  assert.match(text, /El más corto, de A a B/);
});

test('no FAQ without a distance, and none on the gastro page', () => {
  const { walkFaq } = require('../seoPages');
  assert.deepStrictEqual(walkFaq(CITY, { ...WALK, total_distance_m: null }), []);
  assert.deepStrictEqual(walkFaq(CITY, { ...WALK, page_type: 'gastro' }), []);
});

test('the walk page shows legs, its own FAQ in place of the homepage one, and photos only where the server resolved an article', () => {
  const index = '<html><head><title>x</title>' +
    '<script type="application/ld+json">{"@type":"WebApplication"}</script>' +
    '<script type="application/ld+json">{"@type": "FAQPage","mainEntity":[{"name":"¿Qué es RandomTrip?"}]}</script>' +
    '</head><body><div id="seo-content"></div></body></html>';
  // What the server resolved: A has a Spanish article with a photo, B an
  // article without a lead image, C nothing.
  const media = {
    A: { title: 'Catedral de Toledo', image: { src: 'https://thumb.wikimedia.org/a.jpg', width: 330, height: 220 } },
    B: { title: 'Alcázar de Toledo', image: null },
  };
  const html = buildVariantHtml(index, CITY, WALK, LINKS, media);
  assert.match(html, /de la parada anterior, unos \d+ min andando/);
  assert.match(html, /<h3>¿Dónde empieza y dónde termina\?<\/h3>/);
  assert.ok(!html.includes('¿Qué es RandomTrip?'), 'the homepage FAQ is still on the page');
  assert.strictEqual(html.match(/"FAQPage"/g).length, 1);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /<img src="https:\/\/thumb\.wikimedia\.org\/a\.jpg" alt="A, Toledo"/);
  assert.match(html, /href="https:\/\/es\.wikipedia\.org\/wiki\/Catedral_de_Toledo"/);
  assert.strictEqual(html.match(/<img /g).length, 1);
  assert.match(html, /wiki\/Alc%C3%A1zar_de_Toledo"[^>]*>Más información en Wikipedia/);
  // The stored tag is never turned into a link by itself: C has one and gets nothing.
  assert.strictEqual(html.match(/en Wikipedia<\/a>/g).length, 2);
  assert.ok(!html.includes('evil.example'));
});

test('the gastro page gets none of the walk detail', () => {
  const html = buildVariantHtml(INDEX, CITY, { ...WALK, page_type: 'gastro' }, LINKS);
  assert.ok(!html.includes('parada anterior'));
  assert.ok(!html.includes('Preguntas frecuentes'));
});

test('only pages on the onrender.com copy are sent to the real domain', () => {
  const { canonicalRedirectTarget } = require('../server');
  const to = canonicalRedirectTarget;
  assert.strictEqual(to('randomtripgenerator.onrender.com', 'GET', '/ciudad/malaga?x=1'), 'https://randomtripgenerator.com/ciudad/malaga?x=1');
  assert.strictEqual(to('randomtripgenerator.onrender.com', 'GET', '//evil.example'), 'https://randomtripgenerator.com//evil.example');
  assert.strictEqual(to('randomtripgenerator.com', 'GET', '/'), null);
  assert.strictEqual(to('localhost', 'GET', '/'), null);
  assert.strictEqual(to('randomtripgenerator.onrender.com', 'GET', '/api/health'), null);
  assert.strictEqual(to('randomtripgenerator.onrender.com', 'POST', '/'), null);
});
