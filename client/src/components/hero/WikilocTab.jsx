import { useState } from 'react';
import LocationPicker from './LocationPicker';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import { getUserLocation } from '../../services/location';

function buildWikilocUrl({ lat, lng, query }) {
  if (lat != null && lng != null) {
    return `https://es.wikiloc.com/wikiloc/map.do?sw=${(lat - 0.15).toFixed(4)},${(lng - 0.2).toFixed(4)}&ne=${(lat + 0.15).toFixed(4)},${(lng + 0.2).toFixed(4)}&page=1`;
  }
  if (query) {
    return `https://es.wikiloc.com/wikiloc/find.do?q=${encodeURIComponent(query)}`;
  }
  return 'https://es.wikiloc.com/';
}

export default function WikilocTab() {
  const { locationMode, searchLocation } = useTrip();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    try {
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
      const url = buildWikilocUrl({ lat: origin.lat, lng: origin.lng });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      showToast(e.message || 'Error al abrir Wikiloc', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="search-field-group">
        <span className="search-field-label">¿Dónde quieres caminar?</span>
        <LocationPicker />
      </div>

      <div className="wikiloc-info">
        <p>
          Te llevamos a <strong>Wikiloc</strong>, la mayor comunidad de rutas al aire
          libre, mostrando senderos cerca de la ubicación que elijas.
        </p>
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
              Abriendo...
            </>
          ) : (
            <>🌿 Ver rutas en Wikiloc →</>
          )}
        </button>
      </div>
    </>
  );
}
