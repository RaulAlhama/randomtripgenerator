import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckPlaceCard from './DeckPlaceCard';
import { track } from '../../services/analytics';
import {
  evaluateFix, formatMeters, walkingMinutes, legDirectionsUrl,
  walkId, loadWalk, saveWalk, clearWalk, nextStopIndex, metersBetween,
} from '../../lib/walk';

// The companion for an actual walk. Google Maps gets you down the street; this
// says what you're standing in front of, and keeps your place in the route.
//
// What it deliberately does NOT do: turn-by-turn, re-routing, map rotation or
// holding the screen awake. A web page does all of those badly and needs
// background geolocation it cannot have. Instead the position watch stops when
// the page is hidden and resumes when it returns — which is the exact shape of
// "I tapped through to Maps for this leg and came back", and costs no battery in
// between. No wake lock, no re-routing, so no extra API budget either.
//
// It also adds the number the funnel never had: gmaps_opened was the last event
// we could see, so nobody knew whether a single route was ever actually walked.

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function WalkMode({ places, city, origin, routeDistance = null, onClose }) {
  const id = useMemo(() => walkId(places), [places]);
  const total = places.length;

  // Resume the same route where it was left; a different route starts clean.
  const [progress, setProgress] = useState(() => {
    const stored = loadWalk(id);
    return {
      visited: new Set(stored?.visited || []),
      skipped: new Set(stored?.skipped || []),
    };
  });
  // What the last fix told us: kept as one object so the status line can never
  // show a distance from one reading and a reason from another.
  const [signal, setSignal] = useState(null);
  const [position, setPosition] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [justArrived, setJustArrived] = useState(null);

  const startedAtRef = useRef(loadWalk(id)?.startedAt || Date.now());
  const streakRef = useRef(0);

  const done = useMemo(
    () => new Set([...progress.visited, ...progress.skipped]),
    [progress]
  );
  const index = nextStopIndex(total, done);
  const complete = index === -1;
  const stop = complete ? null : places[index];

  useEffect(() => {
    track('walk_started', { city, stops: total });
  }, [city, total]);

  // Persist every change: the walk must survive the phone locking, the tab being
  // evicted, and the round trip to Google Maps.
  useEffect(() => {
    saveWalk(id, { ...progress, startedAt: startedAtRef.current });
  }, [id, progress]);

  // The effects below keep advanceRef pointing at the current closure, so this
  // can read `index` from the render instead of recomputing it inside the state
  // updater — an updater must stay pure, and React is free to run it twice.
  const advance = useCallback((how) => {
    if (index === -1) return;
    track('walk_stop_reached', { city, index: index + 1, how });
    if (how !== 'skip') setJustArrived(places[index]?.name || null);
    setProgress((p) => (how === 'skip'
      ? { visited: p.visited, skipped: new Set(p.skipped).add(index) }
      : { visited: new Set(p.visited).add(index), skipped: p.skipped }));
    streakRef.current = 0;
    // The distance to the NEXT stop is unknown until the next reading, and
    // showing the previous one for a second would be a lie about where you are.
    setSignal(null);
  }, [index, city, places]);

  // The watch callback needs the current target and the current advance without
  // re-subscribing every time either changes — a new watch per render would
  // restart the GPS constantly and drain the battery this design exists to save.
  const stopRef = useRef(stop);
  const advanceRef = useRef(advance);
  useEffect(() => { stopRef.current = stop; }, [stop]);
  useEffect(() => { advanceRef.current = advance; }, [advance]);
  // A new target is a new decision: never carry the previous stop's streak in.
  useEffect(() => { streakRef.current = 0; }, [index]);

  // One watch, alive only while this screen is visible.
  useEffect(() => {
    if (complete) return undefined;
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no comparte la ubicación. Marca las paradas a mano.');
      return undefined;
    }

    let watchId = null;

    const onFix = (pos) => {
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setGeoError(null);
      setPosition(fix);
      // Evaluated once per reading, here — not during render, where React is free
      // to recompute a memo and could count the same fix twice.
      const verdict = evaluateFix(fix, stopRef.current, streakRef.current);
      streakRef.current = verdict.streak;
      setSignal({ ...verdict, accuracy: fix.accuracy });
      if (verdict.arrived) advanceRef.current('auto');
    };

    const start = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(
        onFix,
        () => setGeoError('No podemos seguir tu posición. Marca las paradas a mano.'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    };
    const stopWatch = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };
    const onVisibility = () => (document.hidden ? stopWatch() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopWatch();
    };
  }, [complete]);

  useEffect(() => {
    if (!justArrived) return undefined;
    const t = setTimeout(() => setJustArrived(null), 4000);
    return () => clearTimeout(t);
  }, [justArrived]);

  const finishedRef = useRef(false);
  useEffect(() => {
    if (!complete || finishedRef.current) return;
    finishedRef.current = true;
    track('walk_completed', { city, stops: total, skipped: progress.skipped.size });
    // Dropped as soon as it's done, not on the way out: a finished record left on
    // the device makes the next tap on "Empezar el paseo" open a summary instead
    // of a walk. The screen below still shows it — this only stops it outliving
    // the session it belongs to.
    clearWalk();
  }, [complete, city, total, progress.skipped]);

  const restart = () => {
    clearWalk();
    startedAtRef.current = Date.now();
    finishedRef.current = false;
    streakRef.current = 0;
    setSignal(null);
    setProgress({ visited: new Set(), skipped: new Set() });
  };

  const handleClose = () => {
    // Progress lives on the device, so closing is pausing — except once the walk
    // is over, where leaving the record behind would "resume" a finished route.
    if (complete) clearWalk();
    onClose();
  };

  if (complete) {
    // The route's own distance, the same number the route screen shows. Summing
    // straight lines between stops here instead would print a smaller figure for
    // the same walk on the very next screen, which reads as a bug rather than as
    // the different measurement it is.
    const walked = routeDistance != null ? formatMeters(routeDistance) : null;
    return (
      <div className="xp-walk" role="dialog" aria-modal="true" aria-label="Paseo completado">
        <div className="xp-walk-done">
          <p className="xp-walk-done-kicker">Paseo completado</p>
          <h2>
            {progress.visited.size} de {total} paradas
            {city ? <><br />en {city}</> : null}
          </h2>
          <p className="xp-walk-done-note">
            {walked && <>Ruta de {walked} a pie</>}
            {progress.skipped.size > 0 && (
              /* Non-breaking space: "· 1" and "saltada" were splitting across
                 lines, leaving a stray number at the end of a line. */
              <>{walked ? ' · ' : ''}{progress.skipped.size}{' '}saltada{progress.skipped.size === 1 ? '' : 's'}</>
            )}
            {(walked || progress.skipped.size > 0) && '. '}
            La ruta se queda guardada en tu dispositivo.
          </p>
          <div className="xp-walk-done-actions">
            <button type="button" className="xp-cta" onClick={handleClose}>Volver a la ruta</button>
            <button type="button" className="xp-ghost-btn" onClick={restart}>Repetir el paseo</button>
          </div>
        </div>
      </div>
    );
  }

  const doneCount = progress.visited.size + progress.skipped.size;
  const distanceLabel = signal?.distance != null ? formatMeters(signal.distance) : null;

  // Why the screen is doing what it's doing. A companion that just sits there
  // silently is the worst outcome, so every state below explains itself.
  let status;
  if (geoError) status = geoError;
  else if (!signal) status = 'Buscando tu posición…';
  else if (signal.reason === 'accuracy') status = `Señal imprecisa (±${Math.round(signal.accuracy)} m) · marca la parada a mano`;
  else if (signal.reason === 'near') status = 'Ya casi · confirmando que has llegado';
  else status = `A ${distanceLabel} · unos ${walkingMinutes(signal.distance)} min andando`;

  return (
    <div className="xp-walk" role="dialog" aria-modal="true" aria-label="Paseo en curso">
      <div className="xp-walk-top">
        <button type="button" className="xp-top-btn" onClick={handleClose} aria-label="Salir del paseo">
          <BackIcon />
        </button>
        <div className="xp-walk-progress">
          <span className="xp-walk-count">Parada {index + 1} de {total}</span>
          {/* A rule that fills, not a bar inside a box: same language as the rest
              of the app, which has been losing its rounded containers. */}
          <span className="xp-walk-bar" aria-hidden="true">
            <span style={{ width: `${(doneCount / total) * 100}%` }} />
          </span>
        </div>
      </div>

      {/* Announced, not merely shown: the walker is looking at the street, and a
          screen reader user gets nothing from a banner that fades on its own. */}
      <p className="xp-walk-live" role="status" aria-live="polite">
        {justArrived ? `Has llegado a ${justArrived}` : ''}
      </p>

      <div className="xp-walk-card">
        <DeckPlaceCard
          place={stop}
          city={city}
          selected
          readOnly
          distanceKm={(signal?.distance
            ?? (origin ? metersBetween(origin.lat, origin.lng, stop.lat, stop.lng) : 0)) / 1000}
        />
      </div>

      <div className="xp-walk-foot">
        <p className={`xp-walk-status${signal?.reason === 'near' ? ' is-near' : ''}`}>{status}</p>
        <a
          className="xp-cta"
          href={legDirectionsUrl(position || origin, stop)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('gmaps_leg_opened', { city, index: index + 1 })}
        >
          Llévame a esta parada
        </a>
        <div className="xp-walk-secondary">
          <button type="button" className="xp-ghost-btn" onClick={() => advance('manual')}>
            Ya estoy aquí
          </button>
          <button type="button" className="xp-ghost-btn" onClick={() => advance('skip')}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
