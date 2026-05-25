export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <span className="footer-logo">
            <img src="/icons/logo-mark.png" alt="" width="26" height="26" decoding="async" />
            RandomTrip
          </span>
          <p>Rutas turísticas generadas con IA. Descubre tu ciudad, o cualquier otra, en segundos.</p>
        </div>
        <div className="footer-links">
          <div className="footer-links-group">
            <h4>Producto</h4>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#inspiracion">Inspiración</a>
          </div>
          <div className="footer-links-group">
            <h4>Recursos</h4>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          </div>
          <div className="footer-links-group">
            <h4>Legal</h4>
            <a href="#privacidad">Privacidad</a>
            <a href="#terminos">Términos</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; {year} RandomTrip. Hecho con IA y mucho café.</span>
        <span className="footer-tech">
          Datos de OpenStreetMap · Meteorología de Open-Meteo · Rutas OSRM
        </span>
      </div>
    </footer>
  );
}
