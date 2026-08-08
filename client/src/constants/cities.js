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
];
