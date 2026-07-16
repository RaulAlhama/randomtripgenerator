import { useState, useEffect, useRef, useCallback } from 'react';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import { searchCity, resolveCity } from '../../services/api';

// Google bills autocomplete per session: all keystrokes + the final resolve
// share one token, regenerated after each selection.
function newSessionToken() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export default function CitySearch() {
  const { setSearchLocation } = useTrip();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const sessionRef = useRef(null);

  const handleSearch = useCallback(async (value) => {
    if (value.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    if (!sessionRef.current) sessionRef.current = newSessionToken();
    try {
      const cities = await searchCity(value, sessionRef.current);
      setResults(cities);
      setShowResults(true);
    } catch (error) {
      console.error('Error de búsqueda:', error);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value.trim()), 300);
  };

  const handleSelectCity = async (city) => {
    let { lat, lng } = city;
    if (city.placeId && (lat == null || lng == null)) {
      try {
        const loc = await resolveCity(city.placeId, sessionRef.current);
        lat = loc.lat;
        lng = loc.lng;
      } catch (error) {
        console.error('Error al resolver la ciudad:', error);
        showToast('No se pudo localizar la ciudad, inténtalo de nuevo', 'error');
        return;
      }
    }
    sessionRef.current = null; // selection closes the Google billing session
    setSearchLocation({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      name: city.name,
      country: city.country || '',
    });
    const label = city.region
      ? `${city.name}, ${city.region}, ${city.country}`
      : `${city.name}, ${city.country}`;
    setQuery(label);
    setShowResults(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <input
        type="text"
        placeholder="Busca una ciudad..."
        value={query}
        onChange={handleInputChange}
        autoComplete="off"
      />
      <div className={`city-results${showResults ? '' : ' hidden'}`}>
        {results.length === 0 && showResults ? (
          <div className="city-result-item no-results">
            {query.trim().length < 5
              ? 'Sigue escribiendo el nombre…'
              : 'Sin coincidencias. Prueba con otro nombre.'}
          </div>
        ) : (
          results.map((city, index) => (
            <div
              key={`${city.placeId || `${city.lat}-${city.lng}`}-${index}`}
              className="city-result-item"
              onClick={() => handleSelectCity(city)}
            >
              <strong>{city.name}</strong>
              <span className="city-country">
                {[city.region, city.country].filter(Boolean).join(', ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
