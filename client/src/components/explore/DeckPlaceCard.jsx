import { useEffect, useRef, useState } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';
import SaveHeart from './SaveHeart';

async function resolvePlaceImage(name, city, type) {
  try {
    const params = new URLSearchParams({ name, city: city || '', type: type || '' });
    const res = await fetch(`/api/place-image?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch (_) {
    return null;
  }
}

// One full-screen place card in the swipe deck. Included by default; the
// action toggles it out of (or back into) the route.
// readOnly: render the card as a passive detail view (no add/remove action,
// no "out of route" badge) — used when reopening a stop from the built route.
export default function DeckPlaceCard({ place, city, selected, onToggle, distanceKm, readOnly = false }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgError, setImgError] = useState(false);

  // "Ver más": clamp long descriptions and only offer the toggle when the text
  // actually overflows the 3-line clamp.
  const descRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    setExpanded(false);
    const el = descRef.current;
    if (!el) { setOverflows(false); return; }
    // Measure in the clamped state (default), so scrollHeight > clientHeight
    // means there's hidden text worth a "Ver más".
    setOverflows(el.scrollHeight - el.clientHeight > 4);
  }, [place.description]);

  useEffect(() => {
    setImgError(false);
    setImageUrl(place.imageUrl || null);
    if (place.imageUrl) return;
    let cancelled = false;
    resolvePlaceImage(place.name, city, place.type).then((url) => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [place.name, place.imageUrl, place.type, city]);

  const showImage = imageUrl && !imgError;
  const distanceLabel = distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceKm.toFixed(1)} km`;
  const hasRating = typeof place.rating === 'number' && place.rating > 0;

  return (
    <article className={`xp-dcard${selected ? ' is-on' : ' is-off'}`}>
      <div className="xp-dcard-photo">
        {showImage ? (
          <img src={imageUrl} alt="" onError={() => setImgError(true)} />
        ) : (
          <span className="xp-dcard-photo-icon" aria-hidden="true">{icon}</span>
        )}
        <div className="xp-dcard-scrim" />
        <span className="xp-dcard-type">{typeLabels[place.type] || typeLabels.default}</span>
        <SaveHeart
          item={{
            kind: 'place',
            name: place.name,
            lat: place.lat,
            lng: place.lng,
            type: place.type,
            city,
            imageUrl: imageUrl || place.imageUrl || null,
            rating: place.rating ?? null,
            description: place.description || null,
          }}
        />
        {!selected && !readOnly && <span className="xp-dcard-removed">Fuera de la ruta</span>}
      </div>

      <div className="xp-dcard-body">
        <h3 className="xp-dcard-name">{place.name}</h3>
        <div className="xp-dcard-meta">
          <span className="xp-dcard-distance">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {distanceLabel}
          </span>
          {hasRating && <span className="xp-dcard-rating">★ {place.rating.toFixed(1)}</span>}
        </div>
        {place.description && (
          <div className="xp-dcard-desc-wrap">
            <p ref={descRef} className={`xp-dcard-desc${expanded ? ' is-expanded' : ''}`}>
              {place.description}
            </p>
            {(overflows || expanded) && (
              <button
                type="button"
                className="xp-dcard-more"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
              >
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        )}

        {!readOnly && (
          <button
            type="button"
            className={`xp-dcard-action${selected ? '' : ' is-add'}`}
            onClick={onToggle}
            aria-pressed={selected}
          >
            {selected ? (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Quitar de la ruta
              </>
            ) : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Volver a añadir
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
