import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface MapPreviewMarker {
  lat: number;
  lng: number;
  label?: string;
  variant?: 'departure' | 'arrival' | 'single';
}

interface GeocodePreviewMapProps {
  lat?: number;
  lng?: number;
  markers?: MapPreviewMarker[];
  className?: string;
}

const createEndpointIcon = (label: string, color: string) => L.divIcon({
  className: 'geocode-preview-marker',
  html: `
    <div style="
      display:flex;
      flex-direction:column;
      align-items:center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        min-width: 22px;
        height: 22px;
        border-radius: 9999px;
        background: ${color};
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
      ">${label}</div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${color};
        margin-top: -1px;
      "></div>
    </div>
  `,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
});

const getMarkerIcon = (marker: MapPreviewMarker) => {
  if (marker.variant === 'departure') {
    return createEndpointIcon('A', '#2563eb');
  }
  if (marker.variant === 'arrival') {
    return createEndpointIcon('B', '#059669');
  }
  return createEndpointIcon(marker.label?.slice(0, 1).toUpperCase() || '•', '#0d9488');
};

const FitPreviewBounds: React.FC<{ markers: MapPreviewMarker[] }> = ({ markers }) => {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) {
      return;
    }

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }

    const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  }, [map, markers]);

  return null;
};

const GeocodePreviewMap: React.FC<GeocodePreviewMapProps> = ({
  lat,
  lng,
  markers,
  className,
}) => {
  const resolvedMarkers = markers ?? (
    lat !== undefined && lng !== undefined
      ? [{ lat, lng, variant: 'single' as const }]
      : []
  );

  const center = resolvedMarkers[0] ?? { lat: 0, lng: 0 };

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [resolvedMarkers.map((marker) => `${marker.lat},${marker.lng}`).join('|')]);

  if (resolvedMarkers.length === 0) {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
          Select a location to preview the map
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        className="h-full w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPreviewBounds markers={resolvedMarkers} />
        {resolvedMarkers.map((marker, index) => (
          <Marker
            key={`${marker.lat}-${marker.lng}-${index}`}
            position={[marker.lat, marker.lng]}
            icon={getMarkerIcon(marker)}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default GeocodePreviewMap;
