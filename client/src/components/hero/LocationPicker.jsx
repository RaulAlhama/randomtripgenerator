import { useTrip } from '../../context/TripContext';
import CitySearch from './CitySearch';

export default function LocationPicker() {
  const { locationMode, setLocationMode } = useTrip();

  return (
    <div className="location-picker">
      <div className="location-tabs">
        <button
          className={`tab${locationMode === 'gps' ? ' active' : ''}`}
          onClick={() => setLocationMode('gps')}
        >
          📍 Mi ubicación
        </button>
        <button
          className={`tab${locationMode === 'search' ? ' active' : ''}`}
          onClick={() => setLocationMode('search')}
        >
          🔍 Buscar ciudad
        </button>
      </div>
      {locationMode === 'search' && (
        <div className="tab-content">
          <CitySearch />
        </div>
      )}
    </div>
  );
}
