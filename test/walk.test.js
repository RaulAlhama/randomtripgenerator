// Walk mode decides when someone has arrived somewhere. Getting that wrong in
// either direction is bad in a way a screenshot won't show: advance too eagerly
// and it ticks off stops the walker never reached, advance too reluctantly and
// they stand in the doorway of the church being told they are 200m away.
//
// These are the cases that come from real GPS rather than from a diagram.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(
  pathToFileURL(path.join(__dirname, '..', 'client', 'src', 'lib', 'walk.js')).href
);

// Alhama's town hall, and a point ~25m away (a walker on the pavement outside).
const HALL = { name: 'Ayuntamiento', lat: 37.8515107, lng: -1.4264402, type: 'townhall' };
const OUTSIDE = { lat: 37.8517, lng: -1.42648, accuracy: 15 };
const FAR = { lat: 37.8560, lng: -1.4300, accuracy: 15 };

test('metersBetween matches the known distance between the two OSM records', async () => {
  const { metersBetween } = await load();
  // way/511467229 and way/1160307312: measured at 7.3m apart.
  const d = metersBetween(37.8515107, -1.4264402, 37.8514454, -1.4264296);
  assert.ok(d > 6 && d < 9, `esperaba ~7.3 m, salió ${d.toFixed(1)}`);
});

test('one good fix is not enough — two in a row are', async () => {
  const { evaluateFix } = await load();
  const first = evaluateFix(OUTSIDE, HALL, 0);
  assert.equal(first.arrived, false, 'un solo fix no debe avanzar');
  assert.equal(first.streak, 1);
  assert.equal(first.reason, 'near');

  const second = evaluateFix(OUTSIDE, HALL, first.streak);
  assert.equal(second.arrived, true, 'el segundo fix seguido sí');
});

test('a wild fix in the middle resets the streak', async () => {
  const { evaluateFix } = await load();
  let s = evaluateFix(OUTSIDE, HALL, 0).streak;
  assert.equal(s, 1);
  s = evaluateFix(FAR, HALL, s).streak;
  assert.equal(s, 0, 'un salto lejano vuelve a empezar la cuenta');
  const after = evaluateFix(OUTSIDE, HALL, s);
  assert.equal(after.arrived, false, 'y hay que volver a confirmar dos veces');
});

test('a low-accuracy fix never advances, however close it claims to be', async () => {
  const { evaluateFix } = await load();
  const vague = { ...OUTSIDE, accuracy: 400 };
  const r = evaluateFix(vague, HALL, 1);
  assert.equal(r.arrived, false);
  assert.equal(r.reason, 'accuracy', 'la UI necesita distinguir "sin señal" de "estás lejos"');
  assert.equal(r.streak, 0);
});

test('a fix with no accuracy field is treated as unusable, not as perfect', async () => {
  const { evaluateFix } = await load();
  // The trap: `distance > MAX` is false for NaN too, so a sloppy comparison lets
  // an unknown-accuracy fix through as if it were a good one.
  for (const acc of [undefined, null, NaN]) {
    const r = evaluateFix({ ...OUTSIDE, accuracy: acc }, HALL, 1);
    assert.equal(r.arrived, false, `accuracy=${acc} no debe contar como llegada`);
    assert.equal(r.reason, 'accuracy');
  }
});

test('the arrival radius follows the type, because OSM gives us centroids', async () => {
  const { arrivalRadiusFor, evaluateFix, ARRIVAL_M } = await load();
  assert.equal(arrivalRadiusFor('park'), 90);
  assert.equal(arrivalRadiusFor('townhall'), ARRIVAL_M.default);
  assert.equal(arrivalRadiusFor(undefined), ARRIVAL_M.default);

  // 60m from the centroid: inside the park gates, outside a building's radius.
  const gate = { lat: 37.85205, lng: -1.4264402, accuracy: 12 };
  const asPark = evaluateFix(gate, { ...HALL, type: 'park' }, 1);
  const asBuilding = evaluateFix(gate, HALL, 1);
  assert.equal(asPark.arrived, true, 'en la verja de un parque ya has llegado');
  assert.equal(asBuilding.arrived, false, 'a 60 m de un edificio, no');
});

test('missing fix or missing target is handled, not thrown', async () => {
  const { evaluateFix } = await load();
  assert.equal(evaluateFix(null, HALL, 3).reason, 'no-fix');
  assert.equal(evaluateFix(OUTSIDE, null, 3).reason, 'no-fix');
  assert.equal(evaluateFix(null, null, 3).streak, 0);
});

test('nextStopIndex walks past everything already handled', async () => {
  const { nextStopIndex } = await load();
  assert.equal(nextStopIndex(5, []), 0);
  assert.equal(nextStopIndex(5, [0, 1]), 2);
  assert.equal(nextStopIndex(5, new Set([0, 2])), 1, 'un salto no bloquea la ruta');
  assert.equal(nextStopIndex(3, [0, 1, 2]), -1, 'paseo terminado');
});

test('progress belongs to the route, not the session', async () => {
  const { walkId, saveWalk, loadWalk } = await load();
  const routeA = [{ name: 'A', lat: 1, lng: 1 }, { name: 'B', lat: 2, lng: 2 }];
  const routeB = [{ name: 'A', lat: 1, lng: 1 }, { name: 'C', lat: 3, lng: 3 }];
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  const idA = walkId(routeA);
  assert.notEqual(idA, walkId(routeB), 'rutas distintas, ids distintos');
  assert.equal(idA, walkId([...routeA]), 'la misma ruta da el mismo id');

  saveWalk(idA, { visited: [0], skipped: [], startedAt: 1000 }, storage);
  assert.deepEqual(loadWalk(idA, storage).visited, [0], 'se reanuda la misma ruta');
  assert.equal(loadWalk(walkId(routeB), storage), null, 'otra ruta empieza limpia');
});

test('corrupt stored progress is ignored instead of crashing the walk', async () => {
  const { loadWalk } = await load();
  for (const raw of ['not json', '{}', '{"id":"x"}', 'null', '{"id":"x","visited":"nope"}']) {
    const storage = { getItem: () => raw, setItem: () => {}, removeItem: () => {} };
    assert.equal(loadWalk('x', storage), null, `entrada corrupta: ${raw}`);
  }
});

test('stored indices are sanitised, not trusted', async () => {
  const { loadWalk } = await load();
  const raw = JSON.stringify({ id: 'x', visited: [0, -3, 2.5, 'a', 4], skipped: [1, null], startedAt: 'soon' });
  const storage = { getItem: () => raw, setItem: () => {}, removeItem: () => {} };
  const out = loadWalk('x', storage);
  assert.deepEqual(out.visited, [0, 4]);
  assert.deepEqual(out.skipped, [1]);
  assert.equal(out.startedAt, null);
});

test('a storage that throws does not stop a walk from starting', async () => {
  const { saveWalk, loadWalk, clearWalk } = await load();
  const hostile = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('nope'); },
  };
  assert.doesNotThrow(() => saveWalk('x', { visited: [1] }, hostile));
  assert.equal(loadWalk('x', hostile), null);
  assert.doesNotThrow(() => clearWalk(hostile));
});

test('the per-leg link carries one destination and no waypoints', async () => {
  const { legDirectionsUrl } = await load();
  const url = legDirectionsUrl({ lat: 37.85, lng: -1.42 }, HALL);
  assert.ok(url.includes('origin=37.85,-1.42'));
  assert.ok(url.includes(`destination=${HALL.lat},${HALL.lng}`));
  assert.ok(url.includes('travelmode=walking'));
  assert.ok(!url.includes('waypoints'), 'sin waypoints no hay tope de 9 que romper');
  // No fix yet: Google is allowed to use the phone's own position.
  assert.ok(!legDirectionsUrl(null, HALL).includes('origin='));
  assert.equal(legDirectionsUrl(null, null), null);
});

test('distances read the way a person would say them', async () => {
  const { formatMeters, walkingMinutes } = await load();
  assert.equal(formatMeters(0), '0 m');
  assert.equal(formatMeters(37), '35 m', 'redondeado a 5 m: el GPS no sabe más');
  assert.equal(formatMeters(1240), '1.2 km');
  assert.equal(formatMeters(-1), null);
  assert.equal(walkingMinutes(30), 1, 'nunca "0 min"');
  assert.equal(walkingMinutes(750), 10);
});
