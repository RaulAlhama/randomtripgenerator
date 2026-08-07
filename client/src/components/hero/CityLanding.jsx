import { useEffect, useState } from 'react';

// What a visitor arriving from Google at /ciudad/madrid should get: that city,
// not the generic homepage asking for GPS permission.
//
// The server puts this page's unique content in #seo-content, deliberately
// OUTSIDE #root so createRoot can't destroy it (see client/index.html). This
// component adopts that markup into the React tree, which does two things at
// once: the content lands above the footer instead of orphaned below it, and the
// human sees exactly the text the crawler indexed — no second, divergent version
// to keep in sync.
export default function CityLanding({ city, onExplore }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    const node = document.getElementById('seo-content');
    if (!node || !node.innerHTML.trim()) return;
    setHtml(node.innerHTML);
    // Remove the original, or the page carries the same content twice.
    node.remove();
  }, []);

  return (
    <section className="city-landing">
      <div className="city-landing-cta">
        <p className="city-landing-kicker">A pie · {city.name}</p>
        <button
          type="button"
          className="hero-cta"
          onClick={() => onExplore('sitios', { location: city })}
        >
          Generar mi ruta por {city.name}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <p className="city-landing-note">
          Lugares reales de OpenStreetMap alrededor del centro de {city.name}, ordenados
          para recorrerlos andando. Gratis y sin registro.
        </p>
      </div>

      {/* Our own server-rendered markup: every interpolated value goes through
          escapeHtml at build time, and none of it comes from a request. */}
      {html && (
        <div className="city-landing-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}
