import { useTrip } from '../../context/TripContext';
import { TRANSPORTS, SLIDER_DEFAULTS } from '../../constants/transport';
import { TRANSPORT_ICONS } from './transportIcons';

export default function TransportSelector() {
  const { selectedTransport, setTransport, setRadius } = useTrip();

  const handleTransportClick = (mode) => {
    setTransport(mode);
    setRadius(SLIDER_DEFAULTS[mode].value);
  };

  return (
    <div className="transport-selector">
      <div className="transport-options" role="radiogroup" aria-label="Medio de transporte">
        {TRANSPORTS.map((transport) => {
          const isActive = selectedTransport === transport.key;
          return (
            <button
              key={transport.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={`transport-btn${isActive ? ' active' : ''}`}
              onClick={() => handleTransportClick(transport.key)}
            >
              <span className="transport-btn-icon" aria-hidden="true">
                {TRANSPORT_ICONS[transport.key]}
              </span>
              <span>{transport.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
