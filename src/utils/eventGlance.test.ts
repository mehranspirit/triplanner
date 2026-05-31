import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import {
  formatEventDetailTimeRange,
  formatEventGlanceTimeRange,
  formatStayGlanceMeta,
  formatStayGlanceSchedule,
  formatTransportGlanceTime,
  getEventCostGlanceLabel,
  getEventGlanceRailTime,
  getEventVoteGlanceLabel,
  getStayNightCount,
  getTransportGlanceTitle,
  getTransportRouteEndpoints,
} from '@/utils/eventGlance';

describe('eventGlance', () => {
  it('formats same-day glance time as a compact range', () => {
    const event = {
      id: 'a1',
      type: 'activity',
      status: 'confirmed',
      startDate: '2026-06-27',
      endDate: '2026-06-27',
      startTime: '09:00',
      endTime: '11:00',
    } as unknown as Event;

    expect(formatEventGlanceTimeRange(event)).toBe('9:00 AM – 11:00 AM');
  });

  it('formats detail time with weekday', () => {
    const event = {
      id: 'a1',
      type: 'activity',
      status: 'confirmed',
      startDate: '2026-06-27',
      endDate: '2026-06-27',
      startTime: '09:00',
      endTime: '11:00',
    } as unknown as Event;

    expect(formatEventDetailTimeRange(event)).toContain('Sat, Jun 27');
    expect(formatEventDetailTimeRange(event)).toContain('9:00 AM – 11:00 AM');
  });

  it('builds cost and vote glance labels', () => {
    const event = {
      id: 'a1',
      type: 'activity',
      status: 'exploring',
      startDate: '2026-06-27',
      endDate: '2026-06-27',
      cost: 85,
      likes: ['u1', 'u2'],
      dislikes: [],
    } as unknown as Event;

    expect(getEventCostGlanceLabel(event)).toBe('$85');
    expect(getEventVoteGlanceLabel(event)).toBe('2 likes');
  });

  it('formats transport route and time for flights', () => {
    const event = {
      id: 'f1',
      type: 'flight',
      status: 'confirmed',
      airline: 'UA',
      flightNumber: '123',
      departureAirport: 'SJO',
      arrivalAirport: 'LAX',
      startDate: '2026-06-27',
      endDate: '2026-06-27',
      departureTime: '08:45',
      arrivalTime: '14:30',
    } as unknown as Event;

    expect(getTransportGlanceTitle(event)).toBe('UA 123');
    expect(getTransportRouteEndpoints(event)).toEqual({ from: 'SJO', to: 'LAX' });
    expect(formatTransportGlanceTime(event)).toBe('8:45 AM – 2:30 PM');
  });

  it('formats stay night count and schedule', () => {
    const event = {
      id: 's1',
      type: 'stay',
      status: 'confirmed',
      accommodationName: 'Hotel Luna',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-04',
      checkOutTime: '11:00',
    } as unknown as Event;

    expect(getStayNightCount(event)).toBe(3);
    expect(formatStayGlanceMeta(event)).toBe('3 nights · Jun 1 – Jun 4');
    expect(formatStayGlanceSchedule(event)).toContain('Jun 1, 3:00 PM');
    expect(formatStayGlanceSchedule(event)).toContain('Jun 4, 11:00 AM');
  });

  it('formats time rail labels for multiday stays', () => {
    const event = {
      id: 's1',
      type: 'stay',
      status: 'confirmed',
      accommodationName: 'Hotel Luna',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-04',
      checkOutTime: '11:00',
    } as unknown as Event;

    expect(getEventGlanceRailTime(event, 'start')).toBe('3:00 PM');
    expect(getEventGlanceRailTime(event, 'end')).toBe('11:00 AM');
    expect(getEventGlanceRailTime(event, 'middle')).toBe('—');
  });
});
