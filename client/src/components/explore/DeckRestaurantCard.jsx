import SaveHeart from './SaveHeart';

// One full-screen restaurant card in the swipe deck. The first card in the
// deck is flagged `featured` — this is the slot that can later become paid
// "destacado" inventory. `added`/`onToggleRoute` let the user drop the
// restaurant into the walking route as an extra stop. `canAdd` is false when
// the place has no coordinates to route to.
export default function DeckRestaurantCard({ restaurant: r, featured, added, canAdd = true, onToggleRoute, city = '' }) {
  const priceLabel = r.priceLevel > 0 ? '€'.repeat(r.priceLevel) : null;

  return (
    <article className={`xp-rcard${featured ? ' is-featured' : ''}${added ? ' is-added' : ''}`}>
      <div
        className="xp-rcard-photo"
        style={r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined}
      >
        {!r.photoUrl && <span className="xp-rcard-photo-icon" aria-hidden="true">🍽️</span>}
        <div className="xp-dcard-scrim" />
        <SaveHeart
          item={{
            kind: 'restaurant',
            placeId: r.placeId,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            city,
            imageUrl: r.photoUrl || null,
            rating: r.rating ?? null,
            address: r.address || null,
            mapsUrl: r.mapsUrl || null,
          }}
        />
        {featured && <span className="xp-rcard-badge">Destacado</span>}
        {added && <span className="xp-rcard-inroute" aria-hidden="true">✓ En tu ruta</span>}
        {r.openNow === true && <span className="xp-rcard-open">Abierto ahora</span>}
        {r.openNow === false && <span className="xp-rcard-open is-closed">Cerrado</span>}
      </div>

      <div className="xp-rcard-body">
        <h3 className="xp-rcard-name">{r.name}</h3>
        <div className="xp-rcard-meta">
          <span className="xp-rcard-stars">★ {r.rating?.toFixed(1)}</span>
          <span className="xp-rcard-count">({r.userRatingsTotal} reseñas)</span>
          {priceLabel && <span className="xp-rcard-price">{priceLabel}</span>}
        </div>
        {r.address && <p className="xp-rcard-desc">{r.address}</p>}

        <div className="xp-rcard-actions">
          {canAdd && (
            <button
              type="button"
              className={`xp-rcard-add${added ? ' is-added' : ''}`}
              onClick={onToggleRoute}
              aria-pressed={added}
            >
              {added ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Quitar de la ruta
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Añadir a la ruta
                </>
              )}
            </button>
          )}
          <a
            className="xp-rcard-action"
            href={r.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Encontrar lugar
          </a>
        </div>
      </div>
    </article>
  );
}
