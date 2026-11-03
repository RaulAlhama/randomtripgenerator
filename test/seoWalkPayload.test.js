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
