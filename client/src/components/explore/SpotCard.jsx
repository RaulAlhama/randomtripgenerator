import { useEffect, useState } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';

async function resolvePlaceImage(name, city, type, lat, lng) {
  try {
    const params = new URLSearchParams({ name, city: city || '', type: type || '' });
    // With coordinates the server can reject same-named places across town.
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }
    const res = await fetch(`/api/place-image?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch (_) {
    return null;
  }
}

export default function SpotCard({ place, city, selected, onToggle, distanceKm, innerRef, highlighted }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setImageUrl(place.imageUrl || null);
    if (place.imageUrl) return;

    let cancelled = false;
    resolvePlaceImage(place.name, city, place.type, place.lat, place.lng).then((url) => {
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
    <article
      ref={innerRef}
      className={`xp-card${selected ? ' is-on' : ''}${highlighted ? ' is-flash' : ''}`}
    >
      <button
        type="button"
        className="xp-card-main"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${place.name}`}
      >
        <div className="xp-card-thumb">
          {showImage ? (
            <img src={imageUrl} alt="" loading="lazy" onError={() => setImgError(true)} />
          ) : (
            <span className="xp-card-thumb-icon" aria-hidden="true">{icon}</span>
          )}
        </div>

        <div className="xp-card-body">
          <span className="xp-card-type">{typeLabels[place.type] || typeLabels.default}</span>
          <span className="xp-card-name">{place.name}</span>
          <span className="xp-card-meta">
            <span className="xp-card-distance">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {distanceLabel}
            </span>
            {hasRating && (
              <span className="xp-card-rating">★ {place.rating.toFixed(1)}</span>
            )}
          </span>
        </div>

        <span className={`xp-card-check${selected ? ' is-on' : ''}`} aria-hidden="true">
          {selected ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </span>
      </button>
    </article>
  );
}
