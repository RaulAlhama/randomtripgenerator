import { useMemo, useState } from 'react'; // useMemo: HeroDeck y la variante
import CityPlanner from './CityPlanner';

// Real travel photography is the hero. Photos: Unsplash CDN (credited in footer).
const photo = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=72`;

// Showcase places for the landing teaser — one real landmark per inspiration
// city. Photo ids match client/src/constants/inspiration.js. Deliberately carries
// NO distance or rating: those depend on where you actually are, and inventing
// plausible-looking numbers here would make a decorative card indistinguishable
// from a real result. The card is labelled "Ejemplo" for the same reason.
const SHOWCASE = [
  { city: 'Madrid', name: 'Plaza Mayor', cat: 'Monumento', photo: '1539037116277-4db20889f2d4' },
  { city: 'Sevilla', name: 'La Giralda', cat: 'Monumento', photo: '1534106659956-d02ca15d30fb' },
  { city: 'Granada', name: 'La Alhambra', cat: 'Histórico', photo: '1620677368158-32b1293fac36' },
  { city: 'Barcelona', name: 'Sagrada Família', cat: 'Monumento', photo: '1583422409516-2895a77efded' },
  { city: 'Toledo', name: 'Catedral de Toledo', cat: 'Histórico', photo: '1670691377549-155175463898' },
  { city: 'Córdoba', name: 'Mezquita-Catedral', cat: 'Histórico', photo: '1632904080322-e71e16a5987f' },
  { city: 'Valencia', name: 'Ciudad de las Artes', cat: 'Cultural', photo: '1529437971227-3344caa48ce2' },
  { city: 'Málaga', name: 'Centro histórico', cat: 'Clásico', photo: '1512753360435-329c4535a9a7' },
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
          <span className="hero-deck-dist">Ejemplo</span>
        </div>
        <div className="hero-deck-info">
          <h3 className="hero-deck-name">{front.name}</h3>
          <div className="hero-deck-meta">
            <span>{front.city} · a pie</span>
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

  // TEMPORAL: dos direcciones de diseño en paralelo para poder compararlas
  // renderizadas (?hero=chapas). Se queda una y se borra la otra.
  const variant = useMemo(() => {
    const v = new URLSearchParams(window.location.search).get('hero');
    return v === 'chapas' ? 'chapas' : 'sumario';
  }, []);

  return (
    <section className="hero" data-hero={variant}>
      <div className="hero-layout">
        <div className="hero-intro">
          <span className="hero-eyebrow">Cerca de ti · a pie</span>
          <h1>
            Qué ver cerca de ti, <br /><em>ahora mismo</em>
          </h1>
          <p className="subtitle">
            Detecta dónde estás y te monta una <strong>ruta a pie</strong> por los mejores
            sitios de alrededor, o te enseña dónde comer bien. Gratis y sin registro.
          </p>
        </div>

        <div className="hero-preview">
          <HeroDeck />
        </div>

        <div className="hero-actions">
          {/* Two jobs, equal billing: build a route OR find a place to eat. */}
          <div className="hero-cta-row">
            {/* Los dos trabajos son el MISMO control con distinto contenido: el
                relleno pino en uno y el borde de 2px en el otro contradecían
                "mismo peso". El antetítulo dice de qué trabajo se trata. */}
            <button type="button" className="hero-cta" onClick={() => onExplore('sitios')}>
              <span className="hero-cta-kicker">Ruta a pie</span>
              <span className="hero-cta-label">Generar mi ruta</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <button type="button" className="hero-cta hero-cta-alt" onClick={() => onExplore('restaurantes')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
              </svg>
              <span className="hero-cta-kicker">Dónde comer</span>
              <span className="hero-cta-label">Restaurantes cerca</span>
            </button>
          </div>

          {/* Not a lesser version of the buttons above — a different mode. Both
              CTAs assume you're standing where you want to walk; someone
              planning from the sofa can't use either, so this needs to be
              findable rather than tucked away as a footnote. */}
          <button
            type="button"
            className="planner-toggle"
            aria-expanded={plannerOpen}
            aria-controls="hero-planner"
            onClick={() => setPlannerOpen((o) => !o)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <em>¿Aún no estás allí?</em>
            <span className="pt-label">Planificar otra ciudad</span>
            <svg className={`planner-toggle-chevron${plannerOpen ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {plannerOpen && (
            <div className="search-form" id="hero-planner">
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
