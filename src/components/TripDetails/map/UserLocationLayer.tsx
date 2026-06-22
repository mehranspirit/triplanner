import { useEffect, useRef, useState } from 'react';
import { Circle, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

export type UserLocationStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable';

export interface UserLocationState {
  lat: number;
  lng: number;
  accuracy: number;
}

interface UserLocationLayerProps {
  enabled?: boolean;
  locateSignal?: number;
  onStatusChange?: (status: UserLocationStatus) => void;
}

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(37,99,235,0.25);
        animation:user-location-pulse 2s ease-out infinite;
      "></div>
      <div style="
        position:absolute;left:50%;top:50%;
        width:14px;height:14px;margin:-7px 0 0 -7px;
        border-radius:50%;background:#2563eb;
        border:2px solid #ffffff;
        box-shadow:0 1px 4px rgba(15,23,42,0.35);
      "></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const UserLocationLayer: React.FC<UserLocationLayerProps> = ({
  enabled = true,
  locateSignal = 0,
  onStatusChange,
}) => {
  const map = useMap();
  const [position, setPosition] = useState<UserLocationState | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const positionRef = useRef<UserLocationState | null>(null);
  const pendingFlyToRef = useRef(false);
  const lastLocateSignalRef = useRef(0);

  const flyToUser = (target: UserLocationState) => {
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  };

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!enabled) {
      onStatusChange?.('idle');
      setPosition(null);
      return undefined;
    }

    if (!navigator.geolocation) {
      onStatusChange?.('unavailable');
      return undefined;
    }

    onStatusChange?.('locating');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (coords) => {
        const nextPosition = {
          lat: coords.coords.latitude,
          lng: coords.coords.longitude,
          accuracy: coords.coords.accuracy,
        };
        setPosition(nextPosition);
        onStatusChange?.('active');
        if (pendingFlyToRef.current) {
          pendingFlyToRef.current = false;
          flyToUser(nextPosition);
        }
      },
      (error) => {
        setPosition(null);
        if (error.code === error.PERMISSION_DENIED) {
          onStatusChange?.('denied');
          return;
        }
        onStatusChange?.('unavailable');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, onStatusChange]);

  useEffect(() => {
    if (!enabled || locateSignal === 0 || locateSignal === lastLocateSignalRef.current) {
      return;
    }

    lastLocateSignalRef.current = locateSignal;

    if (positionRef.current) {
      flyToUser(positionRef.current);
      return;
    }

    pendingFlyToRef.current = true;
  }, [enabled, locateSignal, map]);

  if (!enabled || !position) {
    return null;
  }

  const accuracyRadius = Math.min(Math.max(position.accuracy, 25), 500);

  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={accuracyRadius}
        pathOptions={{
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          weight: 1,
          opacity: 0.35,
        }}
      />
      <Marker
        position={[position.lat, position.lng]}
        icon={userLocationIcon}
        zIndexOffset={1000}
      />
    </>
  );
};

export default UserLocationLayer;
