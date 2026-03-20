import { useTrip } from '../../context/TripContext';

export default function WeatherWidget() {
  const { weather } = useTrip();

  if (!weather) return null;

  return (
    <div className="weather-widget">
      <span className="weather-icon">{weather.icon}</span>
      <span className="weather-temp">{weather.temp}&deg;C</span>
      <span className="weather-desc">{weather.desc}</span>
      <span className="weather-extra">
        Humedad {weather.humidity}% &middot; Viento {weather.wind} km/h
      </span>
    </div>
  );
}
