import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { spotIcon, usePinSpread, ROUTE_LINE } from './routePins';
import { OSM_TILE_PROPS } from './osmTiles';
import { SHEET_HALF_OFFSET } from './ExploreSheet';

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

// How much of the screen the route sheet covers when it opens at 'half', read
// from the sheet itself. It used to be a guess (42% of the window) while the
// sheet actually covers ~45%, so on a 390x844 phone stops 1 and 2 opened
// hidden under it. offsetTop/offsetHeight ignore the sheet's transform, so this
// is right even while it's still sliding into place.
function sheetCoverPx() {
  const sheet = document.querySelector('.xp-sheet');
  if (!sheet) return Math.round(window.innerHeight * 0.5);
  const parentTop = sheet.offsetParent?.getBoundingClientRect().top || 0;
  const halfTop = parentTop + sheet.offsetTop + sheet.offsetHeight * SHEET_HALF_OFFSET;
  return Math.max(0, Math.round(window.innerHeight - halfTop));
}

// Half a numbered pin (34px, anchored at its centre) plus a little air, so a
// stop at the edge of the bounds shows whole instead of cut by the sheet.
const PIN_CLEARANCE = 26;

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
      paddingBottomRight: docked ? [36, 36] : [36, sheetCoverPx() + PIN_CLEARANCE],
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
        <TileLayer {...OSM_TILE_PROPS} />
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
            style={ROUTE_LINE}
          />
        )}
      </MapContainer>
    </div>
  );
}
