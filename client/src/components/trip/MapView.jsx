import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTrip } from '../../context/TripContext';
import { typeLabels } from '../../constants/poi';
import RouteOverlay from './RouteOverlay';

// Polyline colors by sac_scale difficulty rank — green (easy) → red (extreme).
// Matches the convention OSM rendering toolchains use.
const SAC_COLORS = {
  1: '#16a34a', // T1 easy
  2: '#65a30d', // T2 moderate
  3: '#ca8a04', // T3 demanding
  4: '#ea580c', // T4 alpine
  5: '#dc2626', // T5 demanding alpine
  6: '#7f1d1d', // T6 difficult alpine
};
const SAC_DEFAULT_COLOR = '#3f6a64';

const ROUTE_COLORS = {
  driving: '#6366f1',
  walking: '#3f6a64',
  cycling: '#f59e0b',
};

const USER_ICON = L.divIcon({
  className: 'user-marker',
  html: '<div style="background: #6366f1; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function createPOIIcon(index, { dim = false, numbered = true } = {}) {
  const background = dim
    ? 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const opacity = dim ? 0.55 : 1;
  const content = numbered ? String(index + 1) : '';
  return L.divIcon({
    className: 'poi-marker',
    html: `<div style="background: ${background}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); opacity: ${opacity};">${content}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Pre-create icons for up to 12 POIs to avoid recreating on every render
const POI_ICONS = Array.from({ length: 12 }, (_, i) => createPOIIcon(i));
const POI_ICONS_DIM = Array.from({ length: 12 }, (_, i) => createPOIIcon(i, { dim: true, numbered: false }));

function MapController() {
  const map = useMap();
  const { currentTrip, hikingTrails, selectedTrailId } = useTrip();
  const isHiking = currentTrip?.trip_type === 'hiking';

  useEffect(() => {
    if (!currentTrip) return;
    map.setView([currentTrip.origin_lat, currentTrip.origin_lng], 14);
  }, [currentTrip, map]);

  // Hiking: fit bounds to selected trail; otherwise fit to all trails.
  useEffect(() => {
    if (!isHiking || !hikingTrails?.length) return;

    const selected = hikingTrails.find(t => t.id === selectedTrailId);
    const target = selected ? [selected] : hikingTrails;
    const bounds = L.latLngBounds([[currentTrip.origin_lat, currentTrip.origin_lng]]);
    for (const trail of target) {
      for (const pt of trail.geometry) bounds.extend(pt);
    }
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [isHiking, hikingTrails, selectedTrailId, currentTrip?.origin_lat, currentTrip?.origin_lng, map]);

  // Tourism: fit bounds to POI list.
  useEffect(() => {
    if (isHiking) return;
    if (!currentTrip?.places || currentTrip.places.length === 0) return;

    const bounds = L.latLngBounds([
      [currentTrip.origin_lat, currentTrip.origin_lng],
    ]);
    currentTrip.places.forEach((place) => {
      bounds.extend([place.lat, place.lng]);
    });
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [isHiking, currentTrip?.places, currentTrip?.origin_lat, currentTrip?.origin_lng, map]);

  return null;
}

export default function MapView() {
  const { currentTrip, routeGeometry, selectedTransport, stage, selectedKeys, poiKey, hikingTrails, selectedTrailId, selectTrail } = useTrip();

  const places = currentTrip?.places || [];
  const originLat = currentTrip?.origin_lat ?? 40;
  const originLng = currentTrip?.origin_lng ?? -3;
  const isCandidatesStage = stage === 'candidates';
  const isHiking = currentTrip?.trip_type === 'hiking';
  const trails = isHiking ? (hikingTrails || []) : [];

  const routeGeoJSON = useMemo(
    () => routeGeometry ? { type: 'Feature', geometry: routeGeometry } : null,
    [routeGeometry]
  );

  const routeStyle = {
    color: ROUTE_COLORS[selectedTransport] || ROUTE_COLORS.driving,
    weight: 5,
    opacity: 0.8,
  };

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[40, -3]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController />

        {/* User location marker */}
        {currentTrip && (
          <Marker position={[originLat, originLng]} icon={USER_ICON}>
            <Popup><b>Inicio</b></Popup>
          </Marker>
        )}

        {/* Tourism POI markers — hidden in hiking mode */}
        {!isHiking && places.map((place, index) => {
          const isSelected = !isCandidatesStage || selectedKeys.has(poiKey(place));
          const icon = isSelected
            ? (POI_ICONS[index] || createPOIIcon(index))
            : (POI_ICONS_DIM[index] || createPOIIcon(index, { dim: true, numbered: false }));
          return (
            <Marker
              key={`poi-${index}-${place.lat}-${place.lng}`}
              position={[place.lat, place.lng]}
              icon={icon}
              opacity={isSelected ? 1 : 0.85}
            >
              <Popup>
                <div className="popup-title"><b>{place.name}</b></div>
                <div className="popup-type">{typeLabels[place.type] || typeLabels.default}</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Hiking polylines — render unselected first so the selected one
            paints on top with its bolder stroke. */}
        {isHiking && trails
          .slice()
          .sort((a, b) => (a.id === selectedTrailId ? 1 : 0) - (b.id === selectedTrailId ? 1 : 0))
          .map((trail) => {
            const isSelected = trail.id === selectedTrailId;
            const color = SAC_COLORS[trail.sacRank] || SAC_DEFAULT_COLOR;
            return (
              <Polyline
                key={`trail-${trail.id}`}
                positions={trail.geometry}
                pathOptions={{
                  color,
                  weight: isSelected ? 6 : 3,
                  opacity: isSelected ? 0.95 : 0.55,
                }}
                eventHandlers={{ click: () => selectTrail(trail.id) }}
              >
                <Popup>
                  <div className="popup-title"><b>{trail.name}</b></div>
                  {trail.sacScale && <div className="popup-type">{trail.sacScale}</div>}
                </Popup>
              </Polyline>
            );
          })}

        {/* Route line (tourism mode) */}
        {!isHiking && routeGeoJSON && (
          <GeoJSON
            key={routeGeometry ? JSON.stringify(routeGeometry).length : 0}
            data={routeGeoJSON}
            style={routeStyle}
          />
        )}
      </MapContainer>
      {!isHiking && <RouteOverlay />}
    </div>
  );
}
