import { TRANSPORTS } from '../../constants/transport';
import { formatDuration } from '../../context/TripContext';
import { TRANSPORT_ICONS } from '../hero/transportIcons';
import Icon from '../ui/Icon';

const THEME_ICON_NAMES = {
  monuments: 'monuments',
  nature: 'leaf',
  food: 'fork',
  historical: 'historical',
  cultural: 'cultural',
  gastro: 'fork',
  classic: 'classic',
  surprise: 'surprise',
  mixed: 'sparkle',
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
  const themeIconName = THEME_ICON_NAMES[trip.theme] || 'sparkle';
  const transportKey = trip.transport_mode || 'driving';
  const transportDef = TRANSPORTS.find((t) => t.key === transportKey);
  const modeLabel = transportDef?.label || transportKey;

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
        <span className="saved-trip-theme-large" aria-hidden="true">
          <Icon name={themeIconName} size={42} strokeWidth={1.5} />
        </span>
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
          <span className="saved-meta-pill saved-meta-pill-icon">
            <span aria-hidden="true">{TRANSPORT_ICONS[transportKey]}</span>
            {modeLabel}
          </span>
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
