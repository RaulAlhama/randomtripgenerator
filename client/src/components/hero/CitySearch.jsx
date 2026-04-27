import { useState, useEffect, useRef, useCallback } from 'react';
import { useTrip } from '../../context/TripContext';
import { searchCity } from '../../services/api';

export default function CitySearch() {
  const { setSearchLocation } = useTrip();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  const handleSearch = useCallback(async (value) => {
    if (value.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    try {
      const cities = await searchCity(value);
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

  const handleSelectCity = (city) => {
    setSearchLocation({ lat: parseFloat(city.lat), lng: parseFloat(city.lng) });
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
          <div className="city-result-item no-results">No se encontraron ciudades</div>
        ) : (
          results.map((city, index) => (
            <div
              key={`${city.lat}-${city.lng}-${index}`}
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
