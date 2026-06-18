import { useTrip } from '../../context/TripContext';
import CitySearch from './CitySearch';
import DistanceSlider from './DistanceSlider';

// Minimal "plan another city" form: just search a city and pick the radius.
// Submitting opens the same swipe deck (via onPlan) for that location.
export default function CityPlanner({ onPlan }) {
  const { searchLocation, selectedRadius } = useTrip();

  return (
    <div className="city-planner">
      <CitySearch />

      <div className="search-field-group">
        <span className="search-field-label">Radio de exploración</span>
        <DistanceSlider />
      </div>

      <button
        type="button"
        className="btn btn-primary city-planner-go"
        disabled={!searchLocation}
        onClick={() => searchLocation && onPlan(searchLocation, selectedRadius)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 21l-4.35-4.35" /><circle cx="11" cy="11" r="7" />
        </svg>
        Ver sitios
      </button>
    </div>
  );
}
