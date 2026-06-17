import Icon from '../ui/Icon';

const TABS = [
  { key: 'route', label: 'Ruta turística', iconName: 'map' },
  { key: 'restaurants', label: 'Mejores restaurantes', iconName: 'fork' },
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
          <span className="hero-tab-icon" aria-hidden="true"><Icon name={tab.iconName} size={18} /></span>
          <span className="hero-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
