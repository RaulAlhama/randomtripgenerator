import { SEO_CITIES } from '../../constants/cities';

// The /ciudad/* landing pages had no way in from the running app: they were
// reachable only by typing the URL or arriving from search. The homepage's
// pre-rendered block did link to all twelve, but React replaces that block on
// mount, so those links existed for a crawler that doesn't run JS and for nobody
// else — including Googlebot, which does. This puts them in the rendered DOM and
// gives a visitor somewhere to go when they're not standing in the city they
// want to walk around.
export default function CityLinks() {
  return (
    <nav className="city-links" aria-labelledby="city-links-heading">
      <h2 id="city-links-heading" className="city-links-title">Rutas por ciudad</h2>
      <p className="city-links-sub">
        Itinerarios a pie ya preparados, para cuando no estás donde quieres pasear.
      </p>
      <ul className="city-links-list">
        {SEO_CITIES.map((c) => (
          <li key={c.slug}>
            <a href={`/ciudad/${c.slug}`}>{c.name}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
