import { useTrip, formatDuration } from '../../context/TripContext';
import { TRANSPORTS } from '../../constants/transport';
import { TRANSPORT_ICONS } from '../hero/transportIcons';

export default function RouteOverlay() {
  const { routeDistance, routeDuration, selectedTransport } = useTrip();

  if (!routeDistance) return null;

  const distanceKm = (routeDistance / 1000).toFixed(1);
  const durationText = formatDuration(routeDuration);
  const transportDef = TRANSPORTS.find((t) => t.key === selectedTransport);
  const modeLabel = transportDef?.label || selectedTransport;

  return (
    <div className="route-overlay">
      <div className="route-stat">
        <span className="stat-label">Distancia</span>
        <span className="stat-value">{distanceKm} km</span>
      </div>
      <div className="route-stat">
        <span className="stat-label">Duraci&oacute;n</span>
        <span className="stat-value">{durationText}</span>
      </div>
      <div className="route-stat">
        <span className="stat-label">Modo</span>
        <span className="stat-value stat-value-sm stat-value-with-icon">
          <span className="stat-icon" aria-hidden="true">{TRANSPORT_ICONS[selectedTransport]}</span>
          {modeLabel}
        </span>
      </div>
    </div>
  );
}
