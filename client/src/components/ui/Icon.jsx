const PATHS = {
  pin: (
    <>
      <path d="M12 2.5c-3.86 0-7 3.05-7 6.82 0 5.1 7 12.18 7 12.18s7-7.08 7-12.18c0-3.77-3.14-6.82-7-6.82z" />
      <circle cx="12" cy="9.3" r="2.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6.2v13.6L9 17.6m0-13.6 6 2.4M9 4v13.6m6-11.2 6-2.4v13.6l-6 2.4m0-13.6v13.6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 2.7 19.5h18.6L12 3.5z" />
      <path d="M12 10.5v4.2" />
      <circle cx="12" cy="17.4" r="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  fork: (
    <>
      <path d="M7 3v6.5a2.5 2.5 0 0 0 5 0V3M9.5 9.5V21" />
      <path d="M17.5 3c-1.5 0-2.5 1.7-2.5 4v4.5h2.5V21M17.5 11.5h2.5V7c0-2.3-1-4-2.5-4z" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 6-13 15-13-.5 9-5.5 14-13 14-1 0-1.5-.4-2-1z" />
      <path d="M5 19c2.5-3.5 6-7 11-9" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  // Theme icons for the inspiration carousel — one per theme key used by INSPIRATION_EXAMPLES.
  monuments: (
    <>
      <path d="M3 21h18M5 21V10l7-5 7 5v11" />
      <path d="M10 21v-6h4v6" />
      <path d="M8 13h0.01M16 13h0.01" />
    </>
  ),
  historical: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h9l5 5v13" />
      <path d="M14 3v6h6" />
      <path d="M8 12h7M8 16h7" />
    </>
  ),
  cultural: (
    <>
      <path d="M8 3a4 4 0 0 0-4 4v3a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4z" />
      <path d="M16 3a4 4 0 0 0-4 4v3a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4z" />
      <path d="M4 14c0 4 3 7 8 7s8-3 8-7" />
    </>
  ),
  classic: (
    <>
      <path d="m12 3 2.3 5.6 6 .5-4.6 4 1.4 5.9L12 16l-5.1 3 1.4-5.9-4.6-4 6-.5L12 3z" />
    </>
  ),
  surprise: (
    <>
      <path d="M4 9h16v11H4z" />
      <path d="M2 5h20v4H2z" />
      <path d="M12 5v15" />
      <path d="M8 5c0-1.7 1.3-3 3-3s3 1.3 3 3M16 5c0-1.7-1.3-3-3-3" />
    </>
  ),
};

export default function Icon({ name, size = 16, strokeWidth = 1.8, className, style, title }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {path}
    </svg>
  );
}
