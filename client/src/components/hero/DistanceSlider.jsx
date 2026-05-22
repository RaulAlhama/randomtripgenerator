import { useTrip } from '../../context/TripContext';
import { SLIDER_DEFAULTS } from '../../constants/transport';

const CONFIG = { ...SLIDER_DEFAULTS.walking, max: 15 };

export default function DistanceSlider() {
  const { selectedRadius, setRadius } = useTrip();
  const config = CONFIG;

  const formatValue = (value) => {
    return value >= 1 ? `${value} km` : `${(value * 1000).toFixed(0)} m`;
  };

  const handleChange = (e) => {
    setRadius(parseFloat(e.target.value));
  };

  const pct = ((selectedRadius - config.min) / (config.max - config.min)) * 100;

  return (
    <div className="distance-selector">
      <div className="slider-wrapper">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={selectedRadius}
          onChange={handleChange}
          style={{ '--pct': `${pct}%` }}
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
