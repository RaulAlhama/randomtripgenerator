const STEPS = [
  {
    title: 'Elige tu punto de partida',
    description: 'Usa tu ubicación o busca cualquier ciudad. Nosotros detectamos barrio, comarca y país.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: 'Personaliza tu ruta',
    description: 'Tema, transporte y distancia. En segundos, nuestra IA arma un itinerario coherente con puntos reales.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    title: 'Sal a explorar',
    description: 'Ruta trazada en el mapa, tiempo del trayecto y tiempo meteorológico. Abre en Google Maps y listo.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 20-6-3V4l6 3M9 20V7M9 20l6-3M15 17V4M15 17l6 3V7l-6-3" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="como-funciona" aria-labelledby="how-it-works-title">
      <div className="section-intro">
        <span className="section-eyebrow">Cómo funciona</span>
        <h2 id="how-it-works-title">De la idea al itinerario en tres pasos</h2>
        <p>
          Pensado para cuando tienes curiosidad pero poco tiempo de planificar.
          Descubre sitios reales que quizá no conocías, guiados por IA.
        </p>
      </div>
      <ol className="steps-grid">
        {STEPS.map((step, index) => (
          <li className="step-card" key={step.title}>
            <div className="step-card-head">
              <span className="step-card-num">0{index + 1}</span>
              <span className="step-card-icon" aria-hidden="true">{step.icon}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
