import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import {
  ALL_DAYS_FILTER_KEY,
  buildTripDayStripItems,
  eventOccursOnDayKey,
  filterEventsByDayKey,
  filterEventsForMapDayKey,
  getEventTimelineDateKeys,
  getMultidayEndpointDetails,
  getMultidayEventDayRole,
  getMultidaySpanLabel,
  getStayNightDateKeys,
  getTimelineAutoScrollDependencyKey,
  resolveActiveTimelineDayKey,
  getTimelineDateKey,
  isTimelineDateToday,
} from '@/utils/timelineDates';

const makeEvent = (id: string, startDate: string, type: Event['type'] = 'activity'): Event => ({
  id,
  type,
  status: 'confirmed',
  startDate,
} as Event);

describe('timelineDates', () => {
  it('builds an unscheduled pill when no dated events exist', () => {
    const items = buildTripDayStripItems([
      makeEvent('1', '', 'activity'),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].isUnscheduled).toBe(true);
    expect(items[0].dateKey).toBe('unscheduled');
  });

  it('filters events by day key', () => {
    const events = [
      makeEvent('1', '2026-06-01T10:00:00.000Z'),
      makeEvent('2', '2026-06-03T10:00:00.000Z'),
    ];

    expect(filterEventsByDayKey(events, ALL_DAYS_FILTER_KEY)).toHaveLength(2);
    expect(filterEventsByDayKey(events, '2026-06-01')).toHaveLength(1);
    expect(filterEventsByDayKey(events, '2026-06-02')).toHaveLength(0);
  });

  it('builds a day for each date in the trip range', () => {
    const items = buildTripDayStripItems(
      [
        makeEvent('1', '2026-06-01T10:00:00.000Z'),
        makeEvent('2', '2026-06-03T10:00:00.000Z'),
      ],
      '2026-06-01',
      '2026-06-03',
    );

    expect(items.map((item) => item.dateKey)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);
    expect(items[1].hasEvents).toBe(false);
    expect(items[2].hasEvents).toBe(true);
  });

  it('marks today using the local timeline date key', () => {
    const todayKey = getTimelineDateKey(makeEvent('today', new Date().toISOString()));
    expect(isTimelineDateToday(todayKey)).toBe(true);
  });

  it('ignores vote tallies in the timeline auto-scroll dependency key', () => {
    const base = makeEvent('1', '2026-06-01T10:00:00.000Z');
    const withVotes = {
      ...base,
      likes: ['user-a'],
      dislikes: ['user-b'],
    } as Event;

    expect(getTimelineAutoScrollDependencyKey([base])).toBe(
      getTimelineAutoScrollDependencyKey([withVotes]),
    );
  });

  it('resolves the active timeline day to today when today has events', () => {
    const todayKey = getTimelineDateKey(makeEvent('today', new Date().toISOString()));
    const activeDay = resolveActiveTimelineDayKey(
      [
        makeEvent('past', '2026-05-01T10:00:00.000Z'),
        makeEvent('today', `${todayKey}T10:00:00.000Z`),
        makeEvent('future', '2026-12-01T10:00:00.000Z'),
      ],
      '2026-05-01',
      '2026-12-01',
      new Date(`${todayKey}T12:00:00.000Z`),
    );

    expect(activeDay).toBe(todayKey);
  });

  it('resolves the active timeline day to the first trip day before the trip starts', () => {
    const activeDay = resolveActiveTimelineDayKey(
      [makeEvent('1', '2026-08-01T10:00:00.000Z')],
      '2026-08-01',
      '2026-08-05',
      new Date('2026-07-01T12:00:00.000Z'),
    );

    expect(activeDay).toBe('2026-08-01');
  });

  it('resolves the active timeline day to the last trip day after the trip ends', () => {
    const activeDay = resolveActiveTimelineDayKey(
      [makeEvent('1', '2026-08-01T10:00:00.000Z')],
      '2026-08-01',
      '2026-08-05',
      new Date('2026-09-01T12:00:00.000Z'),
    );

    expect(activeDay).toBe('2026-08-01');
  });

  it('includes multiday stays on every day in the range', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-03',
      checkOutTime: '11:00',
    } as unknown as Event;

    expect(getEventTimelineDateKeys(stay)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);
    expect(eventOccursOnDayKey(stay, '2026-06-02')).toBe(true);
    expect(filterEventsByDayKey([stay], '2026-06-02')).toHaveLength(1);
    expect(filterEventsByDayKey([stay], '2026-06-04')).toHaveLength(0);
  });

  it('omits middle multiday days from map day filtering', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-03',
      checkOutTime: '11:00',
    } as unknown as Event;
    const activity = makeEvent('activity-1', '2026-06-02', 'activity');

    expect(filterEventsForMapDayKey([stay, activity], '2026-06-01')).toHaveLength(1);
    expect(filterEventsForMapDayKey([stay, activity], '2026-06-02')).toEqual([activity]);
    expect(filterEventsForMapDayKey([stay, activity], '2026-06-03')).toHaveLength(1);
  });

  it('includes rental cars on every day from pickup through dropoff', () => {
    const rental = {
      id: 'car-1',
      type: 'rental_car',
      status: 'confirmed',
      date: '2026-06-05',
      pickupTime: '10:00',
      dropoffDate: '2026-06-07',
      dropoffTime: '10:00',
    } as unknown as Event;

    expect(getEventTimelineDateKeys(rental)).toEqual([
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
  });

  it('marks intermediate days as having events for multiday stays', () => {
    const items = buildTripDayStripItems(
      [{
        id: 'stay-1',
        type: 'stay',
        status: 'confirmed',
        checkIn: '2026-06-01',
        checkInTime: '15:00',
        checkOut: '2026-06-03',
        checkOutTime: '11:00',
      } as unknown as Event],
      '2026-06-01',
      '2026-06-03',
    );

    expect(items.find((item) => item.dateKey === '2026-06-02')?.hasEvents).toBe(true);
  });

  it('assigns start, middle, and end roles for multiday stays', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      accommodationName: 'Hotel Roma',
    } as unknown as Event;

    expect(getMultidayEventDayRole(stay, '2026-06-01')).toBe('start');
    expect(getMultidayEventDayRole(stay, '2026-06-02')).toBe('middle');
    expect(getMultidayEventDayRole(stay, '2026-06-03')).toBe('end');
    expect(getMultidayEventDayRole(stay, '2026-06-04')).toBeNull();
    expect(getMultidayEventDayRole(makeEvent('a', '2026-06-01'), '2026-06-01')).toBeNull();
  });

  it('returns endpoint copy for check-in and check-out days', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      address: 'Via Roma 1',
    } as unknown as Event;

    expect(getMultidayEndpointDetails(stay, 'start')).toMatchObject({
      heading: 'Check-in',
      time: '3:00 PM',
      location: 'Via Roma 1',
    });
    expect(getMultidayEndpointDetails(stay, 'end')).toMatchObject({
      heading: 'Check-out',
      time: '11:00 AM',
    });
  });

  it('returns span labels for middle days', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      accommodationName: 'Hotel Roma',
    } as unknown as Event;

    expect(getMultidaySpanLabel(stay, '2026-06-02')).toEqual({
      name: 'Hotel Roma',
      progress: 'Night 2 of 2',
      hint: 'Last night',
    });
  });

  it('excludes checkout day from stay night counts', () => {
    const stay = {
      id: 'stay-1',
      type: 'stay',
      status: 'confirmed',
      checkIn: '2026-06-01',
      checkOut: '2026-06-04',
      accommodationName: 'Hotel Roma',
    } as unknown as Event;

    expect(getStayNightDateKeys(stay)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);
    expect(getMultidaySpanLabel(stay, '2026-06-02')).toMatchObject({
      progress: 'Night 2 of 3',
      hint: 'Staying tonight',
    });
    expect(getMultidaySpanLabel(stay, '2026-06-03')).toMatchObject({
      progress: 'Night 3 of 3',
      hint: 'Last night',
    });
  });
});
