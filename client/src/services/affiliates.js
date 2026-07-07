// Civitatis affiliate links. Dormant unless VITE_CIVITATIS_AID is set at
// build time (same activation pattern as analytics/Auth0): without an
// affiliate id every outbound click would be an unattributed giveaway, so
// the promo simply doesn't render.
//
// Link format per the Civitatis program: any civitatis.com URL with
// ?aid=<id> appended sets a 30-day attribution cookie.
const CIVITATIS_AID = import.meta.env.VITE_CIVITATIS_AID;

// "San Sebastián" → "san-sebastian" — Civitatis destination slugs are the
// lowercased, de-accented, dash-joined city name.
function citySlug(city) {
  return (city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Destination page for a city, with attribution. Null when the affiliate id
// isn't configured or the city name is unusable — callers hide the promo.
export function civitatisCityUrl(city) {
  const slug = citySlug(city);
  if (!slug || !CIVITATIS_AID) return null;
  return `https://www.civitatis.com/es/${slug}/?aid=${encodeURIComponent(CIVITATIS_AID)}`;
}
