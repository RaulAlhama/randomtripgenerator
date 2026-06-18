export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="RandomTrip - inicio">
      <span className="logo-mark" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="44" height="44" rx="12" fill="currentColor" />
          <path
            d="M22 11c-4.2 0-7.5 3.3-7.5 7.5 0 5.4 7.5 13 7.5 13s7.5-7.6 7.5-13C29.5 14.3 26.2 11 22 11z"
            fill="#fff"
          />
          <circle cx="22" cy="18.5" r="3" fill="currentColor" />
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
