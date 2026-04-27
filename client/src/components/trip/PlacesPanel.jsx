import { useTrip } from '../../context/TripContext';
import PlaceItem from './PlaceItem';

export default function PlacesPanel() {
  const { currentTrip } = useTrip();

  const places = currentTrip?.places || [];

  return (
    <div className="places-panel">
      <h3 className="places-title">
        <span className="places-icon" aria-hidden="true">&#x1F5FA;&#xFE0F;</span>
        Itinerario
        <span className="places-count">{places.length} paradas</span>
      </h3>
      <div className="poi-list">
        {places.map((place, index) => (
          <PlaceItem key={`${place.name}-${index}`} place={place} index={index} />
        ))}
      </div>
    </div>
  );
}
