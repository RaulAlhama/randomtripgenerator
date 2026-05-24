export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="RandomTrip - inicio">
      <span className="logo-mark" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--teal-400)" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#logoGradient)" />
          <path
            d="M16 6.5c-3.2 4.2-3.2 12.7 0 19 3.2-6.3 3.2-14.8 0-19z"
            fill="white"
            opacity="0.92"
          />
          <circle cx="16" cy="16" r="2.25" fill="white" />
          <path
            d="M10 16h12"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      </span>
      <span className="logo-wordmark">
        <span className="logo-text">
          RandomTrip<span className="logo-text-accent">Generator</span>
        </span>
        <span className="logo-sub">Rutas con IA</span>
      </span>
    </a>
  );
}
