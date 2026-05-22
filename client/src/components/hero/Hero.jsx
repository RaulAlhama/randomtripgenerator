import LocationPicker from './LocationPicker';
import ThemeSelector from './ThemeSelector';
import DistanceSlider from './DistanceSlider';
import GenerateButton from './GenerateButton';

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
        Ruta en segundos
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

export default function Hero() {
  return (
    <section className="hero">
      <HeroDecor />
      <span className="hero-eyebrow">
        <span className="hero-eyebrow-dot" />
        Generado con IA · En tiempo real
      </span>
      <h1>
        Tu próxima <em>escapada</em>,<br />a un clic de distancia
      </h1>
      <p className="subtitle">
        Rutas turísticas personalizadas desde tu ubicación o cualquier ciudad del mundo.
        Elige un tema, ajusta la distancia y obtén un itinerario listo para explorar.
      </p>

      <div className="search-form">
        <div className="search-field-group">
          <span className="search-field-label">¿Desde dónde exploras?</span>
          <LocationPicker />
        </div>

        <div className="search-divider" aria-hidden="true" />

        <div className="search-field-group">
          <span className="search-field-label">Tipo de ruta</span>
          <ThemeSelector />
        </div>

        <div className="search-divider" aria-hidden="true" />

        <div className="search-field-group">
          <span className="search-field-label">Radio de exploración</span>
          <DistanceSlider />
        </div>

        <div className="search-cta">
          <GenerateButton />
          <TrustRow />
        </div>
      </div>
    </section>
  );
}
