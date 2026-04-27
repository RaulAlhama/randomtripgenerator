import { MODE_LABELS } from '../../constants/transport';
import { formatDuration } from '../../context/TripContext';

const THEME_ICONS = {
  monuments: '\u{1F3DB}️',
  nature: '\u{1F333}',
  food: '\u{1F37D}️',
  historical: '\u{1F4DC}',
  cultural: '\u{1F3AD}',
  gastro: '\u{1F37D}️',
  classic: '\u{1F3DB}️',
  surprise: '\u{2728}',
};

export default function TripCard({ trip, onDelete, onView }) {
  const placesArr = trip.places || [];
  const distKm = trip.route_distance ? (trip.route_distance / 1000).toFixed(1) : '?';
  const durText = trip.route_duration ? formatDuration(trip.route_duration) : '?';
  const dateStr = new Date(trip.created_at).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const themeIcon = THEME_ICONS[trip.theme] || THEME_ICONS.monuments;
  const modeLabel = MODE_LABELS[trip.transport_mode] || MODE_LABELS.driving;

  const handleCardClick = () => {
    onView(trip);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(trip.id);
  };

  return (
    <div
      className="saved-trip-card"
      data-theme-kind={trip.theme || 'classic'}
      onClick={handleCardClick}
    >
      <div className="saved-trip-cover">
        <span className="saved-trip-theme-large" aria-hidden="true">{themeIcon}</span>
      </div>
      <div className="saved-trip-body">
        <div className="saved-trip-header">
          <h4>
            {trip.city || 'Desconocida'}
            {trip.country ? `, ${trip.country}` : ''}
          </h4>
          <button
            className="btn-icon btn-delete-trip"
            title="Eliminar viaje"
            onClick={handleDeleteClick}
            aria-label="Eliminar viaje"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
        <div className="saved-trip-meta">
          <span className="saved-meta-pill">{modeLabel}</span>
          <span className="saved-meta-pill">{distKm} km</span>
          <span className="saved-meta-pill">{durText}</span>
        </div>
        <div className="saved-trip-places">
          {placesArr.slice(0, 3).map((p) => p.name).join(' → ')}
          {placesArr.length > 3 ? ' ...' : ''}
        </div>
        <div className="saved-trip-date">{dateStr}</div>
      </div>
    </div>
  );
}
