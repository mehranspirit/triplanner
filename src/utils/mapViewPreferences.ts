import {
  MAP_VIEW_GLOBAL_KEY,
  mapViewTripKey,
} from '@/types/mapViewTypes';

export const loadMapViewPreference = (tripId: string): boolean | null => {
  if (typeof localStorage === 'undefined' || !tripId) return null;

  const tripStored = localStorage.getItem(mapViewTripKey(tripId));
  if (tripStored === '1') return true;
  if (tripStored === '0') return false;

  const globalStored = localStorage.getItem(MAP_VIEW_GLOBAL_KEY);
  if (globalStored === '1') return true;
  if (globalStored === '0') return false;

  return null;
};

export const saveMapViewPreference = (tripId: string, isMapView: boolean) => {
  if (typeof localStorage === 'undefined' || !tripId) return;
  localStorage.setItem(mapViewTripKey(tripId), isMapView ? '1' : '0');
};

export const loadGlobalMapViewDefault = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MAP_VIEW_GLOBAL_KEY) === '1';
};

export const saveGlobalMapViewDefault = (isMapView: boolean) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MAP_VIEW_GLOBAL_KEY, isMapView ? '1' : '0');
};
