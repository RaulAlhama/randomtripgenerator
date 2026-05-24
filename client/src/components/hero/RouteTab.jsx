import LocationPicker from './LocationPicker';
import DistanceSlider from './DistanceSlider';
import GenerateButton from './GenerateButton';

export default function RouteTab() {
  return (
    <>
      <div className="search-field-group">
        <span className="search-field-label">¿Desde dónde exploras?</span>
        <LocationPicker />
      </div>

      <div className="search-field-group">
        <span className="search-field-label">Radio de exploración</span>
        <DistanceSlider />
      </div>

      <div className="search-cta">
        <GenerateButton />
      </div>
    </>
  );
}
