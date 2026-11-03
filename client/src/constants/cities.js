// Cities with a server-rendered landing page at /ciudad/<slug>.
//
// cityData.js (server, CJS) is the source of truth for slugs, names, coordinates
// and the hand-written content, and the sitemap is generated from it. This is what
// the client needs to link to those pages and show them, kept in sync by
// test/citiesParity.test.js, which fails if the two lists drift apart.
//
// `photo` is an Unsplash photo id (hotlinked CDN), `photoBy` the author, credited
// in the footer. Every id here was fetched and looked at before being added — a
// wrong id renders a photo of somewhere else, which is the same class of error as
// the Google Places mismatch.
export const SEO_CITIES = [
  { slug: 'madrid', name: 'Madrid', photo: '1539037116277-4db20889f2d4', photoBy: 'Florian Wehde' },
  { slug: 'barcelona', name: 'Barcelona', photo: '1583422409516-2895a77efded', photoBy: 'Logan Armstrong' },
  { slug: 'sevilla', name: 'Sevilla', photo: '1534106659956-d02ca15d30fb', photoBy: 'Jacek Ulinski' },
  { slug: 'valencia', name: 'Valencia', photo: '1529437971227-3344caa48ce2', photoBy: 'travelnow.or.crylater' },
  { slug: 'granada', name: 'Granada', photo: '1620677368158-32b1293fac36', photoBy: 'Jorge Fernández Salas' },
  { slug: 'bilbao', name: 'Bilbao', photo: '1559211568-8ce901de931b', photoBy: 'Slava Kuzminsky' },
  { slug: 'malaga', name: 'Málaga', photo: '1512753360435-329c4535a9a7', photoBy: 'Willian Justen de Vasconcellos' },
  { slug: 'zaragoza', name: 'Zaragoza', photo: '1663408445669-d5e96e38fdfc', photoBy: 'Unsplash' },
  { slug: 'san-sebastian', name: 'San Sebastián', photo: '1682312807239-d7a5afc6f0a9', photoBy: 'Andrea Huls Pareja' },
  { slug: 'cordoba', name: 'Córdoba', photo: '1632904080322-e71e16a5987f', photoBy: 'Alexandra Tran' },
  { slug: 'toledo', name: 'Toledo', photo: '1670691377549-155175463898', photoBy: 'Thomas Haas' },
  { slug: 'santiago-de-compostela', name: 'Santiago de Compostela', photo: '1563111980-8b2fe061b32c', photoBy: 'Unsplash' },
  // 2026-11 batch. Each one was looked at at the tile's own crop, and the
  // ambiguous ones were checked against the location Unsplash records: the best
  // "Cáceres" result was Trujillo's Plaza Mayor, two "Alicante" ones were
  // Benidorm, and a "León cathedral" one was Burgos.
  { slug: 'salamanca', name: 'Salamanca', photo: '1747858224313-f18c9c339c22', photoBy: 'Edgar' },
  { slug: 'segovia', name: 'Segovia', photo: '1632494836172-3fe362a0e403', photoBy: 'Diego Allen' },
  { slug: 'cadiz', name: 'Cádiz', photo: '1655307544022-85ae3a6d5ae7', photoBy: 'Klaus Janowitz' },
  { slug: 'caceres', name: 'Cáceres', photo: '1618754616514-c7cdc8024593', photoBy: 'David Gil de la Canal' },
  { slug: 'ronda', name: 'Ronda', photo: '1547039508-fa7d4620d7ca', photoBy: 'William Fernandes' },
  { slug: 'girona', name: 'Girona', photo: '1515974448560-3e45c9d51f95', photoBy: 'Lucas Gallone' },
  { slug: 'leon', name: 'León', photo: '1590654123126-80df3a0a3bf4', photoBy: 'Sergio Otoya' },
  { slug: 'burgos', name: 'Burgos', photo: '1612904368894-1fb34fe6c25b', photoBy: 'Manuel Torres Garcia' },
  { slug: 'oviedo', name: 'Oviedo', photo: '1732817540414-cebefbb6fd58', photoBy: 'David Vives' },
  { slug: 'cuenca', name: 'Cuenca', photo: '1716824529521-8bde2bba3834', photoBy: 'Gabriel Martin' },
  { slug: 'avila', name: 'Ávila', photo: '1669838032273-ba6b5f21966c', photoBy: 'Matteo del Piano' },
  { slug: 'merida', name: 'Mérida', photo: '1650103134649-5d7621808a1f', photoBy: 'Jordi Vich Navarro' },
  { slug: 'palma-de-mallorca', name: 'Palma de Mallorca', photo: '1617093888347-f73de2649f94', photoBy: 'Tom Podmore' },
  { slug: 'alicante', name: 'Alicante', photo: '1636319039199-4b81fe4d9552', photoBy: 'Victoria Nezh' },
  { slug: 'pamplona', name: 'Pamplona', photo: '1636217424464-e717e1849855', photoBy: 'David Vives' },
  { slug: 'valladolid', name: 'Valladolid', photo: '1595415961896-7809eea97c9e', photoBy: 'Clemente Corona' },
];
