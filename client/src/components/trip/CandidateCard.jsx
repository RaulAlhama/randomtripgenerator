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

function todayHours(openingHours) {
  if (!Array.isArray(openingHours) || openingHours.length === 0) return null;
  const jsDay = new Date().getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  const line = openingHours[idx];
  if (!line) return null;
  const colon = line.indexOf(':');
  const value = (colon >= 0 ? line.slice(colon + 1) : line).trim();
  if (/^(cerrado|closed)$/i.test(value)) return null;
  return value;
}

export default function CandidateCard({ place, typeLabel, distanceKm, selected, onToggle }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const { currentTrip } = useTrip();
  const city = currentTrip?.city || '';

  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

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
  const todayLine = todayHours(place.openingHours);
  const gmapsUrl = place.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${city}`)}`;

  // Always show the expander: even with minimal data we can show the full
  // description and a Maps link, which is more useful than hiding the button.

  return (
    <article className={`candidate-card${selected ? ' is-selected' : ' is-deselected'}`}>
      <button
        type="button"
        className="candidate-toggle-row"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${place.name}`}
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
            {hasRating && (
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

      <button
        type="button"
        className={`candidate-expand-btn${expanded ? ' is-open' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>{expanded ? 'Menos info' : 'Más info'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="candidate-expanded">
          {place.description && (
            <p className="candidate-desc-full">{place.description}</p>
          )}

          {(hasRating || place.openNow != null) && (
            <div className="candidate-rating-row">
              {hasRating && (
                <span className="candidate-rating-detail">
                  <span className="poi-stars" aria-hidden="true">★</span>
                  <span className="candidate-rating-value">{place.rating.toFixed(1)}</span>
                  {place.userRatingsTotal != null && (
                    <span className="candidate-rating-count">({place.userRatingsTotal} reseñas)</span>
                  )}
                </span>
              )}
              {place.openNow === true && <span className="poi-open">Abierto ahora</span>}
              {place.openNow === false && <span className="poi-closed">Cerrado ahora</span>}
            </div>
          )}

          <div className="candidate-actions">
            {place.phone && (
              <a href={`tel:${place.phone.replace(/\s+/g, '')}`} className="candidate-action" title="Llamar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {place.phone}
              </a>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" className="candidate-action" title="Web oficial">
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
                className="candidate-action candidate-action-button"
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
            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="candidate-action" title="Ver en Google Maps">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Maps
            </a>
            {place.wikipedia && (
              <a
                href={`https://${(place.wikipedia.split(':')[0] || 'es')}.wikipedia.org/wiki/${encodeURIComponent((place.wikipedia.split(':')[1] || place.wikipedia).replace(/ /g, '_'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="candidate-action"
                title="Wikipedia"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Wiki
              </a>
            )}
          </div>

          {hoursOpen && Array.isArray(place.openingHours) && (
            <ul className="candidate-hours-list">
              {place.openingHours.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
