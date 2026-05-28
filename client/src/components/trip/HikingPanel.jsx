import { useTrip } from '../../context/TripContext';

// Human-readable label for each value of OSM's `sac_scale` tag.
const SAC_LABELS = {
  hiking: 'T1 · Fácil',
  mountain_hiking: 'T2 · Moderada',
  demanding_mountain_hiking: 'T3 · Exigente',
  alpine_hiking: 'T4 · Alpina',
  demanding_alpine_hiking: 'T5 · Alpina exigente',
  difficult_alpine_hiking: 'T6 · Difícil',
};

// Same OSM ladder OSRM tile styles use — lwn = local, rwn = regional, etc.
const NETWORK_LABELS = {
  lwn: 'Local',
  rwn: 'Regional',
  nwn: 'Nacional',
  iwn: 'Internacional',
};

function formatKm(meters) {
  if (!meters) return '?';
  const km = meters / 1000;
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
}

function TrailCard({ trail, isSelected, onSelect }) {
  const sacLabel = trail.sacScale ? SAC_LABELS[trail.sacScale] : null;
  const networkLabel = trail.network ? NETWORK_LABELS[trail.network] : null;

  return (
    <button
      type="button"
      className={`trail-card${isSelected ? ' is-selected' : ''}`}
      onClick={() => onSelect(trail.id)}
      aria-pressed={isSelected}
    >
      <div className="trail-card-head">
        <h4 className="trail-card-name">{trail.name}</h4>
        {trail.ref && <span className="trail-ref">{trail.ref}</span>}
      </div>
      <div className="trail-card-meta">
        <span className="trail-meta-pill">{formatKm(trail.distance)}</span>
        {sacLabel && <span className={`trail-meta-pill sac-${trail.sacRank || 0}`}>{sacLabel}</span>}
        {networkLabel && <span className="trail-meta-pill trail-network">{networkLabel}</span>}
        {trail.roundtrip && <span className="trail-meta-pill">Circular</span>}
      </div>
      {trail.description && (
        <p className="trail-card-desc">{trail.description}</p>
      )}
      {trail.operator && (
        <div className="trail-card-foot">
          <span>Mantenido por {trail.operator}</span>
          {trail.website && (
            <a
              href={trail.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="trail-link"
            >
              Web oficial ↗
            </a>
          )}
        </div>
      )}
    </button>
  );
}

export default function HikingPanel() {
  const { hikingTrails, selectedTrailId, selectTrail } = useTrip();
  const trails = hikingTrails || [];

  if (trails.length === 0) return null;

  return (
    <div className="places-panel hiking-panel">
      <h3 className="places-title">
        <span className="places-icon" aria-hidden="true">&#x1F97E;</span>
        Senderos cercanos
        <span className="places-count">{trails.length}</span>
      </h3>
      <p className="hiking-panel-hint">
        Datos abiertos de la comunidad de senderistas — haz clic en cualquiera para verlo en el mapa.
      </p>
      <div className="trail-list">
        {trails.map((trail) => (
          <TrailCard
            key={trail.id}
            trail={trail}
            isSelected={trail.id === selectedTrailId}
            onSelect={selectTrail}
          />
        ))}
      </div>
    </div>
  );
}
