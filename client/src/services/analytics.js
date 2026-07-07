// Product analytics via Umami — cookieless, so no consent banner is needed.
// The whole module no-ops unless VITE_UMAMI_WEBSITE_ID is set at build time:
// local dev and forks send nothing.
//
// Setup: create the site in https://cloud.umami.is (free tier), then set
// VITE_UMAMI_WEBSITE_ID (and VITE_UMAMI_SRC if self-hosting) in the build
// environment (Render → Environment) and redeploy.
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID;
const SCRIPT_SRC = import.meta.env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js';

export function initAnalytics() {
  if (!WEBSITE_ID) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = SCRIPT_SRC;
  s.dataset.websiteId = WEBSITE_ID;
  document.head.appendChild(s);
}

// Fire-and-forget funnel event (e.g. track('route_created', { city, stops })).
// Analytics must never break the app: swallow everything, including the
// script being blocked or not loaded yet.
export function track(event, data) {
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(event, data);
    }
  } catch { /* ignore */ }
}
