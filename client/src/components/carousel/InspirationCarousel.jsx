import { useTrip } from '../../context/TripContext';
import {
  INSPIRATION_EXAMPLES,
  themeLabelsCarousel,
  transportLabelsCarousel,
} from '../../constants/inspiration';
import CarouselCard from './CarouselCard';

export default function InspirationCarousel() {
  const {
    setLocationMode,
    setSearchLocation,
    setTheme,
    setTransport,
    setRadius,
    generateTrip,
  } = useTrip();

  const handleCardClick = (example) => {
    setLocationMode('search');
    setSearchLocation({ lat: example.lat, lng: example.lng });
    setTheme(example.theme);
    setTransport(example.transport);
    setRadius(example.radius);
    generateTrip();
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
    <section className="inspiration-section">
      <h2 className="inspiration-title">Inspírate</h2>
      <div className="carousel-wrapper">
        <div className="carousel-track">
          {cards}
          {duplicateCards}
        </div>
      </div>
    </section>
  );
}
