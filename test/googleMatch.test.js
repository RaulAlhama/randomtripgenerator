// Does the place Google returned correspond to the POI we asked about?
//
// Google's Text Search never answers "no match": it fuzzy-matches and returns the
// closest thing it has. The only guard used to be distance, and inside a town
// everything is within 2km, so "Jardín de los Patos" in Alhama de Murcia came
// back as "Jardín Del Dragón" — a different park 1km away — and the card showed
// that park's photo and its 4.2 rating.
//
// Every pair below is a real Google response, captured by querying the API with
// OSM POI names from Alhama de Murcia and Toledo. The "accepts" cases are what
// makes the strict rule unusable: requiring every significant word accepted only
// 11 of these 24, stripping photos over wording differences.
const test = require('node:test');
const assert = require('node:assert');
const { googleNameMatchesPOI } = require('../server');

// Wrong place, and the reason this validation exists.
const REJECTS = [
  ['Jardín de los Patos', 'Jardín Del Dragón'],
  ['Fuente de los Caballitos', 'Mirador de La Muela'],
  // Sharing only a generic word proves nothing.
  ['Iglesia de la Concepción', 'Iglesia de San Lázaro'],
  ['Museo Arqueológico Los Baños', 'Museo del Greco'],
  ['Plaza Mayor', 'Plaza de Santo Domingo'],
];

// Same place, worded differently — the common case, and what a stricter rule
// would have thrown away.
const ACCEPTS = [
  ['Los Mayos', 'Jardín de Los Mayos'],
  ['Castillo de Alhama', 'Castillo de Alhama de Murcia'],
  ['Capilla de los Reyes Nuevos', 'Capilla de Reyes Nuevos'],
  ['Monumento a Gregorio Marañón', 'Busto de Gregorio Marañón'],
  ['Escudo Casa de la Tercia', 'Casa de la Tercia'],
  ['El pozo de los deseos R. Saavedra', 'El pozo de los deseos'],
  ['Memorial Ginés Campos Gómez', 'Monumento a Ginés Campos'],
  ['Exposición Templarios y otras Órdenes Militares', 'Exposición de Templarios y Otras Ordenes Militares'],
  ['Museo de Tapices y Textiles de la Catedral de Toledo', 'Museo de "Tapices y Textiles de la Catedral de Toledo"'],
  ['Monumento al Nazareno', 'Monumento al nazareno'],
  ['Museo Arqueológico Los Baños', 'Museo Arqueológico Los Baños'],
  ['Centro Cultural San Clemente', 'Centro Cultural San Clemente'],
  ['Fuente del Niño de los Mártires', 'Jardín de los Mártires'],
];

for (const [poi, google] of REJECTS) {
  test(`rechaza "${google}" para "${poi}"`, () => {
    assert.strictEqual(googleNameMatchesPOI(poi, google), false);
  });
}

for (const [poi, google] of ACCEPTS) {
  test(`acepta "${google}" para "${poi}"`, () => {
    assert.strictEqual(googleNameMatchesPOI(poi, google), true);
  });
}

test('a POI named only with generic words needs every word to match', () => {
  // Nothing distinctive to key on, so the rule tightens instead of guessing.
  assert.strictEqual(googleNameMatchesPOI('Termas Romanas', 'Termas Romanas'), true);
  assert.strictEqual(googleNameMatchesPOI('Termas Romanas', 'Termas de Diocleciano'), false);
  assert.strictEqual(googleNameMatchesPOI('Casa Palacio', 'Casa de la Moneda'), false);
});

test('accents and case are ignored, empty input is never a match', () => {
  assert.strictEqual(googleNameMatchesPOI('Museo Sefardí', 'MUSEO SEFARDI'), true);
  assert.strictEqual(googleNameMatchesPOI('', 'Cualquier cosa'), false);
  assert.strictEqual(googleNameMatchesPOI('Jardín de los Patos', ''), false);
  assert.strictEqual(googleNameMatchesPOI('Jardín de los Patos', null), false);
});
