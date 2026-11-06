// OpenStreetMap's own tile servers, shared by every map in the app.
//
// Their usage policy requires browsers to send a Referer, and since early
// November 2026 they enforce it: a tile requested by a regular Chrome with no
// Referer comes back as a 403 "Access blocked" image. The site sent
// `Referrer-Policy: no-referrer` (helmet's default) until then, so every map
// turned into a wall of those images. server.js now sends
// strict-origin-when-cross-origin; setting it on the tiles too keeps the maps
// working even if the page's policy is tightened again. Only the origin
// (https://randomtripgenerator.com/) leaves the site, never the page's path.
export const OSM_TILE_PROPS = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
  referrerPolicy: 'strict-origin-when-cross-origin',
};
