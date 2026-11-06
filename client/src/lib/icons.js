// The app's icons: line drawings on a 24px grid, 2px stroke, round ends — the
// same hand as the bottom bar. No emojis anywhere in the interface: they draw
// differently on every phone, sat badly next to these line icons, and the
// owner doesn't want them (2026-11-06).
//
// Kept as SVG markup strings so one set serves both React (components/ui/Icon)
// and Leaflet, whose divIcons take their HTML as text (iconSvg). Static
// constants only: nothing in here ever comes from data.

const PRECIP_CLOUD = '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"/>';
const LANDMARK = '<path d="M3 21h18"/><path d="M5 21V11M9.5 21V11M14.5 21V11M19 21V11"/><path d="M2.5 11h19L12 4z"/>';

export const ICONS = {
  // The bottom bar's own drawings, reused where a screen stands for its tab.
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',

  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  pinOff: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/><path d="M3 3l18 18"/>',
  // Same drawing as the homepage's "Restaurantes cerca" button.
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 11v2M13 17v2"/>',

  // Place types (constants/poi.js maps each type to one of these).
  landmark: LANDMARK,
  obelisk: '<path d="M10 20l1-14 1-2 1 2 1 14"/><path d="M6 22h12M8 20h8"/>',
  tree: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 22h6"/>',
  castle: '<path d="M3 21h18"/><path d="M5 21V8h2.5v2.5H10V8h4v2.5h2.5V8H19v13"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  mountain: '<path d="M2 20l7-11 4 6 3-4 6 9z"/><circle cx="17" cy="5" r="2"/>',
  church: '<path d="M12 2v6M9.5 4.5h5"/><path d="M5 21v-9l7-4 7 4v9"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  fountain: '<path d="M12 13V5"/><path d="M8 9c0-2.2 1.8-4 4-4s4 1.8 4 4"/><path d="M4 13h16v1a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/>',
  dome: '<path d="M3 21h18"/><path d="M5 21v-8h14v8"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M12 7V4"/><path d="M10 21v-4h4v4"/>',
  store: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  flower: '<circle cx="12" cy="8" r="3"/><path d="M12 11v10"/><path d="M12 17c-1.5-2.5-4.5-3-6-2 1 2.5 4 3.5 6 2z"/><path d="M12 15c1.5-2.5 4.5-3 6-2-1 2.5-4 3.5-6 2z"/>',
  mask: '<path d="M4 4h16v7a8 8 0 0 1-16 0z"/><path d="M9 9h.01M15 9h.01"/><path d="M9 14a3.5 3.5 0 0 0 6 0"/>',

  // Weather (constants/weather.js maps each WMO code to one of these).
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  cloudSun: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41"/><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>',
  fog: `${PRECIP_CLOUD}<path d="M16 17H7M17 21H9"/>`,
  drizzle: `${PRECIP_CLOUD}<path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>`,
  rain: `${PRECIP_CLOUD}<path d="M16 14v6M8 14v6M12 16v6"/>`,
  snow: `${PRECIP_CLOUD}<path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>`,
  storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>',
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
};

// The icon as an <svg> string, for Leaflet divIcons. Unknown names draw a pin.
export function iconSvg(name, { size = 16, strokeWidth = 2 } = {}) {
  const body = ICONS[name] || ICONS.pin;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
