import { INSPIRATION_EXAMPLES } from '../../constants/inspiration';
import CarouselCard from './CarouselCard';

export default function InspirationCarousel({ onExplore }) {
  // Send the click straight into the swipe deck for that city — the same
  // experience as the hero CTA, instead of the legacy page-level map.
  const handleCardClick = (example) => {
    const location = { lat: example.lat, lng: example.lng, name: example.city, country: 'España' };
    onExplore('sitios', { location, radiusKm: example.radius });
  };

  const cards = INSPIRATION_EXAMPLES.map((example, index) => (
    <CarouselCard
      key={`original-${index}`}
      example={example}
      onClick={() => handleCardClick(example)}
    />
  ));

  const duplicateCards = INSPIRATION_EXAMPLES.map((example, index) => (
    <CarouselCard
      key={`duplicate-${index}`}
      example={example}
      onClick={() => handleCardClick(example)}
    />
  ));

  return (
    <section className="inspiration-section" id="inspiracion" aria-labelledby="inspiracion-title">
      <div className="section-intro">
        <span className="section-eyebrow">Inspiración</span>
        <h2 id="inspiracion-title">Rutas populares para empezar</h2>
        <p>Haz clic en cualquier tarjeta para generar esa ruta al instante.</p>
      </div>
      <div className="carousel-wrapper">
        <div className="carousel-track">
          {cards}
          {duplicateCards}
        </div>
      </div>
    </section>
  );
}
