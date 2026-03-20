import { useTrip } from '../../context/TripContext';
import PlaceItem from './PlaceItem';
import TripSummary from './TripSummary';

export default function PlacesPanel() {
  const { currentTrip } = useTrip();

  const places = currentTrip?.places || [];

  return (
    <div className="places-panel">
      <h3 className="places-title">
        <span className="places-icon">&#x1F3AF;</span>
        Lugares Sugeridos
      </h3>
      <div className="poi-list">
        {places.map((place, index) => (
          <PlaceItem key={`${place.name}-${index}`} place={place} index={index} />
        ))}
      </div>
      <TripSummary />
    </div>
  );
}
