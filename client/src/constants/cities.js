// Cities with a server-rendered landing page at /ciudad/<slug>.
//
// cityData.js (server, CJS) is the source of truth — it holds the coordinates,
// the hand-written intro and the highlights, and the sitemap is generated from
// it. This is the minimum the client needs to link to those pages, kept in sync
// by test/citiesParity.test.js, which fails if the two lists drift apart.
export const SEO_CITIES = [
  { slug: 'madrid', name: 'Madrid' },
  { slug: 'barcelona', name: 'Barcelona' },
  { slug: 'sevilla', name: 'Sevilla' },
  { slug: 'valencia', name: 'Valencia' },
  { slug: 'granada', name: 'Granada' },
  { slug: 'bilbao', name: 'Bilbao' },
  { slug: 'malaga', name: 'Málaga' },
  { slug: 'zaragoza', name: 'Zaragoza' },
  { slug: 'san-sebastian', name: 'San Sebastián' },
  { slug: 'cordoba', name: 'Córdoba' },
  { slug: 'toledo', name: 'Toledo' },
  { slug: 'santiago-de-compostela', name: 'Santiago de Compostela' },
];
