// Every map in the app draws OpenStreetMap's own tiles, and their servers
// refuse a browser that sends no Referer: each tile comes back as a 403
// "Access blocked" image. A browser shows that image like any other, so
// nothing errors, nothing is logged, and the first sign is a user's
// screenshot. That is how it was found on 2026-11-06, after helmet's default
// `Referrer-Policy: no-referrer` had been stripping the Referer from every tile.
//
// These tests hold the two things that keep the maps working: the page's
// policy lets the origin through, and every tile layer goes through the one
// config that also sets it on the tiles themselves.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Policies under which a browser sends no Referer to another site at all.
const STRIPS_CROSS_ORIGIN_REFERER = new Set(['no-referrer', 'same-origin']);

// A header may list several policies; browsers apply the last one they know.
const effectivePolicy = (header) => String(header || '').split(',').map((s) => s.trim()).filter(Boolean).pop() || '';

test("the server's Referrer-Policy lets OpenStreetMap see our origin", async () => {
  const { app } = require('../server');
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    const policy = effectivePolicy(res.headers.get('referrer-policy'));
    assert.ok(policy, 'Referrer-Policy missing: the browser default would work, but it should be explicit');
    assert.ok(
      !STRIPS_CROSS_ORIGIN_REFERER.has(policy),
      `Referrer-Policy "${policy}" strips the Referer from map tiles, and OpenStreetMap blocks every one of them`
    );
  } finally {
    server.close();
  }
});

test('the shared OSM tile config sends a Referer and credits OpenStreetMap', async () => {
  const { OSM_TILE_PROPS } = await import(
    pathToFileURL(path.join(__dirname, '..', 'client', 'src', 'components', 'explore', 'osmTiles.js')).href
  );
  assert.match(OSM_TILE_PROPS.url, /^https:\/\/tile\.openstreetmap\.org\//);
  assert.ok(OSM_TILE_PROPS.referrerPolicy, 'tiles must carry their own referrerPolicy');
  assert.ok(!STRIPS_CROSS_ORIGIN_REFERER.has(OSM_TILE_PROPS.referrerPolicy));
  // Attribution is the other half of OSM's tile policy.
  assert.match(OSM_TILE_PROPS.attribution, /OpenStreetMap/);
});

test('no map asks for OSM tiles without going through osmTiles.js', () => {
  const root = path.join(__dirname, '..', 'client', 'src');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(jsx?|tsx?)$/.test(entry.name) || entry.name === 'osmTiles.js') continue;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('tile.openstreetmap.org')) offenders.push(`${entry.name}: hardcodes the OSM tile URL`);
      for (const m of src.matchAll(/<TileLayer\b[^>]*>/g)) {
        if (!m[0].includes('{...OSM_TILE_PROPS}')) offenders.push(`${entry.name}: ${m[0].slice(0, 60)}`);
      }
    }
  };
  walk(root);
  assert.deepStrictEqual(offenders, []);
});
