import { useState } from 'react';
import LocationPicker from './LocationPicker';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import { fetchRestaurants } from '../../services/api';
import { getUserLocation } from '../../services/location';
import Icon from '../ui/Icon';

const RADIUS_OPTIONS = [0.5, 1, 2, 3];

function priceLabel(level) {
  if (level == null) return '';
  return '€'.repeat(Math.max(1, Math.min(4, level)));
}

function Stars({ rating }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="restaurant-stars" aria-label={`${rating} de 5 estrellas`}>
      {'★'.repeat(full)}{half ? '½' : ''}
    </span>
  );
}

export default function RestaurantsTab() {
  const { locationMode, searchLocation } = useTrip();
  const { showToast } = useToast();
  const [radius, setRadius] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    try {
      setError(null);
      setLoading(true);

      let origin;
      if (locationMode === 'search') {
        if (!searchLocation) {
          throw new Error('Busca y selecciona una ciudad primero');
        }
        origin = searchLocation;
      } else {
        origin = await getUserLocation();
      }

      const data = await fetchRestaurants(origin.lat, origin.lng, Math.round(radius * 1000));
      if (!data.restaurants || data.restaurants.length === 0) {
        setResult({ ...data, restaurants: [] });
        showToast('No se encontraron restaurantes en esa zona', 'info');
      } else {
        setResult(data);
      }
    } catch (e) {
      const msg = e.message || 'Error al buscar restaurantes';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="search-field-group">
        <span className="search-field-label">¿Desde dónde buscas?</span>
        <LocationPicker />
      </div>

      <div className="search-field-group">
        <span className="search-field-label">Radio de búsqueda</span>
        <div className="radius-chips">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`radius-chip${radius === r ? ' active' : ''}`}
              onClick={() => setRadius(r)}
            >
              {r < 1 ? `${r * 1000} m` : `${r} km`}
            </button>
          ))}
        </div>
      </div>

      <div className="search-cta">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Buscando...
            </>
          ) : (
            <><Icon name="fork" size={16} /> Ver mejores restaurantes</>
          )}
        </button>
      </div>

      {error && !loading && (
        <div className="restaurants-error">{error}</div>
      )}

      {result && !loading && (
        <div className="restaurants-result">
          <div className="restaurants-result-head">
            <span className="restaurants-result-city">{result.city}</span>
            <span className="restaurants-result-count">{result.restaurants.length} resultados</span>
          </div>
          {result.restaurants.length === 0 ? (
            <p className="restaurants-empty">Sin resultados. Prueba a aumentar el radio.</p>
          ) : (
            <ul className="restaurants-list">
              {result.restaurants.map((r) => (
                <li key={r.placeId} className="restaurant-card">
                  {r.photoUrl ? (
                    <img className="restaurant-photo" src={r.photoUrl} alt={r.name} loading="lazy" />
                  ) : (
                    <div className="restaurant-photo restaurant-photo-empty" aria-hidden="true"><Icon name="fork" size={32} strokeWidth={1.6} /></div>
                  )}
                  <div className="restaurant-info">
                    <div className="restaurant-top">
                      <h3 className="restaurant-name">{r.name}</h3>
                      {r.openNow !== null && (
                        <span className={r.openNow ? 'restaurant-open' : 'restaurant-closed'}>
                          {r.openNow ? 'Abierto' : 'Cerrado'}
                        </span>
                      )}
                    </div>
                    <div className="restaurant-meta">
                      <span className="restaurant-rating">
                        <Stars rating={r.rating} />
                        <strong>{r.rating.toFixed(1)}</strong>
                        <span className="restaurant-rating-count">({r.userRatingsTotal})</span>
                      </span>
                      {r.priceLevel != null && (
                        <span className="restaurant-price">{priceLabel(r.priceLevel)}</span>
                      )}
                    </div>
                    {r.address && <p className="restaurant-address">{r.address}</p>}
                    <a
                      className="restaurant-link"
                      href={r.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver en Google Maps →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
