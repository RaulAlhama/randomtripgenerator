import { useTrip } from '../../context/TripContext';
import { SLIDER_DEFAULTS } from '../../constants/transport';

export default function DistanceSlider() {
  const { selectedTransport, selectedRadius, setRadius } = useTrip();
  const config = SLIDER_DEFAULTS[selectedTransport] || SLIDER_DEFAULTS.driving;

  const formatValue = (value) => {
    return value >= 1 ? `${value} km` : `${(value * 1000).toFixed(0)} m`;
  };

  const handleChange = (e) => {
    setRadius(parseFloat(e.target.value));
  };

  return (
    <div className="distance-selector">
      <p className="selector-label">Distancia máxima</p>
      <div className="slider-wrapper">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={selectedRadius}
          onChange={handleChange}
        />
        <div className="slider-labels">
          <span>{formatValue(config.min)}</span>
          <span className="distance-current">{formatValue(selectedRadius)}</span>
          <span>{formatValue(config.max)}</span>
        </div>
      </div>
    </div>
  );
}
