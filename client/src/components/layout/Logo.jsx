function LogoMark({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="11" fill="#d05c28" />
      {/* Map pin body */}
      <path
        d="M22 8C17.582 8 14 11.582 14 16C14 22.4 22 36 22 36C22 36 30 22.4 30 16C30 11.582 26.418 8 22 8Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Map pin inner circle */}
      <circle cx="22" cy="16" r="4" fill="#d05c28" />
    </svg>
  );
}

export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="RandomTrip - inicio">
      <span className="logo-mark" aria-hidden="true">
        <LogoMark size={44} />
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
