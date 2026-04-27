import { useTrip } from '../../context/TripContext';

export default function GenerateButton() {
  const { isGenerating, generateTrip, progress } = useTrip();

  return (
    <button
      className="btn btn-primary btn-glow"
      onClick={generateTrip}
      disabled={isGenerating}
      aria-busy={isGenerating || undefined}
    >
      {isGenerating ? (
        <>
          <span className="spinner" aria-hidden="true"></span>
          <span>Generando{progress ? ` · ${Math.round(progress)}%` : '...'}</span>
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v3M12 18v3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
          Generar mi ruta
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="btn-arrow">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </>
      )}
    </button>
  );
}
