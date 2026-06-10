// Horizontal strip of nearby restaurants. The first slot carries a highlight
// badge — this is the placement that can later become sponsored inventory.
export default function RestaurantStrip({ restaurants, title = 'Dónde comer cerca' }) {
  if (!restaurants?.length) return null;

  return (
    <section className="xp-rest" aria-label={title}>
      <div className="xp-rest-head">
        <span className="xp-rest-title">
          <span aria-hidden="true">🍴</span> {title}
        </span>
        <span className="xp-rest-note">por valoración</span>
      </div>
      <div className="xp-rest-row">
        {restaurants.slice(0, 8).map((r, i) => (
          <a
            key={r.placeId}
            className={`xp-rest-card${i === 0 ? ' is-top' : ''}`}
            href={r.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="xp-rest-photo"
              style={r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined}
            >
              {!r.photoUrl && <span className="xp-rest-photo-icon" aria-hidden="true">🍽️</span>}
              {i === 0 && <span className="xp-rest-badge">Top valorado</span>}
              {r.openNow === true && <span className="xp-rest-open">Abierto</span>}
            </div>
            <div className="xp-rest-info">
              <span className="xp-rest-name">{r.name}</span>
              <span className="xp-rest-meta">
                <span className="xp-rest-stars">★ {r.rating?.toFixed(1)}</span>
                <span className="xp-rest-count">({r.userRatingsTotal})</span>
                {r.priceLevel > 0 && (
                  <span className="xp-rest-price">{'€'.repeat(r.priceLevel)}</span>
                )}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
