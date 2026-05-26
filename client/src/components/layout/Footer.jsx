import { useState } from 'react';

function LegalModal({ title, onClose, children }) {
  return (
    <div className="legal-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="legal-modal-header">
          <h2>{title}</h2>
          <button className="legal-modal-close btn-icon" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="legal-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const [modal, setModal] = useState(null); // 'privacidad' | 'terminos' | null

  return (
    <>
      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <span className="footer-logo">
              <svg width="26" height="26" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="44" height="44" rx="11" fill="#d05c28"/>
                <path d="M22 8C17.582 8 14 11.582 14 16C14 22.4 22 36 22 36C22 36 30 22.4 30 16C30 11.582 26.418 8 22 8Z" fill="white" fillOpacity="0.95"/>
                <circle cx="22" cy="16" r="4" fill="#d05c28"/>
              </svg>
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
              <button className="footer-link-btn" onClick={() => setModal('privacidad')}>Privacidad</button>
              <button className="footer-link-btn" onClick={() => setModal('terminos')}>Términos</button>
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

      {modal === 'privacidad' && (
        <LegalModal title="Política de Privacidad" onClose={() => setModal(null)}>
          <div className="legal-wip">
            <span className="legal-wip-badge">🚧 En construcción</span>
            <p>Esta política de privacidad está actualmente en redacción y estará disponible próximamente.</p>
            <p>En líneas generales, RandomTrip <strong>no requiere registro</strong>, no almacena datos personales sin tu consentimiento y utiliza únicamente APIs públicas de terceros (OpenStreetMap, Open-Meteo, OSRM) para generar las rutas.</p>
            <p>Si tienes alguna pregunta, puedes contactarnos a través de los canales disponibles en la plataforma.</p>
          </div>
        </LegalModal>
      )}

      {modal === 'terminos' && (
        <LegalModal title="Términos de Uso" onClose={() => setModal(null)}>
          <div className="legal-wip">
            <span className="legal-wip-badge">🚧 En construcción</span>
            <p>Los términos y condiciones de uso están actualmente en redacción y estarán disponibles próximamente.</p>
            <p>RandomTrip es un servicio gratuito de generación de rutas turísticas. Las rutas se generan combinando datos de OpenStreetMap e inteligencia artificial y pueden contener imprecisiones. Úsalas siempre con criterio propio.</p>
            <p>Si tienes alguna pregunta, puedes contactarnos a través de los canales disponibles en la plataforma.</p>
          </div>
        </LegalModal>
      )}
    </>
  );
}
