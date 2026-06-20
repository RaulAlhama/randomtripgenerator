import { useSaved } from '../../context/SavedContext';
import { typeIcons, typeLabels } from '../../constants/poi';

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function SavedCard({ item, onRemove }) {
  const isRestaurant = item.kind === 'restaurant';
  const icon = isRestaurant ? '🍴' : (typeIcons[item.type] || typeIcons.default);
  const chip = isRestaurant ? 'Restaurante' : (typeLabels[item.type] || typeLabels.default);

  return (
    <article className="saved-card">
      <div
        className="saved-card-photo"
        style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
      >
        {!item.imageUrl && <span className="saved-card-photo-icon" aria-hidden="true">{icon}</span>}
        <span className="saved-card-chip">{chip}</span>
        <button
          type="button"
          className="saved-card-heart"
          onClick={() => onRemove(item.key)}
          aria-label="Quitar de guardados"
        >
          <HeartIcon />
        </button>
      </div>
      <div className="saved-card-body">
        <h3 className="saved-card-name">{item.name}</h3>
        <div className="saved-card-meta">
          {item.city && <span>{item.city}</span>}
          {typeof item.rating === 'number' && item.rating > 0 && (
            <span className="saved-card-rating">★ {item.rating.toFixed(1)}</span>
          )}
        </div>
        {item.address && <p className="saved-card-sub">{item.address}</p>}
        {isRestaurant && item.mapsUrl && (
          <a className="saved-card-link" href={item.mapsUrl} target="_blank" rel="noopener noreferrer">
            Encontrar lugar
          </a>
        )}
      </div>
    </article>
  );
}

export default function SavedView() {
  const { saved, removeSaved } = useSaved();

  const places = saved.filter((s) => s.kind !== 'restaurant');
  const restaurants = saved.filter((s) => s.kind === 'restaurant');

  if (saved.length === 0) {
    return (
      <section className="saved-view">
        <h2 className="saved-view-title">Guardados</h2>
        <div className="saved-empty">
          <div className="saved-empty-icon" aria-hidden="true">🤍</div>
          <p className="saved-empty-title">Aún no has guardado nada</p>
          <p className="saved-empty-sub">
            Toca el corazón en cualquier sitio o restaurante para guardarlo aquí y tenerlo a mano.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="saved-view">
      <h2 className="saved-view-title">Guardados</h2>

      {places.length > 0 && (
        <>
          <h3 className="saved-group-title">Sitios · {places.length}</h3>
          <div className="saved-grid">
            {places.map((item) => (
              <SavedCard key={item.key} item={item} onRemove={removeSaved} />
            ))}
          </div>
        </>
      )}

      {restaurants.length > 0 && (
        <>
          <h3 className="saved-group-title">Restaurantes · {restaurants.length}</h3>
          <div className="saved-grid">
            {restaurants.map((item) => (
              <SavedCard key={item.key} item={item} onRemove={removeSaved} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
