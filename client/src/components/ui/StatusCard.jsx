import { useTrip } from '../../context/TripContext';

export default function StatusCard() {
  const { isGenerating, statusMessage } = useTrip();

  if (!isGenerating) return null;

  return (
    <div className="status-card">
      <div className="status-icon">🗺️</div>
      <div className="status-text">{statusMessage}</div>
    </div>
  );
}
