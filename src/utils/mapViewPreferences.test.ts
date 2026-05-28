import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasTripMapViewPreference,
  loadGlobalMapViewDefault,
  loadMapViewPreference,
  loadMapViewSuggestDismissed,
  saveGlobalMapViewDefault,
  saveMapViewPreference,
  saveMapViewSuggestDismissed,
} from '@/utils/mapViewPreferences';
import { MAP_VIEW_GLOBAL_KEY, mapViewTripKey } from '@/types/mapViewTypes';

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  };
};

describe('mapViewPreferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads and saves per-trip map view preference', () => {
    expect(loadMapViewPreference('trip-1')).toBeNull();
    saveMapViewPreference('trip-1', true);
    expect(localStorage.getItem(mapViewTripKey('trip-1'))).toBe('1');
    expect(loadMapViewPreference('trip-1')).toBe(true);
  });

  it('falls back to global default when trip preference is unset', () => {
    saveGlobalMapViewDefault(true);
    expect(localStorage.getItem(MAP_VIEW_GLOBAL_KEY)).toBe('1');
    expect(loadMapViewPreference('trip-2')).toBe(true);
    expect(loadGlobalMapViewDefault()).toBe(true);
  });

  it('tracks per-trip suggest dismissal', () => {
    expect(hasTripMapViewPreference('trip-3')).toBe(false);
    expect(loadMapViewSuggestDismissed('trip-3')).toBe(false);
    saveMapViewSuggestDismissed('trip-3');
    expect(loadMapViewSuggestDismissed('trip-3')).toBe(true);
  });
});
