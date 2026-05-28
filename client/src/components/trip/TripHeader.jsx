import { useTrip, formatDuration } from '../../context/TripContext';
import { THEMES } from '../../constants/themes';
import { TRANSPORTS } from '../../constants/transport';
import { TRANSPORT_ICONS } from '../hero/transportIcons';
import Icon from '../ui/Icon';

function buildGoogleMapsUrl(trip, transportKey) {
  const places = trip?.places || [];
  if (trip?.origin_lat == null || !places.length) return null;

  const modeMap = { driving: 'driving', walking: 'walking', cycling: 'bicycling' };
  const travelmode = modeMap[transportKey] || 'driving';

  const destination = places[places.length - 1];
  const waypoints = places.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${trip.origin_lat},${trip.origin_lng}&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`;
  if (waypoints) url += `&waypoints=${waypoints}`;

  return url;
}

export default function TripHeader() {
  const {
    currentTrip,
    shareTrip,
    closeTrip,
    routeDistance,
    routeDuration,
    selectedTheme,
    selectedTransport,
    stage,
    candidates,
    backToCandidates,
    hikingTrails,
  } = useTrip();

  if (!currentTrip) return null;

  // Hiking mode gets its own compact header — there's no "city + theme +
  // transport" trio to summarise, just a count of trails and a close button.
  if (currentTrip.trip_type === 'hiking') {
    const trailCount = hikingTrails?.length || 0;
    return (
      <div className="trip-cover" data-theme-kind="hiking">
        <div className="trip-cover-title">
          <h2>Senderos cercanos</h2>
          <div className="trip-cover-meta">
            <span className="trip-meta-pill trip-meta-count">
              <Icon name="leaf" size={12} strokeWidth={2.2} />
              {trailCount} {trailCount === 1 ? 'sendero' : 'senderos'}
            </span>
          </div>
        </div>
        <div className="trip-cover-actions">
          <button className="btn-icon" aria-label="Cerrar" onClick={closeTrip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const city = currentTrip.city || 'la zona';
  const country = currentTrip.country || '';
  const themeKind = currentTrip.theme || selectedTheme || 'mixed';
  const transportKey = currentTrip.transport || selectedTransport || 'driving';
  // 'mixed' is the default catch-all — no need to render a pill for it.
  const themeDef = themeKind === 'mixed' ? null : THEMES.find((t) => t.key === themeKind);
  const transportDef = TRANSPORTS.find((t) => t.key === transportKey);
  const canEditSelection = stage === 'route' && Array.isArray(candidates) && candidates.length > 0;

  const distanceKm = routeDistance ? (routeDistance / 1000).toFixed(1) : null;
  const durationText = routeDuration ? formatDuration(routeDuration) : null;

  const isRouteStage = stage !== 'candidates';
  const gmapsUrl = isRouteStage ? buildGoogleMapsUrl(currentTrip, transportKey) : null;
  const placesCount = currentTrip.places?.length || 0;
  const placesLabel = isRouteStage ? 'paradas' : 'candidatos';

  return (
    <div className="trip-cover" data-theme-kind={themeKind}>
      <div className="trip-cover-title">
        <h2>
          {city}
          {country && <>, <em>{country}</em></>}
        </h2>
        <div className="trip-cover-meta">
          <span className="trip-meta-pill trip-meta-count">
            <Icon name="sparkle" size={12} strokeWidth={2.2} />
            {placesCount} {placesLabel}
          </span>
          {themeDef && (
            <span className="trip-meta-pill">
              <Icon name={themeDef.iconName} size={13} strokeWidth={2} />
              {themeDef.label}
            </span>
          )}
          {transportDef && (
            <span className="trip-meta-pill">
              <span className="trip-meta-pill-icon" aria-hidden="true">{TRANSPORT_ICONS[transportKey]}</span>
              {transportDef.label}
            </span>
          )}
          {distanceKm && (
            <span className="trip-meta-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
              </svg>
              {distanceKm} km
            </span>
          )}
          {durationText && (
            <span className="trip-meta-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {durationText}
            </span>
          )}
        </div>
      </div>

      <div className="trip-cover-actions">
        {canEditSelection && (
          <button className="btn btn-sm" onClick={backToCandidates} title="Volver a la lista de candidatos">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Editar selección
          </button>
        )}
        {gmapsUrl && (
          <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            Maps
          </a>
        )}
        {isRouteStage && (
          <button className="btn btn-sm" onClick={shareTrip}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
            Compartir
          </button>
        )}
        <button className="btn-icon" aria-label="Cerrar ruta" onClick={closeTrip}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
