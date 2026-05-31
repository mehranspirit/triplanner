import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import {
  findClosestPriorItineraryEvent,
  findPreviousItineraryEventForDay,
  formatTransferLegLabel,
  getTimelineDayTransferLeg,
  getTransferSummary,
  resolveTimelineTransferLeg,
} from '@/utils/transferAnalysis';
import { groupEventsByTimelineDateKeys } from '@/utils/timelineDates';
import { sortEventsByStart } from '@/utils/eventTime';

const makeActivity = (
  id: string,
  startDate: string,
  endDate: string,
  lat: number,
  lng: number,
): Event => ({
  id,
  type: 'activity',
  status: 'confirmed',
  title: id,
  startDate,
  endDate,
  location: { lat, lng, address: `${id} address` },
} as unknown as Event);

const makeStay = (
  id: string,
  checkIn: string,
  checkOut: string,
  lat: number,
  lng: number,
): Event => ({
  id,
  type: 'stay',
  status: 'confirmed',
  accommodationName: 'Hotel Example',
  checkIn,
  checkInTime: '15:00',
  checkOut,
  checkOutTime: '11:00',
  location: { lat, lng, address: 'Hotel address' },
} as unknown as Event);

const makeFlight = (
  id: string,
  startDate: string,
  endDate: string,
  arrivalLat: number,
  arrivalLng: number,
): Event => ({
  id,
  type: 'flight',
  status: 'confirmed',
  airline: 'Example Air',
  flightNumber: 'EX123',
  departureAirport: 'JFK',
  arrivalAirport: 'LAX',
  startDate,
  endDate,
  departureTime: '08:00',
  arrivalTime: '11:00',
  arrivalLocation: {
    lat: arrivalLat,
    lng: arrivalLng,
    address: 'LAX',
    quality: 'exact',
    source: 'google_places',
  },
  departureLocation: {
    lat: 40.6413,
    lng: -73.7781,
    address: 'JFK',
    quality: 'exact',
    source: 'google_places',
  },
} as unknown as Event);

const resolveFirstLegOnDay = (events: Event[], dayKey: string) => {
  const itineraryEvents = events.filter((event) => event.status !== 'alternative');
  const sortedEvents = sortEventsByStart(itineraryEvents);
  const grouped = groupEventsByTimelineDateKeys(itineraryEvents);
  const dayEvents = grouped[dayKey] || [];

  return resolveTimelineTransferLeg(sortedEvents, dayEvents, 0, dayEvents[0], dayKey);
};

describe('transferAnalysis timeline legs', () => {
  it('returns a same-day leg when stops are far enough apart', () => {
    const from = makeActivity(
      'a',
      '2026-06-01T10:00:00',
      '2026-06-01T11:00:00',
      40.7128,
      -74.006,
    );
    const to = makeActivity(
      'b',
      '2026-06-01T14:00:00',
      '2026-06-01T15:00:00',
      40.758,
      -73.9855,
    );

    const leg = getTimelineDayTransferLeg(from, to, '2026-06-01');

    expect(leg).not.toBeNull();
    expect(leg?.distanceMiles).toBeGreaterThan(0);
    expect(leg?.estimatedTravelMinutes).toBeGreaterThan(0);
  });

  it('shows a leg from an ongoing stay to a same-day activity', () => {
    const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.7128, -74.006);
    const activity = makeActivity(
      'museum',
      '2026-06-02T11:00:00',
      '2026-06-02T13:00:00',
      40.758,
      -73.9855,
    );

    expect(getTransferSummary(stay, activity)).toBeNull();
    expect(getTimelineDayTransferLeg(stay, activity, '2026-06-02')).not.toBeNull();
  });

  it('shows a leg from a same-day activity to a check-in stay', () => {
    const activity = makeActivity(
      'lunch',
      '2026-06-01T12:00:00',
      '2026-06-01T13:30:00',
      40.758,
      -73.9855,
    );
    const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.7128, -74.006);

    expect(getTimelineDayTransferLeg(activity, stay, '2026-06-01')).not.toBeNull();
  });

  it('shows a leg from a flight arrival to the next same-day event', () => {
    const flight = makeFlight(
      'flight-1',
      '2026-06-01T08:00:00',
      '2026-06-01T11:00:00',
      33.9416,
      -118.4085,
    );
    const activity = makeActivity(
      'beach',
      '2026-06-01T14:00:00',
      '2026-06-01T16:00:00',
      34.0195,
      -118.4912,
    );

    expect(getTimelineDayTransferLeg(flight, activity, '2026-06-01')).not.toBeNull();
  });

  it('bridges an overnight flight to the first event on the arrival day', () => {
    const flight = makeFlight(
      'red-eye',
      '2026-06-01T22:00:00',
      '2026-06-02T06:30:00',
      40.7128,
      -74.006,
    );
    const checkIn = makeStay('stay-1', '2026-06-02', '2026-06-05', 40.758, -73.9855);
    const events = [flight, checkIn];

    expect(findPreviousItineraryEventForDay(events, checkIn, '2026-06-02')).toEqual(flight);
    expect(getTimelineDayTransferLeg(flight, checkIn, '2026-06-02')).not.toBeNull();
  });

  it('skips inbound legs to a middle stay day', () => {
    const priorActivity = makeActivity(
      'dinner',
      '2026-06-01T19:00:00',
      '2026-06-01T21:00:00',
      40.7128,
      -74.006,
    );
    const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.758, -73.9855);
    const events = [priorActivity, stay];

    expect(resolveFirstLegOnDay(events, '2026-06-02')).toBeNull();
  });

  it('shows a cross-day leg to a sparse check-in day', () => {
    const priorStay = makeStay('stay-old', '2026-05-30', '2026-06-01', 40.7128, -74.006);
    const checkIn = makeStay('stay-new', '2026-06-03', '2026-06-06', 40.758, -73.9855);
    const events = [priorStay, checkIn];

    expect(findClosestPriorItineraryEvent(events, checkIn)).toEqual(priorStay);
    expect(resolveFirstLegOnDay(events, '2026-06-03')).not.toBeNull();
  });

  it('shows a cross-day leg to a sparse flight day', () => {
    const priorActivity = makeActivity(
      'dinner',
      '2026-06-01T19:00:00',
      '2026-06-01T21:00:00',
      40.7128,
      -74.006,
    );
    const flight = makeFlight(
      'outbound',
      '2026-06-03T09:00:00',
      '2026-06-03T12:00:00',
      33.9416,
      -118.4085,
    );
    const events = [priorActivity, flight];

    expect(resolveFirstLegOnDay(events, '2026-06-03')).not.toBeNull();
  });

  it('skips legs between events on different days when the day is not sparse', () => {
    const from = makeActivity(
      'a',
      '2026-06-01T22:00:00',
      '2026-06-01T23:00:00',
      40.7128,
      -74.006,
    );
    const to = makeActivity(
      'b',
      '2026-06-02T09:00:00',
      '2026-06-02T10:00:00',
      40.758,
      -73.9855,
    );

    expect(getTimelineDayTransferLeg(from, to, '2026-06-02')).toBeNull();
    expect(getTransferSummary(from, to)).not.toBeNull();
  });

  it('formats distance and travel time for timeline chips', () => {
    const leg = getTimelineDayTransferLeg(
      makeActivity('a', '2026-06-01T10:00:00', '2026-06-01T11:00:00', 40.7128, -74.006),
      makeActivity('b', '2026-06-01T14:00:00', '2026-06-01T15:00:00', 40.758, -73.9855),
      '2026-06-01',
    );

    expect(leg).not.toBeNull();
    expect(formatTransferLegLabel(leg!)).toMatch(/mi · ~\d+ min/);
  });
});
