import { useTrip } from '../../context/TripContext';
import { TRANSPORTS, SLIDER_DEFAULTS } from '../../constants/transport';

export default function TransportSelector() {
  const { selectedTransport, setTransport, setRadius } = useTrip();

  const handleTransportClick = (mode) => {
    setTransport(mode);
    setRadius(SLIDER_DEFAULTS[mode].value);
  };

  return (
    <div className="transport-selector">
      <p className="selector-label">¿Cómo te mueves?</p>
      <div className="transport-options">
        {TRANSPORTS.map((transport) => (
          <button
            key={transport.key}
            className={`transport-btn${selectedTransport === transport.key ? ' active' : ''}`}
            onClick={() => handleTransportClick(transport.key)}
          >
            <span>{transport.icon}</span>
            <span>{transport.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
