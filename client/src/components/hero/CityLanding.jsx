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
const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// `walk` is present on the 2-hour pages: that page's own route. Then the main
// action is taking it, and generating a different one becomes the alternative.
export default function CityLanding({ city, onExplore, walk = null, onWalk }) {
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
      {walk ? (
        <div className="city-landing-cta">
          <p className="city-landing-kicker">
            {walk.stops.length} paradas
            {walk.distanceM ? ` · ${(walk.distanceM / 1000).toFixed(1).replace('.', ',')} km` : ''}
            {/* "con visitas": the route view right after shows walking time alone
                (Toledo: 50 min), and two bare figures read as a contradiction. */}
            {' · '}unas 2 horas con visitas
          </p>
          <button type="button" className="city-cta" onClick={onWalk}>
            Hacer esta ruta ahora
            <Arrow />
          </button>
          <p className="city-landing-note">
            Te la abrimos en el mapa con las paradas de esta página, en orden. Al empezar
            el paseo te avisamos al llegar a cada una y te mandamos a Google Maps para el
            siguiente tramo.
          </p>
          <button
            type="button"
            className="city-cta-alt"
            onClick={() => onExplore('sitios', { location: city })}
          >
            O genera otra ruta por {city.name}
          </button>
        </div>
      ) : (
        <div className="city-landing-cta">
          <p className="city-landing-kicker">A pie · {city.name}</p>
          <button
            type="button"
            className="city-cta"
            onClick={() => onExplore('sitios', { location: city })}
          >
            Generar mi ruta por {city.name}
            <Arrow />
          </button>
          <p className="city-landing-note">
            Lugares reales de OpenStreetMap alrededor del centro de {city.name}, ordenados
            para recorrerlos andando. Gratis y sin registro.
          </p>
        </div>
      )}

      {/* Our own server-rendered markup: every interpolated value goes through
          escapeHtml at build time, and none of it comes from a request. */}
      {html && (
        <div className="city-landing-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}
