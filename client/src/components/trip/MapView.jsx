import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTrip } from '../../context/TripContext';
import { typeLabels } from '../../constants/poi';
import RouteOverlay from './RouteOverlay';

const ROUTE_COLORS = {
  driving: '#6366f1',
  walking: '#10b981',
  cycling: '#f59e0b',
};

const USER_ICON = L.divIcon({
  className: 'user-marker',
  html: '<div style="background: #6366f1; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function createPOIIcon(index) {
  return L.divIcon({
    className: 'poi-marker',
    html: `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Pre-create icons for up to 10 POIs to avoid recreating on every render
const POI_ICONS = Array.from({ length: 10 }, (_, i) => createPOIIcon(i));

function MapController() {
  const map = useMap();
  const { currentTrip } = useTrip();

  useEffect(() => {
    if (!currentTrip) return;
    map.setView([currentTrip.origin_lat, currentTrip.origin_lng], 14);
  }, [currentTrip, map]);

  useEffect(() => {
    if (!currentTrip?.places || currentTrip.places.length === 0) return;

    const bounds = L.latLngBounds([
      [currentTrip.origin_lat, currentTrip.origin_lng],
    ]);
    currentTrip.places.forEach((place) => {
      bounds.extend([place.lat, place.lng]);
    });
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [currentTrip?.places, currentTrip?.origin_lat, currentTrip?.origin_lng, map]);

  return null;
}

export default function MapView() {
  const { currentTrip, routeGeometry, selectedTransport } = useTrip();

  const places = currentTrip?.places || [];
  const originLat = currentTrip?.origin_lat ?? 40;
  const originLng = currentTrip?.origin_lng ?? -3;

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
        style={{ width: '100%', height: '520px' }}
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

        {/* POI markers */}
        {places.map((place, index) => (
          <Marker
            key={`poi-${index}-${place.lat}-${place.lng}`}
            position={[place.lat, place.lng]}
            icon={POI_ICONS[index] || createPOIIcon(index)}
          >
            <Popup>
              <div className="popup-title"><b>{place.name}</b></div>
              <div className="popup-type">{typeLabels[place.type] || typeLabels.default}</div>
            </Popup>
          </Marker>
        ))}

        {/* Route line */}
        {routeGeoJSON && (
          <GeoJSON
            key={routeGeometry ? JSON.stringify(routeGeometry).length : 0}
            data={routeGeoJSON}
            style={routeStyle}
          />
        )}
      </MapContainer>
      <RouteOverlay />
    </div>
  );
}
