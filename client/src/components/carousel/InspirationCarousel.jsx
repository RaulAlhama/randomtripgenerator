import { useTrip } from '../../context/TripContext';
import { INSPIRATION_EXAMPLES } from '../../constants/inspiration';
import CarouselCard from './CarouselCard';

export default function InspirationCarousel() {
  const {
    setLocationMode,
    setSearchLocation,
    setTheme,
    setRadius,
    generateTrip,
  } = useTrip();

  const handleCardClick = (example) => {
    setLocationMode('search');
    const loc = { lat: example.lat, lng: example.lng, name: example.city, country: 'España' };
    setSearchLocation(loc);
    setTheme(example.theme);
    setRadius(example.radius);
    generateTrip({
      locationMode: 'search',
      searchLocation: loc,
      theme: example.theme,
      transport: 'walking',
      radius: example.radius,
    });
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
