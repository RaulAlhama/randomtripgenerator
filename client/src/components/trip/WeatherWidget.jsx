import { useTrip } from '../../context/TripContext';

function UVLabel(index) {
  if (index <= 2) return 'Bajo';
  if (index <= 5) return 'Moderado';
  if (index <= 7) return 'Alto';
  if (index <= 10) return 'Muy alto';
  return 'Extremo';
}

export default function WeatherWidget() {
  const { weather } = useTrip();

  if (!weather) return null;

  return (
    <div className="weather-card">
      <span className="weather-icon" aria-hidden="true">{weather.icon}</span>
      <div className="weather-primary">
        <span className="weather-temp">{weather.temp}&deg;</span>
        <span className="weather-desc">{weather.desc}</span>
      </div>
      {weather.tempMax != null && (
        <span className="weather-minmax">
          <span className="weather-max">&uarr;{weather.tempMax}&deg;</span>
          <span className="weather-min">&darr;{weather.tempMin}&deg;</span>
        </span>
      )}
      <div className="weather-stats">
        <span className="weather-stat" title="Humedad">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          {weather.humidity}%
        </span>
        <span className="weather-stat" title="Viento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
            <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
          </svg>
          {weather.wind} km/h
        </span>
        {weather.precipProb != null && (
          <span className="weather-stat" title="Prob. lluvia">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M16 14v2a4 4 0 1 1-8 0V8a4 4 0 0 1 8 0v6" />
            </svg>
            {weather.precipProb}%
          </span>
        )}
        {weather.uvIndex != null && (
          <span className="weather-stat" title={`UV ${UVLabel(weather.uvIndex)}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
            UV {weather.uvIndex}
          </span>
        )}
        {weather.sunrise && weather.sunset && (
          <span className="weather-stat" title="Amanecer / Atardecer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2v4M4.93 7.93l1.41 1.41M20 12h-2M4 12H2M17.66 9.34l1.41-1.41" />
              <path d="M16 16a4 4 0 0 0-8 0" />
              <path d="M2 20h20" />
            </svg>
            {weather.sunrise} · {weather.sunset}
          </span>
        )}
      </div>
    </div>
  );
}
