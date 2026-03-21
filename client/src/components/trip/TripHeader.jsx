import { useTrip } from '../../context/TripContext';

function buildGoogleMapsUrl(trip) {
  const { origin, places, transport } = trip;
  if (!origin || !places?.length) return null;

  const modeMap = { driving: 'driving', walking: 'walking', cycling: 'bicycling' };
  const travelmode = modeMap[transport] || 'driving';

  const destination = places[places.length - 1];
  const waypoints = places.slice(0, -1).map(p => `${p.lat},${p.lng}`).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`;
  if (waypoints) url += `&waypoints=${waypoints}`;

  return url;
}

export default function TripHeader() {
  const { currentTrip, shareTrip, closeTrip } = useTrip();

  const city = currentTrip?.city || 'la zona';
  const gmapsUrl = currentTrip ? buildGoogleMapsUrl(currentTrip) : null;

  return (
    <div className="section-header">
      <h2>
        Tu Ruta en <span className="gradient-text">{city}</span>
      </h2>
      <div className="section-actions">
        {gmapsUrl && (
          <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-gmaps" title="Abrir en Google Maps">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            Google Maps
          </a>
        )}
        <button className="btn btn-sm btn-share" title="Compartir ruta" onClick={shareTrip}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
          Compartir
        </button>
        <button className="btn-icon" aria-label="Cerrar ruta" onClick={closeTrip}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
