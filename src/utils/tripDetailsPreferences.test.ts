import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadTripDetailsTab,
  saveTripDetailsTab,
} from '@/utils/tripDetailsPreferences';
import { tripDetailsTabKey } from '@/types/tripDetailsTabTypes';

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

describe('tripDetailsPreferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to itinerary and persists tab changes', () => {
    expect(loadTripDetailsTab('trip-1')).toBe('itinerary');
    saveTripDetailsTab('trip-1', 'calendar');
    expect(localStorage.getItem(tripDetailsTabKey('trip-1'))).toBe('calendar');
    expect(loadTripDetailsTab('trip-1')).toBe('calendar');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(tripDetailsTabKey('trip-2'), 'invalid');
    expect(loadTripDetailsTab('trip-2')).toBe('itinerary');
  });

  it('migrates removed bookings tab to itinerary', () => {
    localStorage.setItem(tripDetailsTabKey('trip-3'), 'bookings');
    expect(loadTripDetailsTab('trip-3')).toBe('itinerary');
  });
});
