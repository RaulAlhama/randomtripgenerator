import SaveHeart from './SaveHeart';
import Icon from '../ui/Icon';
import { track } from '../../services/analytics';
import { formatDecimal } from '../../lib/format';
import { cssUrl } from '../../lib/cssUrl';

// One full-screen restaurant card in the swipe deck. The first card in the
// deck is flagged `featured` — this is the slot that can later become paid
// "destacado" inventory. Restaurants are a destination on their own (you go
// to ONE), so the card's single action is getting there.
export default function DeckRestaurantCard({ restaurant: r, featured, city = '' }) {
  const priceLabel = r.priceLevel > 0 ? '€'.repeat(r.priceLevel) : null;

  return (
    <article className={`xp-rcard${featured ? ' is-featured' : ''}`}>
      <div
        className="xp-rcard-photo"
        style={r.photoUrl ? { backgroundImage: cssUrl(r.photoUrl) } : undefined}
      >
        {!r.photoUrl && <Icon className="xp-rcard-photo-icon" name="utensils" size={56} strokeWidth={1.5} />}
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
        {r.openNow === true && <span className="xp-rcard-open">Abierto ahora</span>}
        {r.openNow === false && <span className="xp-rcard-open is-closed">Cerrado</span>}
      </div>

      <div className="xp-rcard-body">
        <h3 className="xp-rcard-name">{r.name}</h3>
        <div className="xp-rcard-meta">
          <span className="xp-rcard-stars">★ {r.rating != null && formatDecimal(r.rating)}</span>
          <span className="xp-rcard-count">({r.userRatingsTotal} reseñas)</span>
          {priceLabel && <span className="xp-rcard-price">{priceLabel}</span>}
        </div>
        {r.address && <p className="xp-rcard-desc">{r.address}</p>}

        <a
          className="xp-rcard-action"
          href={r.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('restaurant_maps_opened', { city, name: r.name })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Cómo llegar
        </a>
      </div>
    </article>
  );
}
