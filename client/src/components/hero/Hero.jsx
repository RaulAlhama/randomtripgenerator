import { useMemo, useState } from 'react';
import CityPlanner from './CityPlanner';

// Real travel photography is the hero. Photos: Unsplash CDN (credited in footer).
const photo = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=72`;

// Showcase places for the landing teaser — one landmark per inspiration city.
// Photo ids match client/src/constants/inspiration.js. This is a decorative
// preview, not a live result: real nearby places load after "Generar mi ruta".
const SHOWCASE = [
  { city: 'Madrid', name: 'Plaza Mayor', cat: 'Monumento', dist: '120 m', rate: '4,7', photo: '1539037116277-4db20889f2d4' },
  { city: 'Sevilla', name: 'La Giralda', cat: 'Monumento', dist: '180 m', rate: '4,8', photo: '1534106659956-d02ca15d30fb' },
  { city: 'Granada', name: 'La Alhambra', cat: 'Histórico', dist: '300 m', rate: '4,9', photo: '1620677368158-32b1293fac36' },
  { city: 'Barcelona', name: 'Sagrada Família', cat: 'Monumento', dist: '250 m', rate: '4,8', photo: '1583422409516-2895a77efded' },
  { city: 'Toledo', name: 'Catedral de Toledo', cat: 'Histórico', dist: '90 m', rate: '4,7', photo: '1670691377549-155175463898' },
  { city: 'Córdoba', name: 'Mezquita-Catedral', cat: 'Histórico', dist: '140 m', rate: '4,9', photo: '1632904080322-e71e16a5987f' },
  { city: 'Valencia', name: 'Ciudad de las Artes', cat: 'Cultural', dist: '210 m', rate: '4,6', photo: '1529437971227-3344caa48ce2' },
  { city: 'Málaga', name: 'Centro histórico', cat: 'Clásico', dist: '160 m', rate: '4,6', photo: '1512753360435-329c4535a9a7' },
];

// A small stack of real places — previews the swipe deck the product is built on.
function HeroDeck() {
  // Pick a random trio once per mount: a different city greets each visit.
  const [front, mid, back] = useMemo(() => {
    const i = Math.floor(Math.random() * SHOWCASE.length);
    return [0, 1, 2].map((k) => SHOWCASE[(i + k) % SHOWCASE.length]);
  }, []);

  return (
    <div className="hero-deck" aria-hidden="true">
      <div
        className="hero-deck-card hero-deck-back"
        style={{ backgroundImage: `url(${photo(back.photo, 420, 540)})` }}
      />
      <div
        className="hero-deck-card hero-deck-mid"
        style={{ backgroundImage: `url(${photo(mid.photo, 440, 560)})` }}
      />
      <article className="hero-deck-card hero-deck-front">
        <div
          className="hero-deck-photo"
          style={{ backgroundImage: `url(${photo(front.photo, 600, 600)})` }}
        >
          <span className="hero-deck-chip">{front.cat}</span>
          <span className="hero-deck-dist">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            {front.dist}
          </span>
        </div>
        <div className="hero-deck-info">
          <h3 className="hero-deck-name">{front.name}</h3>
          <div className="hero-deck-meta">
            <span>{front.city} · a pie</span>
            <span className="hero-deck-rate">★ {front.rate}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function Hero({ onExplore }) {
  // The planner is the power tool, not the front door: keep it folded so the
  // landing presents a single action instead of a wall of controls.
  const [plannerOpen, setPlannerOpen] = useState(false);

  return (
    <section className="hero">
      <div className="hero-layout">
        <div className="hero-intro">
          <span className="hero-eyebrow">Cerca de ti · a pie</span>
          <h1>
            Qué ver cerca de ti, <br /><em>ahora mismo</em>
          </h1>
          <p className="subtitle">
            Detecta dónde estás y te monta una <strong>ruta a pie</strong> por los mejores
            sitios y restaurantes de alrededor. Gratis y sin registro.
          </p>
        </div>

        <div className="hero-preview">
          <HeroDeck />
        </div>

        <div className="hero-actions">
          <button type="button" className="hero-cta" onClick={() => onExplore('sitios')}>
            Generar mi ruta
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <button type="button" className="hero-cta-ghost" onClick={() => onExplore('restaurantes')}>
            Ver restaurantes cerca
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
        </div>
      </div>
    </section>
  );
}
