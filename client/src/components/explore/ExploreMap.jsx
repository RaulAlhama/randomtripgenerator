import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { typeIcons } from '../../constants/poi';

const USER_ICON = L.divIcon({
  className: 'xp-user-marker',
  html: '<div class="xp-user-dot"><span></span></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const REST_ICON = L.divIcon({
  className: 'xp-rest-marker',
  html: '<div class="xp-rest-pin">\u{1F374}</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function spotIcon(place, { selected, number }) {
  const emoji = typeIcons[place.type] || typeIcons.default;
  const isNum = number != null;
  const inner = isNum ? String(number) : emoji;
  return L.divIcon({
    className: 'xp-spot-marker',
    html: `<div class="xp-pin${selected ? ' is-on' : ''}${isNum ? ' is-num' : ''}">${inner}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Keeps the visible (non-sheet-covered) area framed around the POIs.
function FitController({ origin, places, stage }) {
  const map = useMap();
  useEffect(() => {
    if (!origin || !places?.length) return;
    const bounds = L.latLngBounds([[origin.lat, origin.lng]]);
    places.forEach((p) => bounds.extend([p.lat, p.lng]));
    const docked = window.innerWidth >= 900;
    map.fitBounds(bounds, {
      paddingTopLeft: docked ? [460, 80] : [36, 110],
      paddingBottomRight: docked ? [36, 36] : [36, Math.round(window.innerHeight * 0.42)],
    });
  }, [map, origin?.lat, origin?.lng, places, stage]);
  return null;
}

export default function ExploreMap({
  origin,
  places,
  stage,
  selectedKeys,
  poiKey,
  restaurants,
  routeGeometry,
  onSpotTap,
}) {
  const isRoute = stage === 'route';

  const routeGeoJSON = useMemo(
    () => (routeGeometry ? { type: 'Feature', geometry: routeGeometry } : null),
    [routeGeometry]
  );

  return (
    <div className="xp-map">
      <MapContainer
        center={[origin.lat, origin.lng]}
        zoom={15}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitController origin={origin} places={places} stage={stage} />

        <Marker position={[origin.lat, origin.lng]} icon={USER_ICON} zIndexOffset={500}>
          <Popup><b>Estás aquí</b></Popup>
        </Marker>

        {places.map((place, index) => {
          const key = poiKey(place);
          const selected = isRoute || selectedKeys.has(key);
          const icon = spotIcon(place, {
            selected,
            number: isRoute ? index + 1 : null,
          });
          return (
            <Marker
              key={`spot-${key}`}
              position={[place.lat, place.lng]}
              icon={icon}
              zIndexOffset={selected ? 300 : 100}
              eventHandlers={{ click: () => onSpotTap?.(place) }}
            />
          );
        })}

        {(restaurants || []).map((r) => (
          r.lat != null && r.lng != null && (
            <Marker key={`rest-${r.placeId}`} position={[r.lat, r.lng]} icon={REST_ICON}>
              <Popup>
                <div className="popup-title"><b>{r.name}</b></div>
                <div className="popup-type">
                  ★ {r.rating} ({r.userRatingsTotal}) ·{' '}
                  <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer">Maps</a>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {isRoute && routeGeoJSON && (
          <GeoJSON
            key={JSON.stringify(routeGeometry).length}
            data={routeGeoJSON}
            style={{ color: '#3f6a64', weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
