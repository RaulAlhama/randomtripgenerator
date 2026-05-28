import LocationPicker from './LocationPicker';
import DistanceSlider from './DistanceSlider';
import { useTrip } from '../../context/TripContext';

export default function HikingTab() {
  const { isGenerating, generateHikingTrails, progress } = useTrip();
  const busyLabel = `Buscando${progress ? ` · ${Math.round(progress)}%` : '...'}`;

  return (
    <>
      <div className="search-field-group">
        <span className="search-field-label">¿Desde dónde sales?</span>
        <LocationPicker />
      </div>

      <div className="search-field-group">
        <span className="search-field-label">Radio de búsqueda</span>
        <DistanceSlider />
        <p className="hiking-radius-hint">
          Los senderos suelen empezar fuera de la ciudad — multiplicamos el radio para abarcar mejor el entorno.
        </p>
      </div>

      <div className="search-cta">
        <div className="cta-row">
          <button
            type="button"
            className="btn btn-primary btn-glow"
            onClick={() => generateHikingTrails()}
            disabled={isGenerating}
            aria-busy={isGenerating || undefined}
          >
            {isGenerating ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                <span>{busyLabel}</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 20h18M6 20l3-8 3 4 3-6 3 10" />
                </svg>
                Buscar senderos
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="btn-arrow">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
