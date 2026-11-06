import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getRoute } from '../../services/api';
import { spotIcon, usePinSpread, ROUTE_LINE } from '../explore/routePins';
import { OSM_TILE_PROPS } from '../explore/osmTiles';

// The 2-hour page's route at a glance: its numbered stops and the streets
// between them, above the list that describes them. A preview, not a map to
// use: it doesn't pan or zoom, because a map inside a scrolling page that
// grabs one-finger drags traps the reader halfway down the page. Tapping it
// opens the real route view, the same as "Hacer esta ruta ahora".
//
// Mounted only when it comes near the viewport: most visitors read the top of
// the page and leave, and they shouldn't cost a route or a screenful of tiles.

function Fit({ stops }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, stops]);
  return null;
}

function Pins({ stops }) {
  const offsets = usePinSpread(stops);
  return stops.map((s, i) => (
    <Marker
      key={`${s.name}-${i}`}
      position={[s.lat, s.lng]}
      icon={spotIcon(s, { selected: true, number: i + 1, offset: offsets[i] })}
      keyboard={false}
      interactive={false}
      zIndexOffset={300 + i}
    />
  ));
}

export default function WalkPreviewMap({ stops, cityName, onOpen }) {
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const [routeFailed, setRouteFailed] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || near) return undefined;
    if (!('IntersectionObserver' in window)) { setNear(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // The walk itself, first stop to last. Not from the city centre the route
  // view starts at: this map shows the walk the page lists.
  useEffect(() => {
    if (!near || stops.length < 2) return undefined;
    let cancelled = false;
    const [first, ...rest] = stops;
    getRoute(`${first.lat},${first.lng}`, rest.map((s) => `${s.lat},${s.lng}`).join(';'), 'walking')
      .then((data) => { if (!cancelled && data?.geometry) setGeometry(data.geometry); })
      .catch(() => { if (!cancelled) setRouteFailed(true); });
    return () => { cancelled = true; };
  }, [near, stops]);

  const feature = useMemo(
    () => (geometry ? { type: 'Feature', geometry } : null),
    [geometry]
  );
  // Without the router, the order of the stops is still worth showing, drawn
  // as what it is: a dashed line, not a path through the streets.
  const straight = useMemo(() => stops.map((s) => [s.lat, s.lng]), [stops]);

  return (
    <figure className="city-walk-map" ref={boxRef}>
      {/* Mouse/touch shortcut only; the button below is the accessible way in.
          A tap on the OpenStreetMap credit follows the credit instead. */}
      <div
        className="city-walk-map-frame"
        onClick={(e) => { if (!e.target.closest('a')) onOpen(); }}
      >
        {near && (
          <MapContainer
            center={[stops[0].lat, stops[0].lng]}
            zoom={15}
            zoomSnap={0.25}
            zoomControl={false}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            scrollWheelZoom={false}
            boxZoom={false}
            keyboard={false}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer {...OSM_TILE_PROPS} />
            <Fit stops={stops} />
            {feature && <GeoJSON key={geometry.coordinates?.length || 0} data={feature} style={ROUTE_LINE} interactive={false} />}
            {!feature && routeFailed && (
              <Polyline positions={straight} pathOptions={{ ...ROUTE_LINE, weight: 3, dashArray: '6 8' }} interactive={false} />
            )}
            <Pins stops={stops} />
          </MapContainer>
        )}
      </div>
      {/* Under the map, not floating on it: in a corner it covered whichever
          stop happened to fall there (Palma's 7, San Sebastián's on a phone). */}
      <button type="button" className="city-walk-map-open" onClick={onOpen}>
        Abrir la ruta en el mapa
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      <figcaption className="sr-only">
        Mapa del recorrido por {cityName}: {stops.map((s, i) => `${i + 1}. ${s.name}`).join(', ')}.
      </figcaption>
    </figure>
  );
}
