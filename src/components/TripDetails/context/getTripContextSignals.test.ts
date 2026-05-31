import { describe, expect, it } from 'vitest';
import { Trip } from '@/types/eventTypes';
import { getTripContextSignals } from '@/components/TripDetails/context/getTripContextSignals';

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  _id: 'trip-1',
  name: 'Test trip',
  startDate: '2026-05-01',
  endDate: '2026-06-01',
  events: [],
  owner: 'user-1',
  collaborators: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
} as Trip);

describe('getTripContextSignals', () => {
  it('merges live travel updates into a single Today card', () => {
    const now = new Date('2026-05-15T12:00:00.000Z');
    const signals = getTripContextSignals({
      trip: makeTrip({
        startDate: '2026-05-10',
        endDate: '2026-05-20',
        events: [{
          id: 'evt-1',
          type: 'activity',
          status: 'confirmed',
          startDate: '2026-05-15T14:00:00.000Z',
          title: 'Museum visit',
        } as unknown as Trip['events'][number]],
      }),
      notifications: [],
      travelImports: [],
      insights: [],
      weatherSnapshots: [{
        _id: 'weather-1',
        eventId: 'evt-1',
        date: '2026-05-15',
        daily: [{ condition: 'Clear', temperatureMax: 70, temperatureMin: 55 }],
      } as never],
      flightStatusSnapshots: [{
        _id: 'flight-1',
        provider: 'test',
        eventId: 'evt-1',
        tripId: 'trip-1',
        flightNumber: 'AA100',
        dateLocal: '2026-05-15',
        fetchedAt: now.toISOString(),
        expiresAt: now.toISOString(),
      }],
      now,
    });

    const todayCards = signals.cards.filter((card) => card.type === 'travel_day');
    expect(todayCards).toHaveLength(1);
    expect(todayCards[0].title).toBe('Today');
    expect(todayCards[0].description).toContain('1 event today');
    expect(todayCards[0].description).toContain('live flight & weather updates');
    expect(todayCards[0].hasLiveUpdates).toBe(true);
    expect(signals.showEmbeddedToday).toBe(true);
    expect(signals.cards.filter((card) => card.title === 'Live travel context')).toHaveLength(0);
  });
});
