import LocationPicker from './LocationPicker';
import ThemeSelector from './ThemeSelector';
import TransportSelector from './TransportSelector';
import DistanceSlider from './DistanceSlider';
import GenerateButton from './GenerateButton';

export default function Hero() {
  return (
    <section className="hero">
      <h1>Descubre tu próxima <span className="gradient-text">aventura</span></h1>
      <p className="subtitle">
        Rutas turísticas generadas con IA desde tu ubicación o cualquier ciudad del mundo
      </p>
      <LocationPicker />
      <ThemeSelector />
      <TransportSelector />
      <DistanceSlider />
      <GenerateButton />
    </section>
  );
}
