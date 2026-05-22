import { themeLabelsCarousel } from '../../constants/inspiration';

export default function CarouselCard({ example, onClick }) {
  return (
    <button type="button" className="carousel-card" onClick={onClick}>
      <div className="carousel-card-emoji" aria-hidden="true">{example.emoji}</div>
      <div className="carousel-card-city">{example.city}</div>
      <div className="carousel-card-tagline">{example.tagline}</div>
      <div className="carousel-card-badges">
        <span className="carousel-badge">{themeLabelsCarousel[example.theme]}</span>
        <span className="carousel-badge carousel-badge-soft">{example.radius} km</span>
      </div>
      <span className="carousel-card-cta">
        Generar
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
