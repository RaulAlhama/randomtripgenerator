import { useEffect, useState } from 'react';
import { SEO_CITIES } from '../../constants/cities';

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

const unsplash = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

// The page's <h1> is lifted out of the adopted block and rendered above the
// action, so the page opens with where you are instead of a button. Same text,
// still the only h1 on the page: what the crawler indexes doesn't change, only
// the order a person reads it in. Read during the first render (the block is
// in the DOM before React mounts), so the title doesn't pop in a frame later.
function adoptSeoContent() {
  const node = document.getElementById('seo-content');
  if (!node || !node.innerHTML.trim()) return { title: '', html: '' };
  const copy = node.cloneNode(true);
  const h1 = copy.querySelector('h1');
  const title = h1 ? h1.textContent.trim() : '';
  if (h1) h1.remove();
  return { title, html: copy.innerHTML };
}

// `walk` is present on the 2-hour pages: that page's own route. Then the main
// action is taking it, and generating a different one becomes the alternative.
export default function CityLanding({ city, onExplore, walk = null, onWalk }) {
  const [{ title, html }] = useState(adoptSeoContent);
  const photo = SEO_CITIES.find((c) => c.slug === city.slug);

  useEffect(() => {
    // Remove the original, or the page carries the same content twice.
    document.getElementById('seo-content')?.remove();
  }, []);

  return (
    <section className="city-landing">
      {photo?.photo && (
        <figure className="city-landing-photo">
          {/* Above the fold on every landing: fetched first, sized up front so
              the title and the button don't jump when it arrives. */}
          <img
            src={unsplash(photo.photo, 1200, 750)}
            srcSet={[640, 960, 1200, 1600].map((w) => `${unsplash(photo.photo, w, Math.round(w * 0.625))} ${w}w`).join(', ')}
            sizes="(min-width: 760px) 720px, 100vw"
            width="1200"
            height="750"
            alt={`Vista de ${city.name}`}
            fetchPriority="high"
            decoding="async"
          />
          <figcaption>
            Foto: {photo.photoBy && photo.photoBy !== 'Unsplash' ? `${photo.photoBy} / ` : ''}Unsplash
          </figcaption>
        </figure>
      )}
      {walk ? (
        <div className="city-landing-cta">
          <p className="city-landing-kicker">
            {walk.stops.length} paradas
            {walk.distanceM ? ` · ${(walk.distanceM / 1000).toFixed(1).replace('.', ',')} km` : ''}
            {/* "con visitas": the route view right after shows walking time alone
                (Toledo: 50 min), and two bare figures read as a contradiction. */}
            {' · '}unas 2 horas con visitas
          </p>
          <h1 className="city-landing-title">{title || `Qué ver en ${city.name} en 2 horas a pie`}</h1>
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
          <h1 className="city-landing-title">{title || `Qué visitar en ${city.name}`}</h1>
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
