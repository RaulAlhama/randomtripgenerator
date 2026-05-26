export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="RandomTrip - inicio">
      <span className="logo-mark" aria-hidden="true">
        <img
          src="/icons/logo-mark.png"
          alt=""
          width="44"
          height="44"
          decoding="async"
        />
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
