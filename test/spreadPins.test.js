// Route pins that overlap get pushed apart so every number can be read; pins
// that don't overlap must not move, or the map starts lying about where the
// stops are for no reason.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(
  pathToFileURL(path.join(__dirname, '..', 'client', 'src', 'lib', 'spreadPins.js')).href
);

const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const moved = (pts, offs) => pts.map((p, i) => ({ x: p.x + offs[i].dx, y: p.y + offs[i].dy }));

test('pins already far enough apart stay exactly where they are', async () => {
  const { spreadPins } = await load();
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 80 }];
  for (const o of spreadPins(pts, 30)) assert.deepStrictEqual(o, { dx: 0, dy: 0 });
});

test('a cluster of three (Toledo\'s synagogues and Museo del Greco) ends up readable', async () => {
  const { spreadPins } = await load();
  const pts = [{ x: 108, y: 318 }, { x: 118, y: 336 }, { x: 114, y: 328 }];
  const out = moved(pts, spreadPins(pts, 30));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      assert.ok(apart(out[i], out[j]) >= 29, `pins ${i} and ${j} still overlap: ${apart(out[i], out[j]).toFixed(1)}px`);
    }
  }
  // Nudged, not flung: nobody travels further than a pin's width.
  for (let i = 0; i < pts.length; i++) assert.ok(apart(pts[i], out[i]) <= 34);
});

test('two pins on the very same spot are separated too', async () => {
  const { spreadPins } = await load();
  const pts = [{ x: 50, y: 50 }, { x: 50, y: 50 }];
  const out = moved(pts, spreadPins(pts, 30));
  assert.ok(apart(out[0], out[1]) >= 29);
});
