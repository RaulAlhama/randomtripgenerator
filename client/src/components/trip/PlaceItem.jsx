import { useState, useEffect } from 'react';
import { typeIcons, typeLabels } from '../../constants/poi';
import { useTrip } from '../../context/TripContext';

const FOOD_TYPES = new Set(['restaurant', 'market']);

async function resolveWikipediaImage(place) {
  if (place.imageUrl) return place.imageUrl;

  if (place.wikipedia) {
    try {
      const parts = place.wikipedia.split(':');
      const lang = parts.length > 1 ? parts[0] : 'es';
      const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      const data = await res.json();
      if (data.thumbnail?.source) return data.thumbnail.source;
    } catch (_) { /* ignore */ }
  }

  try {
    const res = await fetch(
      `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(place.name)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*`
    );
    const data = await res.json();
    const pages = data.query?.pages;
    if (pages) {
      const first = Object.values(pages)[0];
      if (first?.thumbnail?.source) return first.thumbnail.source;
    }
  } catch (_) { /* ignore */ }

  return null;
}

async function resolveGoogleImage(name, city) {
  try {
    const res = await fetch(
      `/api/place-image?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city || '')}`
    );
    const data = await res.json();
    return data.url || null;
  } catch (_) {
    return null;
  }
}

export default function PlaceItem({ place, index }) {
  const icon = typeIcons[place.type] || typeIcons.default;
  const label = typeLabels[place.type] || typeLabels.default;
  const { currentTrip } = useTrip();
  const city = currentTrip?.city || '';
  const isFoodType = FOOD_TYPES.has(place.type);

  const [imageUrl, setImageUrl] = useState(place.imageUrl || null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (imageUrl) return;
    let cancelled = false;
    const resolve = isFoodType
      ? resolveGoogleImage(place.name, city)
      : resolveWikipediaImage(place);
    resolve.then(url => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [place.name, place.wikipedia, place.imageUrl, isFoodType, city]);

  return (
    <div className="poi-item">
      <div className="poi-number">{index + 1}</div>
      <div className="poi-content">
        <div className={`poi-image-wrapper${!imageUrl || imgError ? ' poi-image-empty' : ''}`}>
          {imageUrl && !imgError ? (
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
        <div className="poi-name">{place.name}</div>
        <div className="poi-type">{label}</div>
        {place.description && (
          <div className="poi-description">{place.description}</div>
        )}
      </div>
    </div>
  );
}
