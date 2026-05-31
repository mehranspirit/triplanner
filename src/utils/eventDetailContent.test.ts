import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import {
  getEventDetailNotes,
  getEventDetailSections,
  resolveOutboundTransferForEvent,
} from '@/utils/eventDetailContent';

describe('getEventDetailNotes', () => {
  it('keeps description and notes separate', () => {
    const event = {
      id: '1',
      type: 'activity',
      title: 'Hike',
      activityType: 'Outdoor',
      startDate: '2026-06-01',
      startTime: '09:00',
      endDate: '2026-06-01',
      endTime: '11:00',
      description: 'Bring water',
      notes: 'Meet at trailhead',
    } as unknown as Event;

    expect(getEventDetailNotes(event)).toEqual({
      description: 'Bring water',
      notes: 'Meet at trailhead',
    });
  });
});

describe('getEventDetailSections', () => {
  it('builds stay check-in/out and nights', () => {
    const event = {
      id: 'stay-1',
      type: 'stay',
      accommodationName: 'Hotel Luna',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-04',
      checkOutTime: '11:00',
      reservationNumber: 'ABC123',
    } as unknown as Event;

    const sections = getEventDetailSections(event);
    const staySection = sections.find((section) => section.title === 'Stay details');
    expect(staySection?.rows.some((row) => row.label === 'Nights' && row.value === '3')).toBe(true);
    expect(staySection?.rows.some((row) => row.label === 'Reservation' && row.value === 'ABC123')).toBe(true);
  });

  it('builds flight route fields', () => {
    const event = {
      id: 'flight-1',
      type: 'flight',
      airline: 'UA',
      flightNumber: '123',
      departureAirport: 'SFO',
      arrivalAirport: 'LAX',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      departureTime: '08:00',
      arrivalTime: '09:30',
      terminal: '2',
      gate: 'B12',
    } as unknown as Event;

    const sections = getEventDetailSections(event);
    const flightSection = sections.find((section) => section.title === 'Flight details');
    expect(flightSection?.rows.some((row) => row.label === 'Terminal' && row.value === '2')).toBe(true);
    expect(flightSection?.rows.some((row) => row.label === 'Gate' && row.value === 'B12')).toBe(true);
  });
});

describe('resolveOutboundTransferForEvent', () => {
  it('returns null when event is last in itinerary', () => {
    const events = [
      {
        id: 'a',
        type: 'activity',
        title: 'Breakfast',
        startDate: '2026-06-01',
        startTime: '08:00',
        endDate: '2026-06-01',
        endTime: '09:00',
        location: { lat: 37.77, lng: -122.42, name: 'Cafe' },
      },
    ] as unknown as Event[];

    expect(resolveOutboundTransferForEvent(events[0], events)).toBeNull();
  });
});
