import { useState } from 'react';
import CityPlanner from './CityPlanner';

function HeroDecor() {
  return (
    <div className="hero-decor" aria-hidden="true">
      <svg viewBox="0 0 1200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="arcA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="arcB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="600" cy="300" r="260" stroke="url(#arcA)" strokeWidth="1.5" strokeDasharray="4 6" />
        <circle cx="600" cy="300" r="380" stroke="url(#arcA)" strokeWidth="1" strokeDasharray="2 10" />
        <circle cx="600" cy="300" r="500" stroke="url(#arcA)" strokeWidth="0.8" strokeDasharray="1 12" />
        <path d="M100 320 Q 600 120 1100 320" stroke="url(#arcB)" strokeWidth="1.5" strokeDasharray="6 8" fill="none" />
        <path d="M80 360 Q 600 520 1120 360" stroke="url(#arcB)" strokeWidth="1.2" strokeDasharray="3 10" fill="none" />
      </svg>
    </div>
  );
}

function TrustRow() {
  return (
    <div className="hero-trust" aria-label="Características principales">
      <span className="hero-trust-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Sin registro
      </span>
      <span className="hero-trust-dot" aria-hidden="true" />
      <span className="hero-trust-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        Resultados en segundos
      </span>
      <span className="hero-trust-dot" aria-hidden="true" />
      <span className="hero-trust-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Cualquier ciudad del mundo
      </span>
    </div>
  );
}

// Photos: Unsplash (hotlinked CDN). Credits shown in the footer.
const unsplash = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

const MADRID_EXAMPLE = {
  cover: '1539037116277-4db20889f2d4',
};

// Preview of the real product: one full-screen "deck" card you swipe through.
function HeroMockup() {
  return (
    <figure className="hero-mockup" aria-hidden="true">
      <div className="hero-mockup-bar">
        <span className="hero-mockup-seg is-on">Sitios</span>
        <span className="hero-mockup-seg">Restaurantes</span>
        <span className="hero-mockup-count">1 / 10</span>
      </div>
      <div
        className="hero-mockup-photo"
        style={{ backgroundImage: `url(${unsplash(MADRID_EXAMPLE.cover, 760, 560)})` }}
      >
        <span className="hero-mockup-chip">Monumento</span>
      </div>
      <div className="hero-mockup-info">
        <div className="hero-mockup-name">Plaza Mayor</div>
        <div className="hero-mockup-row">
          <span>📍 120 m</span>
          <span className="hero-mockup-rate">★ 4,7</span>
        </div>
        <p className="hero-mockup-desc">
          El corazón porticado del Madrid de los Austrias, a un paso de todo.
        </p>
      </div>
      <div className="hero-mockup-cta">Crear ruta · 10 sitios</div>
    </figure>
  );
}

export default function Hero({ onExplore }) {
  // The planner is the power tool, not the front door: keep it folded so the
  // landing presents a single action instead of a wall of controls.
  const [plannerOpen, setPlannerOpen] = useState(false);

  return (
    <section className="hero">
      <HeroDecor />

      <div className="hero-layout">
        <div className="hero-content">
          <h1>
            Qué ver cerca de ti, <br /><em>ahora mismo</em>
          </h1>
          <p className="subtitle">
            Detecta dónde estás y te arma una <strong>ruta a pie</strong> con los mejores
            sitios y restaurantes a tu alrededor. O planifica cualquier ciudad del mundo.
            Gratis y sin registro.
          </p>

          <button type="button" className="explore-cta" onClick={() => onExplore('sitios')}>
            <span className="explore-cta-badge" aria-hidden="true">
              <span className="explore-cta-pulse" />
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </span>
            <span className="explore-cta-text">
              <strong>Generar mi ruta</strong>
              <small>Sitios cerca de ti, al instante</small>
            </span>
            <span className="explore-cta-go">
              Empezar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>

          <button type="button" className="explore-cta-secondary" onClick={() => onExplore('restaurantes')}>
            <span aria-hidden="true">🍴</span> Restaurantes cerca
          </button>

          <button
            type="button"
            className="planner-toggle"
            aria-expanded={plannerOpen}
            onClick={() => setPlannerOpen((o) => !o)}
          >
            ¿Prefieres planificar otra ciudad?
            <svg className={`planner-toggle-chevron${plannerOpen ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {plannerOpen && (
            <div className="search-form">
              <CityPlanner
                onPlan={(location, radiusKm) => onExplore('sitios', { location, radiusKm })}
              />
            </div>
          )}

          <TrustRow />
        </div>

        <div className="hero-preview">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
