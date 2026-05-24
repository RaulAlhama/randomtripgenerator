import { useEffect, useState } from 'react';
import { typeIcons } from '../../constants/poi';
import { useTrip } from '../../context/TripContext';

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

export default function CandidateCard({ place, typeLabel, distanceKm, selected, onToggle }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const { currentTrip } = useTrip();
  const city = currentTrip?.city || '';

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

  return (
    <button
      type="button"
      className={`candidate-card${selected ? ' is-selected' : ' is-deselected'}`}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <div className="candidate-thumb">
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="candidate-thumb-placeholder" aria-hidden="true">{icon}</div>
        )}
      </div>

      <div className="candidate-body">
        <span className="candidate-type">{typeLabel}</span>
        <div className="candidate-name">{place.name}</div>
        {place.description && (
          <p className="candidate-desc">{place.description}</p>
        )}
        <div className="candidate-meta">
          <span className="candidate-distance">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {distanceLabel}
          </span>
          {typeof place.rating === 'number' && place.rating > 0 && (
            <span className="candidate-rating">
              <span aria-hidden="true">★</span> {place.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className={`candidate-toggle${selected ? ' is-on' : ''}`} aria-hidden="true">
        {selected ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </div>
    </button>
  );
}
