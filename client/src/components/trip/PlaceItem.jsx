import { useState, useEffect } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';
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

function todayHours(openingHours) {
  if (!Array.isArray(openingHours) || openingHours.length === 0) return null;
  // Google returns weekday_text starting on Monday (index 0 = Monday)
  const jsDay = new Date().getDay(); // 0 = Sunday
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  const line = openingHours[idx];
  if (!line) return null;
  const colon = line.indexOf(':');
  const value = (colon >= 0 ? line.slice(colon + 1) : line).trim();
  // Hide redundant single-word states (Cerrado/Closed/Abierto 24 horas) — covered by openNow pill
  if (/^(cerrado|closed)$/i.test(value)) return null;
  return value;
}

export default function PlaceItem({ place, index }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const label = typeLabels[place.type] || typeLabels.default;
  const { currentTrip } = useTrip();
  const city = currentTrip?.city || '';

  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    setImageUrl(place.imageUrl || null);

    if (place.imageUrl) return;

    let cancelled = false;
    resolvePlaceImage(place.name, city, place.type).then(url => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [place.name, place.imageUrl, place.type, city]);

  const showImage = imageUrl && !imgError;
  const hasRating = typeof place.rating === 'number' && place.rating > 0;
  const todayLine = todayHours(place.openingHours);
  const gmapsUrl = place.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${city}`)}`;

  return (
    <div className="poi-item" style={{ '--i': index }}>
      <div className="poi-number">{index + 1}</div>
      <div className="poi-content">
        <div className={`poi-image-wrapper${!showImage ? ' poi-image-empty' : ''}`}>
          {showImage ? (
            <img
              src={imageUrl}
              alt={place.name}
              className={`poi-image${imgLoaded ? ' loaded' : ''}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="poi-image-placeholder">
              <span>{icon}</span>
            </div>
          )}
        </div>
        <span className="poi-type">{label}</span>
        <div className="poi-name">{place.name}</div>

        {(hasRating || place.openNow != null) && (
          <div className="poi-rating-row">
            {hasRating && (
              <span className="poi-rating">
                <span className="poi-stars" aria-hidden="true">★</span>
                <span className="poi-rating-value">{place.rating.toFixed(1)}</span>
                {place.userRatingsTotal != null && (
                  <span className="poi-rating-count">({place.userRatingsTotal})</span>
                )}
              </span>
            )}
            {place.openNow === true && <span className="poi-open">Abierto</span>}
            {place.openNow === false && <span className="poi-closed">Cerrado</span>}
          </div>
        )}

        {place.description && (
          <div className="poi-description">{place.description}</div>
        )}

        {(place.phone || place.website || place.openingHours || place.placeId) && (
          <div className="poi-meta">
            {place.phone && (
              <a href={`tel:${place.phone.replace(/\s+/g, '')}`} className="poi-meta-item" title="Llamar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {place.phone}
              </a>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" className="poi-meta-item" title="Web oficial">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Web
              </a>
            )}
            {todayLine && (
              <button
                type="button"
                className="poi-meta-item poi-meta-button"
                onClick={() => setHoursOpen((v) => !v)}
                title="Ver horarios"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {todayLine}
              </button>
            )}
            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="poi-meta-item" title="Abrir en Google Maps">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Maps
            </a>
          </div>
        )}

        {hoursOpen && Array.isArray(place.openingHours) && (
          <ul className="poi-hours-list">
            {place.openingHours.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
