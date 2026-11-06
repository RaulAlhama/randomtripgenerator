// The map pins shared by the explore map and the 2-hour pages' preview map,
// so a stop looks the same on the page that promises the route and in the
// view that walks it.
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { typeIcons } from '../../constants/poi';
import { iconSvg } from '../../lib/icons';
import { spreadPins } from '../../lib/spreadPins';

// The colour the route line is drawn in, on both maps.
export const ROUTE_LINE = { color: '#3f6a64', weight: 5, opacity: 0.85 };

// `offset` moves the drawn pin, in pixels, without moving the marker: see
// spreadPins. Shifting the anchor the other way is how Leaflet draws an icon
// somewhere other than its point.
export function spotIcon(place, { selected, number, offset }) {
  const isNum = number != null;
  const inner = isNum ? String(number) : iconSvg(typeIcons[place.type] || typeIcons.default, { size: 16 });
  const dx = offset?.dx || 0;
  const dy = offset?.dy || 0;
  return L.divIcon({
    className: 'xp-spot-marker',
    html: `<div class="xp-pin${selected ? ' is-on' : ''}${isNum ? ' is-num' : ''}">${inner}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17 - dx, 17 - dy],
  });
}

// Pixel offsets that keep numbered pins from covering each other at the
// current zoom; recomputed whenever the zoom or the stops change. Empty when
// disabled (the explore deck's pins aren't numbered).
export function usePinSpread(places, enabled = true) {
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
