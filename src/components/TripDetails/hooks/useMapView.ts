import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  loadMapViewPreference,
  saveMapViewPreference,
} from '@/utils/mapViewPreferences';

export const useMapView = (tripId: string | undefined) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMapView, setIsMapViewState] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!tripId) return;

    const urlPref = searchParams.get('view') === 'map';
    const storedPref = loadMapViewPreference(tripId);
    setIsMapViewState(urlPref || storedPref === true);
    setIsHydrated(true);
  }, [tripId, searchParams]);

  const setMapView = useCallback((next: boolean) => {
    if (!tripId) return;

    setIsMapViewState(next);
    saveMapViewPreference(tripId, next);

    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next) {
        params.set('view', 'map');
      } else {
        params.delete('view');
      }
      return params;
    }, { replace: true });
  }, [tripId, setSearchParams]);

  const toggleMapView = useCallback(() => {
    setMapView(!isMapView);
  }, [isMapView, setMapView]);

  return {
    isMapView,
    isHydrated,
    setMapView,
    toggleMapView,
  };
};
