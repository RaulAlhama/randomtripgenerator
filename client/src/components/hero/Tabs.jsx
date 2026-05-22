const TABS = [
  { key: 'route', label: 'Ruta turística', icon: '\u{1F5FA}️' },
  { key: 'restaurants', label: 'Mejores restaurantes', icon: '\u{1F37D}️' },
  { key: 'wikiloc', label: 'Naturaleza', icon: '\u{1F33F}' },
];

export default function Tabs({ activeTab, onChange }) {
  return (
    <div className="hero-tabs" role="tablist" aria-label="Tipo de búsqueda">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`hero-tab${activeTab === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          <span className="hero-tab-icon" aria-hidden="true">{tab.icon}</span>
          <span className="hero-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
