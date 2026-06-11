import { useState } from 'react';
import Tabs from './Tabs';
import RouteTab from './RouteTab';
import RestaurantsTab from './RestaurantsTab';
import HikingTab from './HikingTab';

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
  stops: [
    { num: 1, name: 'Plaza Mayor', type: 'Monumento histórico', img: '1533403611115-5b62680b6318' },
    { num: 2, name: 'Mercado de San Miguel', type: 'Gastronomía', img: '1664695407561-72d0d171e44e' },
    { num: 3, name: 'Jardines del Retiro', type: 'Naturaleza urbana', img: '1741353171152-5a9cfc05e094' },
  ],
};

function HeroMockup() {
  return (
    <figure className="hero-mockup" aria-hidden="true">
      <div
        className="hero-mockup-cover"
        style={{ backgroundImage: `url(${unsplash(MADRID_EXAMPLE.cover, 760, 460)})` }}
      >
        <div className="hero-mockup-cover-content">
          <div className="hero-mockup-eyebrow">Ruta generada con IA · Lugares reales</div>
          <div className="hero-mockup-title">Madrid · Centro histórico</div>
          <div className="hero-mockup-meta">
            <span>A pie</span>
            <span>4,2 km</span>
            <span>52 min</span>
            <span>3 paradas</span>
          </div>
        </div>
      </div>
      <div className="hero-mockup-body">
        {MADRID_EXAMPLE.stops.map((p) => (
          <div key={p.num} className="hero-mockup-poi">
            <div
              className="hero-mockup-thumb"
              style={{ backgroundImage: `url(${unsplash(p.img, 160, 160)})` }}
            >
              <span className="hero-mockup-num">{p.num}</span>
            </div>
            <div className="hero-mockup-poi-info">
              <div className="hero-mockup-poi-name">{p.name}</div>
              <div className="hero-mockup-poi-type">{p.type}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="hero-mockup-footer">
        <span>Generado en 3 s</span>
        <span>Lugares reales · sin registro</span>
      </div>
    </figure>
  );
}

export default function Hero({ onExplore }) {
  const [activeTab, setActiveTab] = useState('route');
  // The planner is the power tool, not the front door: keep it folded so the
  // landing presents a single action instead of a wall of controls.
  const [plannerOpen, setPlannerOpen] = useState(false);

  return (
    <section className="hero">
      <HeroDecor />

      <div className="hero-layout">
        <div className="hero-content">
          <h1>
            Tu próxima escapada,<br /><em>en segundos</em>
          </h1>
          <p className="subtitle">
            Rutas turísticas con <strong>lugares reales</strong> en cualquier ciudad del
            mundo. Generadas con IA en segundos. Gratis y sin registro.
          </p>

          <button type="button" className="explore-cta" onClick={onExplore}>
            <span className="explore-cta-dot" aria-hidden="true" />
            <span className="explore-cta-text">
              <strong>Explora ahora</strong>
              <small>Sitios y restaurantes a tu alrededor, sin configurar nada</small>
            </span>
            <svg className="explore-cta-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            className="planner-toggle"
            aria-expanded={plannerOpen}
            onClick={() => setPlannerOpen((o) => !o)}
          >
            ¿Prefieres planificar otra ciudad o buscar senderos?
            <svg className={`planner-toggle-chevron${plannerOpen ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {plannerOpen && (
            <>
              <Tabs activeTab={activeTab} onChange={setActiveTab} />

              <div className="search-form">
                <div className="tab-panel" hidden={activeTab !== 'route'}>
                  <RouteTab />
                </div>
                <div className="tab-panel" hidden={activeTab !== 'restaurants'}>
                  <RestaurantsTab />
                </div>
                <div className="tab-panel" hidden={activeTab !== 'hiking'}>
                  <HikingTab />
                </div>
              </div>
            </>
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
