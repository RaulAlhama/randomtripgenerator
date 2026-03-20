import { useTrip } from '../../context/TripContext';
import TripHeader from './TripHeader';
import POIWarning from './POIWarning';
import WeatherWidget from './WeatherWidget';
import MapView from './MapView';
import PlacesPanel from './PlacesPanel';

export default function TripResult() {
  const { currentTrip } = useTrip();

  if (!currentTrip) return null;

  return (
    <section className="trip-result">
      <TripHeader />
      <POIWarning />
      <WeatherWidget />
      <div className="trip-grid">
        <MapView />
        <PlacesPanel />
      </div>
    </section>
  );
}
