import { useTrip } from '../../context/TripContext';
import CitySearch from './CitySearch';
import Icon from '../ui/Icon';

export default function LocationPicker() {
  const { locationMode, setLocationMode } = useTrip();

  return (
    <div className="location-picker">
      <div className="location-tabs">
        <button
          className={`tab${locationMode === 'gps' ? ' active' : ''}`}
          onClick={() => setLocationMode('gps')}
        >
          <Icon name="pin" size={15} /> Mi ubicación
        </button>
        <button
          className={`tab${locationMode === 'search' ? ' active' : ''}`}
          onClick={() => setLocationMode('search')}
        >
          <Icon name="search" size={15} /> Buscar ciudad
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
