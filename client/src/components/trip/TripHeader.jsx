import { useTrip } from '../../context/TripContext';

export default function TripHeader() {
  const { currentTrip, shareTrip, closeTrip } = useTrip();

  const city = currentTrip?.city || 'la zona';

  return (
    <div className="section-header">
      <h2>
        Tu Ruta en <span className="gradient-text">{city}</span>
      </h2>
      <div className="section-actions">
        <button className="btn btn-sm btn-share" title="Compartir ruta" onClick={shareTrip}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
          Compartir
        </button>
        <button className="btn-icon" aria-label="Cerrar ruta" onClick={closeTrip}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
