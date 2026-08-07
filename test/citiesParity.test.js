// The client needs the list of cities that have a landing page in order to link
// to them, and cityData.js (server, CJS) can't be imported by Vite. So the list
// exists twice. This is the test that stops the copies drifting: add a city to
// cityData.js without adding it to the client and the build fails here, instead
// of the new page quietly ending up unlinked from the app.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { CITIES } = require('../cityData');

test('the client city list matches cityData.js exactly, in order', async () => {
  const mod = await import(
    pathToFileURL(path.join(__dirname, '..', 'client', 'src', 'constants', 'cities.js')).href
  );
  const client = mod.SEO_CITIES;

  assert.strictEqual(
    client.length,
    CITIES.length,
    `el cliente lista ${client.length} ciudades y cityData.js ${CITIES.length}`
  );
  assert.deepStrictEqual(
    client.map((c) => c.slug),
    CITIES.map((c) => c.slug),
    'los slugs no coinciden (o van en otro orden)'
  );
  assert.deepStrictEqual(
    client.map((c) => c.name),
    CITIES.map((c) => c.name),
    'los nombres visibles no coinciden'
  );
});
