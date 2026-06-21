const carouselPhoto = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=440&h=300&q=70`;

export default function CarouselCard({ example, onClick }) {
  return (
    <button type="button" className="carousel-card" onClick={onClick}>
      <div className="carousel-card-photo">
        {example.photo && (
          <img
            src={carouselPhoto(example.photo)}
            alt={`${example.city}, España`}
            title={example.photoBy ? `Foto de ${example.photoBy} · Unsplash` : undefined}
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="carousel-card-photo-overlay" aria-hidden="true" />
        <div className="carousel-card-city">{example.city}</div>
      </div>
      <div className="carousel-card-content">
        <div className="carousel-card-tagline">{example.tagline}</div>
        <span className="carousel-card-cta">
          Generar
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  );
}
