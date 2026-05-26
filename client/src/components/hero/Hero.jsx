import { useState } from 'react';
import Tabs from './Tabs';
import RouteTab from './RouteTab';
import RestaurantsTab from './RestaurantsTab';
import Icon from '../ui/Icon';

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
        Datos reales de OpenStreetMap
      </span>
    </div>
  );
}

function HeroMockup() {
  const places = [
    { num: 1, name: 'Plaza Mayor', type: 'Monumento histórico' },
    { num: 2, name: 'Mercado de San Miguel', type: 'Gastronomía' },
    { num: 3, name: 'Jardines del Retiro', type: 'Naturaleza urbana' },
  ];

  return (
    <div className="hero-mockup" aria-hidden="true">
      <div className="hero-mockup-cover">
        <div className="hero-mockup-eyebrow">Ruta generada con IA · Datos reales</div>
        <div className="hero-mockup-title">Madrid — Centro histórico clásico</div>
        <div className="hero-mockup-meta">
          <span>A pie</span>
          <span>4.2 km</span>
          <span>52 min</span>
          <span>3 paradas</span>
        </div>
      </div>
      <div className="hero-mockup-body">
        {places.map((p) => (
          <div key={p.num} className="hero-mockup-poi">
            <div className="hero-mockup-num">{p.num}</div>
            <div>
              <div className="hero-mockup-poi-name">{p.name}</div>
              <div className="hero-mockup-poi-type">{p.type}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="hero-mockup-footer">
        <span>Generado en 3 seg</span>
        <span>OpenStreetMap + IA</span>
      </div>
    </div>
  );
}

function WikilocCta() {
  return (
    <div className="wikiloc-cta-section">
      <span>Buscas rutas de senderismo?</span>
      <a
        href="https://es.wikiloc.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm"
      >
        <Icon name="leaf" size={14} />
        Ver rutas en Wikiloc
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
        </svg>
      </a>
    </div>
  );
}

export default function Hero() {
  const [activeTab, setActiveTab] = useState('route');

  return (
    <section className="hero">
      <HeroDecor />

      <div className="hero-layout">
        <div className="hero-content">
          <h1>
            Rutas con <em>IA real</em><br />y datos de OpenStreetMap
          </h1>
          <p className="subtitle">
            Genera una ruta turística personalizada en cualquier ciudad del mundo,
            con POIs reales, meteorología en vivo y sin necesidad de registro.
          </p>

          <Tabs activeTab={activeTab} onChange={setActiveTab} />

          <div className="search-form">
            <div className="tab-panel" hidden={activeTab !== 'route'}>
              <RouteTab />
            </div>
            <div className="tab-panel" hidden={activeTab !== 'restaurants'}>
              <RestaurantsTab />
            </div>
          </div>

          <TrustRow />
          <WikilocCta />
        </div>

        <div className="hero-preview">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
