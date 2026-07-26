import { useEffect, useRef, useState } from 'react';

// Fill these in before treating the legal texts as final — they appear verbatim
// in the Privacy/Terms modals, and a review notice is shown while they're unset.
const LEGAL_OWNER = 'Raúl García Alcaraz';
const LEGAL_EMAIL = 'raulgar3600@gmail.com';
const LEGAL_UPDATED = '26 de julio de 2026';
const LEGAL_NEEDS_REVIEW = LEGAL_OWNER.startsWith('[') || LEGAL_EMAIL.startsWith('[');

function LegalModal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Accessibility: move focus into the dialog on open, keep Tab inside it, close
  // on Escape, and hand focus back to whatever opened it. Without this a keyboard
  // or screen-reader user stays stranded on the page behind the overlay.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="legal-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="legal-modal-header">
          <h2>{title}</h2>
          <button className="legal-modal-close btn-icon" onClick={onClose} aria-label="Cerrar" ref={closeRef}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="legal-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ReviewNotice() {
  if (!LEGAL_NEEDS_REVIEW) return null;
  return (
    <p className="legal-review-notice">
      <strong>Pendiente de completar:</strong> sustituye el responsable y el email de contacto
      en <code>Footer.jsx</code> antes de dar estos textos por definitivos.
    </p>
  );
}

function PrivacyDoc() {
  return (
    <div className="legal-doc">
      <ReviewNotice />
      <p className="legal-doc-updated">Última actualización: {LEGAL_UPDATED}</p>

      <h3>Quién es el responsable</h3>
      <p>
        El responsable del tratamiento de los datos de RandomTrip
        (<a href="https://randomtripgenerator.com">randomtripgenerator.com</a>) es {LEGAL_OWNER}.
        Para cualquier cuestión relacionada con privacidad puedes escribir a {LEGAL_EMAIL}.
      </p>

      <h3>Qué datos tratamos y para qué</h3>
      <ul>
        <li>
          <strong>Tu ubicación:</strong> si aceptas el permiso del navegador, usamos tus coordenadas
          para buscar lugares cercanos. Se envían a nuestro servidor para generar la ruta y
          <strong> no se guardan</strong>, salvo que guardes esa ruta teniendo cuenta.
        </li>
        <li>
          <strong>Cuenta de usuario (opcional):</strong> el registro y el inicio de sesión los
          gestiona Auth0. Si creas una cuenta, guardamos tu identificador de usuario para asociarte
          las rutas que guardes.
        </li>
        <li>
          <strong>Rutas guardadas:</strong> ciudad, país, coordenadas de origen, lugares de la ruta,
          distancia, duración y fecha. Solo si tienes cuenta.
        </li>
        <li>
          <strong>Preferencias en tu dispositivo:</strong> los lugares que marcas como favoritos y el
          tema claro/oscuro se guardan en el almacenamiento local de tu navegador, no en nuestro
          servidor. Puedes borrarlos limpiando los datos del sitio.
        </li>
        <li>
          <strong>Estadísticas de uso:</strong> usamos Umami, una herramienta de analítica
          <strong> sin cookies</strong> que recoge datos agregados y no construye perfiles ni te
          identifica individualmente. Por eso no mostramos banner de cookies.
        </li>
      </ul>

      <h3>Rutas compartidas</h3>
      <p>
        Si usas el botón de compartir, se crea un enlace público (<code>/r/…</code>) con los datos de
        esa ruta: ciudad, paradas, coordenadas de inicio, distancia y duración. Cualquier persona con
        el enlace puede verla, así que no lo compartas si consideras sensible tu punto de partida.
      </p>

      <h3>Terceros que intervienen</h3>
      <p>Para funcionar, la aplicación consulta servicios externos, cada uno con su propia política:</p>
      <ul>
        <li><strong>OpenStreetMap</strong> (Overpass y Nominatim) y <strong>Wikipedia/Wikimedia</strong>: lugares, mapas e imágenes.</li>
        <li><strong>Google Maps Platform</strong> (Places): fotos, valoraciones, horarios y búsqueda de ciudades.</li>
        <li><strong>OpenRouteService</strong> u <strong>OSRM</strong>: cálculo del trazado a pie.</li>
        <li><strong>Open-Meteo</strong>: meteorología del destino.</li>
        <li><strong>Auth0</strong>: autenticación, solo si inicias sesión.</li>
        <li><strong>Un proveedor de IA</strong> (actualmente Google Gemini): redacta la descripción de los lugares que no tienen artículo en Wikipedia. Solo recibe el nombre público del lugar y la ciudad; nunca datos tuyos.</li>
      </ul>
      <p>
        Estos servicios reciben la información técnica mínima necesaria para responder (por ejemplo,
        tu dirección IP al cargar los mapas), de acuerdo con su propio funcionamiento.
      </p>

      <h3>Enlaces de afiliado</h3>
      <p>
        Algunas secciones incluyen enlaces a plataformas de actividades turísticas señalizados como
        patrocinados. Si reservas a través de ellos podemos recibir una comisión, sin coste adicional
        para ti. Al seguirlos, pasas a la web del proveedor y se aplican sus condiciones.
      </p>

      <h3>Dónde se alojan los datos</h3>
      <p>
        La aplicación se aloja en Render (servidores en Fráncfort, Alemania) y la base de datos en
        Neon (Unión Europea/Reino Unido). Conservamos las rutas guardadas mientras mantengas la
        cuenta; puedes eliminarlas en cualquier momento desde la propia aplicación.
      </p>

      <h3>Tus derechos</h3>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, portabilidad, limitación y
        oposición escribiendo a {LEGAL_EMAIL}. También puedes borrar tus rutas directamente en la
        aplicación y solicitar la eliminación completa de tu cuenta. Si crees que no hemos atendido
        correctamente tu solicitud, puedes reclamar ante la autoridad de protección de datos
        competente (en España, la AEPD).
      </p>

      <h3>Menores</h3>
      <p>
        El servicio no está dirigido a menores de 14 años y no recogemos datos de forma consciente de
        personas de esa edad.
      </p>
    </div>
  );
}

function TermsDoc() {
  return (
    <div className="legal-doc">
      <ReviewNotice />
      <p className="legal-doc-updated">Última actualización: {LEGAL_UPDATED}</p>

      <h3>Qué es este servicio</h3>
      <p>
        RandomTrip es una aplicación web gratuita que sugiere lugares cercanos y traza una ruta a pie
        entre ellos. Al usarla aceptas estas condiciones. Titular del servicio: {LEGAL_OWNER}.
        Contacto: {LEGAL_EMAIL}.
      </p>

      <h3>Uso responsable de la información</h3>
      <p>
        Las rutas y los datos de cada lugar se generan de forma automática a partir de fuentes
        externas (OpenStreetMap, Google, Wikipedia) y de un modelo de lenguaje, por lo que
        <strong> pueden contener errores, estar desactualizados o resultar imprecisos</strong>:
        horarios, valoraciones, accesibilidad o incluso la existencia de un sitio. Verifica siempre la
        información importante antes de desplazarte.
      </p>
      <p>
        Los trazados son orientativos y <strong>no son indicaciones de navegación</strong>. Tú eres
        responsable de tu seguridad y de circular respetando las normas de tráfico y las condiciones
        del terreno. No nos hacemos responsables de daños o perjuicios derivados del uso de las rutas.
      </p>

      <h3>Condiciones de uso</h3>
      <ul>
        <li>Usa el servicio de forma personal y no automatizada: no está permitido raspar contenidos ni saturar la API con peticiones masivas.</li>
        <li>Existen límites de uso por seguridad y coste; si se alcanzan, algunas funciones pueden degradarse temporalmente.</li>
        <li>No garantizamos disponibilidad continua: el servicio depende de APIs de terceros y puede interrumpirse o cambiar sin aviso.</li>
        <li>Podemos modificar o retirar funciones, y actualizar estos términos; la fecha de arriba indica la última versión.</li>
      </ul>

      <h3>Cuentas y contenido</h3>
      <p>
        La cuenta es opcional y sirve para guardar rutas. Eres responsable del uso que se haga de tus
        credenciales. Podemos suspender cuentas que incumplan estas condiciones o que perjudiquen el
        servicio.
      </p>

      <h3>Atribución y propiedad intelectual</h3>
      <p>
        Los datos de lugares provienen de OpenStreetMap, disponibles bajo la licencia ODbL, y los
        textos e imágenes de Wikipedia y Wikimedia Commons bajo sus respectivas licencias. Las fotos,
        valoraciones y horarios provienen de Google Maps Platform y están sujetos a sus términos. El
        nombre, el diseño y el código de RandomTrip pertenecen a su titular.
      </p>

      <h3>Enlaces de afiliado</h3>
      <p>
        La aplicación puede mostrar enlaces patrocinados a plataformas de actividades turísticas por
        los que podemos percibir una comisión. No influyen en los lugares que se te proponen, que se
        seleccionan únicamente a partir de datos abiertos.
      </p>

      <h3>Legislación aplicable</h3>
      <p>
        Estas condiciones se rigen por la legislación española. Para cualquier controversia serán
        competentes los juzgados y tribunales que correspondan según la normativa de consumo
        aplicable.
      </p>
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
              <img src="/icons/logo-mark.png" alt="" width="26" height="26" decoding="async" />
              RandomTrip
            </span>
            <p>Rutas turísticas a pie generadas en segundos: detecta dónde estás y traza un itinerario por lugares reales de OpenStreetMap, con fotos, valoraciones y horarios de Google. Gratis y sin registro, en tu ciudad o en cualquier otra del mundo.</p>
          </div>
          <div className="footer-links">
            <div className="footer-links-group">
              <h4>Producto</h4>
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
            Datos de OpenStreetMap · Meteorología de Open-Meteo · Rutas OpenRouteService ·{' '}
            Fotos de ciudades vía{' '}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
          </span>
        </div>
      </footer>

      {modal === 'privacidad' && (
        <LegalModal title="Política de Privacidad" onClose={() => setModal(null)}>
          <PrivacyDoc />
        </LegalModal>
      )}

      {modal === 'terminos' && (
        <LegalModal title="Términos de Uso" onClose={() => setModal(null)}>
          <TermsDoc />
        </LegalModal>
      )}
    </>
  );
}
