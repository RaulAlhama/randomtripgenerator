import { useTrip, formatDuration } from '../../context/TripContext';
import { MODE_LABELS } from '../../constants/transport';

export default function RouteOverlay() {
  const { routeDistance, routeDuration, selectedTransport } = useTrip();

  if (!routeDistance) return null;

  const distanceKm = (routeDistance / 1000).toFixed(1);
  const durationText = formatDuration(routeDuration);
  const modeLabel = MODE_LABELS[selectedTransport] || selectedTransport;

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
        <span className="stat-value stat-value-sm">{modeLabel}</span>
      </div>
    </div>
  );
}
