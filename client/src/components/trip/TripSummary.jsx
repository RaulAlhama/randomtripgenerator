import { useTrip, formatDuration } from '../../context/TripContext';

export default function TripSummary() {
  const { routeDistance, routeDuration } = useTrip();

  const distanceKm = routeDistance ? (routeDistance / 1000).toFixed(1) : '-';
  const durationText = routeDuration ? formatDuration(routeDuration) : '-';

  return (
    <div className="trip-summary">
      <h4>Resumen del Viaje</h4>
      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-label">Distancia Total</span>
          <span className="summary-value">{distanceKm} km</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Tiempo Est.</span>
          <span className="summary-value">{durationText}</span>
        </div>
      </div>
    </div>
  );
}
