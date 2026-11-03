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

test('a stop name cannot close the script tag that carries it', () => {
  const evil = [{ ...STOPS[0], name: 'Bar </script><script>alert(1)</script>' }, STOPS[1]];
  const html = buildVariantHtml(INDEX, CITY, { page_type: 'paseo-2h', content: evil, total_distance_m: 2900, intro: 'x' }, LINKS);
  const script = html.match(/<script>window\.__CITY__=[\s\S]*?<\/script>/)[0];
  assert.ok(!script.slice(0, -'</script>'.length).includes('</script>'));
  assert.strictEqual(cityPayload(html).walk.stops[0].name, 'Bar </script><script>alert(1)</script>');
});
