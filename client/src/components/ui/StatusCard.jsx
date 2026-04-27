import { useEffect, useRef } from 'react';
import { useTrip } from '../../context/TripContext';

export default function StatusCard() {
  const {
    isGenerating,
    statusMessage,
    progress,
    generationError,
    generateTrip,
    clearError,
  } = useTrip();
  const wrapperRef = useRef(null);

  // Auto-scroll to status card when generation starts or error appears so the
  // user never loses sight of what's happening.
  useEffect(() => {
    if ((isGenerating || generationError) && wrapperRef.current) {
      wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isGenerating, generationError]);

  if (!isGenerating && !generationError) return null;

  if (generationError) {
    return (
      <div className="status-card status-card-error" ref={wrapperRef} role="alert">
        <div className="status-icon status-icon-error">⚠️</div>
        <div className="status-text">{generationError}</div>
        <div className="status-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              clearError();
              generateTrip();
            }}
          >
            Reintentar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearError}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, progress || 0));

  return (
    <div className="status-card" ref={wrapperRef} role="status" aria-live="polite">
      <div className="status-icon">🗺️</div>
      <div className="status-text">{statusMessage}</div>
      <div className="status-progress" aria-hidden="true">
        <div className="status-progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="status-progress-label">{pct}%</div>
    </div>
  );
}
