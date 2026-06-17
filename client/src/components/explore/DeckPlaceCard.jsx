import { useEffect, useState } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';

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
export default function DeckPlaceCard({ place, city, selected, onToggle, distanceKm }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgError, setImgError] = useState(false);

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
        {!selected && <span className="xp-dcard-removed">Fuera de la ruta</span>}
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
        {place.description && <p className="xp-dcard-desc">{place.description}</p>}

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
      </div>
    </article>
  );
}
