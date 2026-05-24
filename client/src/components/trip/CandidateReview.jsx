import { useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { typeLabels } from '../../constants/poi';
import CandidateCard from './CandidateCard';

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CandidateReview() {
  const {
    candidates,
    currentTrip,
    selectedKeys,
    toggleCandidate,
    buildRouteFromSelection,
    isGenerating,
    poiKey,
  } = useTrip();

  const items = useMemo(() => {
    if (!candidates || !currentTrip) return [];
    return candidates.map((p) => ({
      place: p,
      key: poiKey(p),
      typeLabel: typeLabels[p.type] || typeLabels.default,
      distanceKm: haversineKm(currentTrip.origin_lat, currentTrip.origin_lng, p.lat, p.lng),
    }));
  }, [candidates, currentTrip, poiKey]);

  if (!candidates || candidates.length === 0) return null;

  const selectedCount = selectedKeys.size;
  const canBuild = selectedCount >= 2 && !isGenerating;

  return (
    <div className="candidate-panel">
      <div className="candidate-header">
        <h3 className="candidate-title">
          <span className="candidate-icon" aria-hidden="true">&#x2728;</span>
          Elige tus paradas
        </h3>
        <p className="candidate-help">
          Desmarca los sitios que no te interesen. Marca al menos 2 para crear la ruta.
        </p>
      </div>

      <div className="candidate-list">
        {items.map(({ place, key, typeLabel, distanceKm }) => (
          <CandidateCard
            key={key}
            place={place}
            typeLabel={typeLabel}
            distanceKm={distanceKm}
            selected={selectedKeys.has(key)}
            onToggle={() => toggleCandidate(key)}
          />
        ))}
      </div>

      <div className="candidate-footer">
        <span className="candidate-count">
          {selectedCount === 0
            ? 'Ninguno seleccionado'
            : `${selectedCount} de ${candidates.length} seleccionados`}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={buildRouteFromSelection}
          disabled={!canBuild}
          aria-busy={isGenerating || undefined}
        >
          {isGenerating ? (
            <>
              <span className="spinner" aria-hidden="true"></span>
              Calculando...
            </>
          ) : (
            <>
              Crear ruta {selectedCount > 0 ? `(${selectedCount})` : ''}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="btn-arrow">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
