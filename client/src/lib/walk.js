// Walk mode's decisions, kept out of React so they can be tested on their own.
// Nothing in here touches the DOM, the network or the clock.
//
// The premise: this is a companion, not a navigator. Google Maps gets you down
// the street; this tells you what you're standing in front of. That single choice
// is why there is no re-routing, no heading, no wake lock and no background
// geolocation here — none of which a web page does well, and all of which the
// phone's own map app already does.

// A POI's coordinates are the centroid of whatever OSM happened to draw. For a
// building that's a few metres from the door; for a park it's the middle of the
// lawn, which can be 100m from any gate. So the arrival radius follows the type
// instead of being one number: someone standing at the entrance of Jardín de los
// Patos HAS arrived, and telling them otherwise is the worse failure.
export const ARRIVAL_M = {
  park: 90,
  garden: 70,
  viewpoint: 60,
  plaza: 55,
  market: 45,
  default: 40,
};

// coords.accuracy is a 68%-confidence radius, not a guarantee. In an old town it
// is routinely over 100m, and "within 40m of the church" is then meaningless.
// Rather than pretend, auto-advance stands down above this and the walker taps
// the button — which is why that button is not a fallback but a first-class
// control.
export const MAX_ACCURACY_M = 75;

// Two qualifying fixes in a row before advancing, so a single wild reading can't
// tick off a stop the walker never reached.
export const CONFIRM_FIXES = 2;

// Average walking pace, metres per minute (~4.5 km/h). Only used for the "x min"
// hint, never for anything that decides state.
const PACE_M_PER_MIN = 75;

const STORE_KEY = 'rtg:walk';

export function metersBetween(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function arrivalRadiusFor(type) {
  return ARRIVAL_M[type] ?? ARRIVAL_M.default;
}

// Should this fix count as arriving at `target`? Carries the streak of
// consecutive qualifying fixes so the caller can stay dumb about the history.
// `reason` exists so the UI can say WHY it isn't advancing — "buscando señal"
// and "estás a 300 m" are different messages, and a walker staring at a screen
// that does nothing deserves to know which one applies.
export function evaluateFix(fix, target, streak = 0) {
  if (!fix || !target) return { arrived: false, streak: 0, distance: null, reason: 'no-fix' };

  const distance = metersBetween(fix.lat, fix.lng, target.lat, target.lng);

  // Deliberately explicit about the type. `!(accuracy <= MAX)` looks like it
  // rejects everything unusable, and it does for undefined and NaN — but `null`
  // coerces to 0 and sails straight through as a perfect fix. A missing accuracy
  // must be treated as no information, never as certainty.
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > MAX_ACCURACY_M) {
    return { arrived: false, streak: 0, distance, reason: 'accuracy' };
  }
  if (distance > arrivalRadiusFor(target.type)) {
    return { arrived: false, streak: 0, distance, reason: 'far' };
  }

  const next = streak + 1;
  return { arrived: next >= CONFIRM_FIXES, streak: next, distance, reason: 'near' };
}

export function walkingMinutes(meters) {
  if (!(meters >= 0)) return null;
  return Math.max(1, Math.round(meters / PACE_M_PER_MIN));
}

export function formatMeters(meters) {
  if (!(meters >= 0)) return null;
  return meters < 1000
    ? `${Math.round(meters / 5) * 5} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

// Stable id for a route, so progress belongs to the route and not to the session:
// close the app halfway through and reopening the same route resumes it, while
// building a different route starts clean. Same stop signature RoutesContext
// uses, hashed only to keep localStorage tidy.
export function walkId(places) {
  const sig = (places || []).map((p) => `${p.name}|${p.lat}|${p.lng}`).join('>');
  let h = 5381;
  for (let i = 0; i < sig.length; i += 1) h = ((h << 5) + h + sig.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// The first stop that is neither visited nor skipped. -1 means the walk is done.
export function nextStopIndex(total, done) {
  const seen = done instanceof Set ? done : new Set(done || []);
  for (let i = 0; i < total; i += 1) if (!seen.has(i)) return i;
  return -1;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// localStorage throws in Safari private mode and is absent server-side, and a
// walk must never fail to start because progress couldn't be written.
export function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage();
    const probe = '__rtg_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

// One active walk at a time: an id mismatch means this is a different route, so
// the stored progress is not ours and is ignored rather than migrated.
export function loadWalk(id, storage) {
  try {
    const raw = (storage || safeStorage()).getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.id !== id || !Array.isArray(data.visited)) return null;
    return {
      id,
      visited: data.visited.filter((n) => Number.isInteger(n) && n >= 0),
      skipped: Array.isArray(data.skipped) ? data.skipped.filter((n) => Number.isInteger(n) && n >= 0) : [],
      startedAt: Number.isFinite(data.startedAt) ? data.startedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveWalk(id, { visited, skipped, startedAt }, storage) {
  try {
    (storage || safeStorage()).setItem(
      STORE_KEY,
      JSON.stringify({
        id,
        visited: [...(visited || [])],
        skipped: [...(skipped || [])],
        startedAt: startedAt ?? null,
      })
    );
  } catch { /* progress is a convenience, never a blocker */ }
}

export function clearWalk(storage) {
  try {
    (storage || safeStorage()).removeItem(STORE_KEY);
  } catch { /* ignore */ }
}

// Per-leg directions: this stop only, from wherever the walker actually is. No
// waypoints, so this can never hit the waypoint cap the whole-route link has to
// live with.
export function legDirectionsUrl(from, stop) {
  if (!stop) return null;
  const dest = `${stop.lat},${stop.lng}`;
  const origin = from ? `&origin=${from.lat},${from.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}&travelmode=walking`;
}
