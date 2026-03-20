import { themeLabelsCarousel, transportLabelsCarousel } from '../../constants/inspiration';

export default function CarouselCard({ example, onClick }) {
  return (
    <div className="carousel-card" onClick={onClick}>
      <div className="carousel-card-emoji">{example.emoji}</div>
      <div className="carousel-card-city">{example.city}</div>
      <div className="carousel-card-tagline">{example.tagline}</div>
      <div className="carousel-card-badges">
        <span className="carousel-badge">{themeLabelsCarousel[example.theme]}</span>
        <span className="carousel-badge">{transportLabelsCarousel[example.transport]}</span>
        <span className="carousel-badge">{example.radius} km</span>
      </div>
    </div>
  );
}
