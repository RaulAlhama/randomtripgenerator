import { activityAffiliate } from '../../services/affiliates';
import { track } from '../../services/analytics';

// Affiliate promo for tours/tickets in the routed city, shown under the
// stops list. Renders nothing unless an affiliate provider is configured.
// rel="sponsored" keeps the SEO footprint honest; the fine print keeps the
// user's trust — this is useful content, not a hidden ad.
export default function ActivityPromo({ city }) {
  const aff = activityAffiliate(city);
  if (!aff) return null;

  return (
    <section className="xp-promo" aria-label={`Actividades en ${city}`}>
      <a
        className="xp-promo-card"
        href={aff.url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => track('activities_clicked', { city, provider: aff.provider, placement: 'route' })}
      >
        <span className="xp-promo-icon" aria-hidden="true">🎟️</span>
        <span className="xp-promo-text">
          <span className="xp-promo-title">Entradas y visitas guiadas en {city}</span>
          <span className="xp-promo-sub">Tours y tickets sin colas con {aff.provider}</span>
        </span>
        <svg className="xp-promo-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </a>
      <p className="xp-promo-disclosure">Colaboración: si reservas, RandomTrip recibe una pequeña comisión.</p>
    </section>
  );
}
