// Activities affiliate links. Providers activate via build-time env vars —
// with none set, promos simply don't render (same pattern as analytics):
// without an id every outbound click would be an unattributed giveaway.
//
// Priority when several are configured: Civitatis (best fit for the
// Spanish-speaking audience) → GetYourGuide.
const CIVITATIS_AID = import.meta.env.VITE_CIVITATIS_AID;
const GYG_PARTNER_ID = import.meta.env.VITE_GYG_PARTNER_ID;

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

// Attribution link for tours/tickets in a city: { provider, url }, or null
// when no affiliate is configured (callers hide the promo).
export function activityAffiliate(city) {
  const name = (city || '').trim();
  if (!name) return null;

  if (CIVITATIS_AID) {
    // ?aid= sets a 30-day attribution cookie on any civitatis.com URL.
    const slug = citySlug(name);
    if (!slug) return null;
    return {
      provider: 'Civitatis',
      url: `https://www.civitatis.com/es/${slug}/?aid=${encodeURIComponent(CIVITATIS_AID)}`,
    };
  }

  if (GYG_PARTNER_ID) {
    // GetYourGuide city pages need internal location ids ("/madrid-l46/"),
    // so deep-link the search page instead — any getyourguide.com URL with
    // ?partner_id= attributes the whole order to the partner.
    return {
      provider: 'GetYourGuide',
      url: `https://www.getyourguide.es/s/?q=${encodeURIComponent(name)}&partner_id=${encodeURIComponent(GYG_PARTNER_ID)}`,
    };
  }

  return null;
}
