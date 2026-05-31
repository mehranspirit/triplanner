import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import { getEventStatusChipInfo } from '@/components/TripDetails/EventCards/EventStatusChip';

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: '1',
  type: 'stay',
  status: 'confirmed',
  startDate: '2026-06-01T15:00:00.000Z',
  ...overrides,
} as Event);

describe('getEventStatusChipInfo', () => {
  it('prioritizes exploring over other statuses', () => {
    expect(getEventStatusChipInfo(makeEvent({
      status: 'exploring',
    } as Event & { bookingReference: string })).label).toBe('Draft');
  });

  it('shows booked when a reference exists', () => {
    expect(getEventStatusChipInfo({
      ...makeEvent(),
      bookingReference: 'ABC123',
      location: { lat: 1, lng: 2, quality: 'exact', source: 'geocoded' },
    } as Event).label).toBe('Booked');
  });

  it('falls back to confirmed', () => {
    expect(getEventStatusChipInfo(makeEvent({
      location: { lat: 1, lng: 2, quality: 'exact', source: 'geocoded' },
    })).label).toBe('Confirmed');
  });
});
