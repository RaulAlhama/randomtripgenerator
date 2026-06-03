// Honest credibility band: claims that are true regardless of traffic
// (no fabricated counters or testimonials). Reinforces the real
// differentiators vs generic "AI trip planner" wrappers.
const ITEMS = [
  {
    title: 'Lugares reales',
    text: 'De OpenStreetMap, no inventados por IA.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Senderos y ciudad',
    text: 'Rutas a pie, en bici, en coche y de montaña.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 20 5-10 4 7 3-5 6 8z" />
        <circle cx="8.5" cy="6.5" r="1.5" />
      </svg>
    ),
  },
  {
    title: 'Fotos e info real',
    text: 'Fotos, valoraciones y horarios de Google.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m21 16-5-5L5 20" />
      </svg>
    ),
  },
  {
    title: 'Gratis y sin fricción',
    text: 'Sin registro y sin anuncios.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
        <path d="M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
];

export default function TrustBand() {
  return (
    <section className="trust-band" aria-label="Por qué RandomTrip">
      <ul className="trust-band-grid">
        {ITEMS.map((item) => (
          <li className="trust-band-item" key={item.title}>
            <span className="trust-band-icon" aria-hidden="true">{item.icon}</span>
            <div className="trust-band-text">
              <span className="trust-band-title">{item.title}</span>
              <span className="trust-band-sub">{item.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
