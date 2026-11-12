import { SEO_CITIES } from '../../constants/cities';

// One section where there were two. The auto-scrolling carousel and the row of
// city chips were the same offer twice — "pick a city" — and the chips were
// capsules, which is the shape this project is trying to stop using.
//
// Merging also fixed two things that weren't about looks. The carousel rendered
// every card TWICE to fake an infinite loop, so the homepage carried ten
// duplicate links; and it covered ten cities while twelve have a landing page,
// so Zaragoza and Santiago only ever appeared as chips.
//
// The cards are real <a href> now, not buttons. A crawler follows them, a
// middle click opens a tab, and the visitor lands on a page that shows what's
// there before asking for anything — the "Generar mi ruta por X" button lives on
// that page. The old card fired the deck immediately, which was faster but
// skipped the content the page exists for.
const photo = (id, w, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

// Spain first, then the rest of Europe: a visitor looks for their city under
// its heading instead of scanning forty tiles.
const GROUPS = [
  { title: 'España', cities: SEO_CITIES.filter((c) => !c.country) },
  { title: 'Europa', cities: SEO_CITIES.filter((c) => c.country) },
].filter((g) => g.cities.length);

export default function CityGrid() {
  return (
    <section className="city-grid-section" id="inspiracion" aria-labelledby="city-grid-title">
      <div className="city-grid-head">
        <span className="city-grid-eyebrow">Ciudades</span>
        <h2 id="city-grid-title">Rutas ya preparadas</h2>
        <p>
          Un paseo de dos horas por el centro, con lugares reales. Para cuando
          no estás donde quieres pasear.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div className="city-grid-group" key={group.title}>
          <h3 className="city-grid-group-title">{group.title}</h3>
          <ul className="city-grid">
            {group.cities.map((c) => (
              <li key={c.slug}>
                <a className="city-tile" href={`/ciudad/${c.slug}`}>
                  <img
                    className="city-tile-photo"
                    src={photo(c.photo, 480, 320)}
                    alt={`${c.name}, ${c.country || 'España'}`}
                    title={c.photoBy ? `Foto de ${c.photoBy} · Unsplash` : undefined}
                    width="480"
                    height="320"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="city-tile-name">{c.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
