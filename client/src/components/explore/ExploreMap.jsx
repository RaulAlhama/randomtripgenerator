import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { typeIcons } from '../../constants/poi';
import { spreadPins } from '../../lib/spreadPins';

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

// `offset` moves the drawn pin, in pixels, without moving the marker: see
// spreadPins. Shifting the anchor the other way is how Leaflet draws an icon
// somewhere other than its point.
function spotIcon(place, { selected, number, offset }) {
  const emoji = typeIcons[place.type] || typeIcons.default;
  const isNum = number != null;
  const inner = isNum ? String(number) : emoji;
  const dx = offset?.dx || 0;
  const dy = offset?.dy || 0;
  return L.divIcon({
    className: 'xp-spot-marker',
    html: `<div class="xp-pin${selected ? ' is-on' : ''}${isNum ? ' is-num' : ''}">${inner}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17 - dx, 17 - dy],
  });
}

// Pixel offsets that keep the numbered route pins from covering each other at
// the current zoom; recomputed whenever the zoom or the stops change. Empty
// outside the route stage, where the pins aren't numbered.
function usePinSpread(places, enabled) {
  const map = useMap();
  const [offsets, setOffsets] = useState([]);
  useEffect(() => {
    if (!enabled || !places?.length) { setOffsets([]); return undefined; }
    const update = () => {
      const z = map.getZoom();
      setOffsets(spreadPins(places.map((p) => map.project([p.lat, p.lng], z)), 30));
    };
    update();
    map.on('zoomend', update);
    return () => { map.off('zoomend', update); };
  }, [map, places, enabled]);
  return offsets;
}

function SpotMarkers({ places, isRoute, selectedKeys, poiKey, onSpotTap }) {
  const offsets = usePinSpread(places, isRoute);
  return places.map((place, index) => {
    const key = poiKey(place);
    const selected = isRoute || selectedKeys.has(key);
    const icon = spotIcon(place, {
      selected,
      number: isRoute ? index + 1 : null,
      offset: isRoute ? offsets[index] : null,
    });
    return (
      <Marker
        key={`spot-${key}`}
        position={[place.lat, place.lng]}
        icon={icon}
        // Where two pins still touch, the later stop draws on top, so the
        // stacking follows the walk's order instead of the stops' latitude.
        zIndexOffset={selected ? 300 + (isRoute ? index : 0) : 100}
        eventHandlers={{ click: () => onSpotTap?.(place) }}
      />
    );
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
      {/* zoomSnap 0.25: with whole zoom levels only, fitBounds had to choose
          between a route that doesn't fit and one that fills half the visible
          map (Toledo's walk used a third of it). Tiles come from the nearest
          whole level, drawn at between ~0.7x and ~1.2x their size. */}
      <MapContainer
        center={[origin.lat, origin.lng]}
        zoom={15}
        zoomSnap={0.25}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Single hostname is OSM's preferred scheme: the {s} subdomain aliases
            (a/b/c) are deprecated — the modern server does HTTP/2 multiplexing, and
            one host caches better. See operations.osmfoundation.org/policies/tiles.
            maxZoom 19 is the highest zoom OSM renders; asking for more 404s. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitController origin={origin} places={places} stage={stage} />

        <Marker position={[origin.lat, origin.lng]} icon={USER_ICON} zIndexOffset={500}>
          <Popup><b>Estás aquí</b></Popup>
        </Marker>

        <SpotMarkers
          places={places}
          isRoute={isRoute}
          selectedKeys={selectedKeys}
          poiKey={poiKey}
          onSpotTap={onSpotTap}
        />

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
