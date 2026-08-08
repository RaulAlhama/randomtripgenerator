// One building, two OSM records — which name does the card get?
//
// OSM maps civic buildings twice: once for what they ARE (historic=manor,
// heritage=yes) and once for what they DO (amenity=townhall). The names differ,
// so dedup-by-name keeps both and the card is titled with whichever record the
// query happened to fetch. In Alhama de Murcia that produced a card called "Casa
// de la Familia Artero" showing a photo of the town hall, with an LLM description
// about traditional housing — two wrong details derived from one wrong name.
//
// The coordinates below are the real ones: way/1160307312 (the manor) and
// way/511467229 (the town hall) are 7.3m apart and share four vertices.
const test = require('node:test');
const assert = require('node:assert');
const { reconcileCivicBuildings } = require('../server');

const manor = () => ({
  name: 'Casa de la Familia Artero', rawType: 'manor', type: 'monument',
  lat: 37.8514454, lng: -1.4264296, wikipedia: null, wikidata: null, heritage: 'yes',
});
const hall = () => ({
  name: 'Ayuntamiento de Alhama de Murcia', rawType: 'townhall', type: 'townhall',
  lat: 37.8515107, lng: -1.4264402, wikipedia: null, wikidata: null, heritage: null,
});

test('the town hall renames the heritage record it shares walls with', () => {
  const out = reconcileCivicBuildings([manor(), hall()]);
  assert.equal(out.length, 1, 'one building must yield one card, not two');
  assert.equal(out[0].name, 'Ayuntamiento de Alhama de Murcia');
  assert.equal(out[0].alias, 'Casa de la Familia Artero', 'the displaced name is kept');
  assert.equal(out[0].type, 'townhall', 'type follows the name, or the template lies');
});

test('order does not decide the outcome', () => {
  const out = reconcileCivicBuildings([hall(), manor()]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Ayuntamiento de Alhama de Murcia');
  assert.equal(out[0].alias, 'Casa de la Familia Artero');
});

test('a building famous under its own name keeps it', () => {
  // Madrid's city hall is the Palacio de Cibeles to everyone, and OSM says so with
  // a wikipedia tag. Preferring the civic name here would be a regression.
  const palace = {
    name: 'Palacio de Cibeles', rawType: 'attraction', type: 'monument',
    lat: 40.4190, lng: -3.6926, wikipedia: 'es:Palacio de Cibeles', wikidata: 'Q1300030', heritage: null,
  };
  const madrid = {
    name: 'Ayuntamiento de Madrid', rawType: 'townhall', type: 'townhall',
    lat: 40.41905, lng: -3.69262, wikipedia: null, wikidata: null, heritage: null,
  };
  const out = reconcileCivicBuildings([palace, madrid]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Palacio de Cibeles');
  assert.equal(out[0].alias, 'Ayuntamiento de Madrid');
  assert.equal(out[0].type, 'monument', 'a famous building keeps its own type too');
});

test('a plain modern town hall is not a sight', () => {
  // Every town has one. Without heritage or an article it is an errand, not a stop.
  const out = reconcileCivicBuildings([{
    name: 'Ayuntamiento de Villanueva', rawType: 'townhall', type: 'townhall',
    lat: 40.0, lng: -3.0, wikipedia: null, wikidata: null, heritage: null,
  }]);
  assert.deepEqual(out, [], 'nothing else nearby and nothing notable: drop it');
});

test('a heritage town hall standing alone earns its own card', () => {
  const solo = {
    name: 'Ayuntamiento de Baeza', rawType: 'townhall', type: 'townhall',
    lat: 37.99, lng: -3.47, wikipedia: null, wikidata: null, heritage: '2',
  };
  const out = reconcileCivicBuildings([solo]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Ayuntamiento de Baeza');
  assert.equal(out[0].alias, undefined, 'nothing was displaced, so no alias');
});

test('a town hall does not swallow a neighbour it merely stands near', () => {
  // ~90m apart: a different building on the same plaza. Merging these would delete
  // a real stop, which is worse than the naming bug this function exists to fix.
  const church = {
    name: 'Iglesia de San Lázaro', rawType: 'place_of_worship', type: 'church',
    lat: 37.8523, lng: -1.4264, wikipedia: null, wikidata: null, heritage: null,
  };
  const out = reconcileCivicBuildings([church, hall()]);
  assert.equal(out.length, 1, 'the church survives');
  assert.equal(out[0].name, 'Iglesia de San Lázaro', 'and keeps its name');
  assert.equal(out[0].alias, undefined);
  // The hall itself is dropped by the not-a-sight rule, not merged into the church.
  assert.ok(!out.some(p => p.rawType === 'townhall'));
});

test('decks with no town hall come back untouched', () => {
  const pois = [manor(), { name: 'Parque', rawType: 'park', type: 'park', lat: 1, lng: 1 }];
  const out = reconcileCivicBuildings(pois);
  assert.equal(out, pois, 'same array reference: no needless copying');
});

test('two town halls in range pick one match each, not the same one twice', () => {
  // Defensive: mappers do leave duplicate townhall records. The second must not
  // rename a POI the first already renamed, which would lose the first alias.
  const out = reconcileCivicBuildings([manor(), hall(), { ...hall(), name: 'Casa Consistorial' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].alias, 'Casa de la Familia Artero', 'the original name survives');
});
