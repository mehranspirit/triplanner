import { eachDayOfInterval, format, isValid, parseISO, startOfDay } from 'date-fns';
import { Event } from '@/types/eventTypes';
import { getEventEnd, getEventStart } from '@/utils/eventTime';

const MULTIDAY_EVENT_TYPES = new Set<Event['type']>(['stay', 'rental_car']);

export const eventSpansMultipleDays = (event: Event): boolean => (
  MULTIDAY_EVENT_TYPES.has(event.type)
);

/** Primary timeline anchor — event start day. */
export const getTimelineDateKey = (event: Event) => {
  const start = getEventStart(event);
  if (!start) return '';
  return format(start, 'yyyy-MM-dd');
};

/** All calendar days an event should appear on (inclusive range for stays and rental cars). */
export const getEventTimelineDateKeys = (event: Event): string[] => {
  const start = getEventStart(event);
  if (!start) return [];

  if (!eventSpansMultipleDays(event)) {
    return [format(startOfDay(start), 'yyyy-MM-dd')];
  }

  const end = getEventEnd(event);
  if (!end) {
    return [format(startOfDay(start), 'yyyy-MM-dd')];
  }

  const rangeStart = startOfDay(start <= end ? start : end);
  const rangeEnd = startOfDay(start <= end ? end : start);

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(
    (date) => format(date, 'yyyy-MM-dd'),
  );
};

export const eventOccursOnDayKey = (event: Event, dayKey: string): boolean => {
  if (dayKey === UNSCHEDULED_FILTER_KEY) {
    return getEventTimelineDateKeys(event).length === 0;
  }

  return getEventTimelineDateKeys(event).includes(dayKey);
};

export const groupEventsByTimelineDateKeys = (events: Event[]): Record<string, Event[]> => (
  events.reduce((groups, event) => {
    getEventTimelineDateKeys(event).forEach((dateKey) => {
      if (!groups[dateKey]) groups[dateKey] = [];
      if (!groups[dateKey].some((existing) => existing.id === event.id)) {
        groups[dateKey].push(event);
      }
    });
    return groups;
  }, {} as Record<string, Event[]>)
);

export const getTodayTimelineDateKey = () => format(new Date(), 'yyyy-MM-dd');

export const isTimelineDateToday = (dateKey: string) => dateKey === getTodayTimelineDateKey();

export const formatTimelineDate = (dateKey: string) => {
  try {
    const date = parseTimelineDateKey(dateKey);
    if (!date) return { weekday: dateKey, date: '' };
    return {
      weekday: format(date, 'EEEE'),
      date: format(date, 'MMMM d, yyyy'),
    };
  } catch {
    return { weekday: dateKey, date: '' };
  }
};

export const parseTimelineDateKey = (dateKey: string): Date | null => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseTripBoundaryDate = (value?: string): Date | null => {
  if (!value?.trim()) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return startOfDay(parsed);
};

export interface TripDayStripItem {
  dateKey: string;
  shortLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  hasEvents: boolean;
  isUnscheduled?: boolean;
  isAllDays?: boolean;
}

export const ALL_DAYS_FILTER_KEY = 'all';
export const UNSCHEDULED_FILTER_KEY = 'unscheduled';

export const ALL_DAYS_STRIP_ITEM: TripDayStripItem = {
  dateKey: ALL_DAYS_FILTER_KEY,
  shortLabel: 'All days',
  weekdayLabel: 'Full trip',
  isToday: false,
  hasEvents: true,
  isAllDays: true,
};

export const filterEventsByDayKey = (events: Event[], dayKey: string): Event[] => {
  const itineraryEvents = events.filter((event) => event.status !== 'alternative');

  if (!dayKey || dayKey === ALL_DAYS_FILTER_KEY) {
    return itineraryEvents;
  }

  return itineraryEvents.filter((event) => eventOccursOnDayKey(event, dayKey));
};

/** Build day pills for the strip — full trip range, or event span when dates are missing. */
export const buildTripDayStripItems = (
  events: Event[],
  tripStartDate?: string,
  tripEndDate?: string,
): TripDayStripItem[] => {
  const itineraryEvents = events.filter((event) => event.status !== 'alternative');
  const eventDateKeys = new Set(
    itineraryEvents.flatMap(getEventTimelineDateKeys),
  );

  if (eventDateKeys.size === 0) {
    return [{
      dateKey: UNSCHEDULED_FILTER_KEY,
      shortLabel: 'Unscheduled',
      weekdayLabel: 'Unscheduled',
      isToday: false,
      hasEvents: itineraryEvents.length > 0,
      isUnscheduled: true,
    }];
  }

  const unscheduledCount = itineraryEvents.filter(
    (event) => getEventTimelineDateKeys(event).length === 0,
  ).length;
  const appendUnscheduled = unscheduledCount > 0
    ? [{
        dateKey: UNSCHEDULED_FILTER_KEY,
        shortLabel: 'Unscheduled',
        weekdayLabel: 'No date',
        isToday: false,
        hasEvents: true,
        isUnscheduled: true,
      }]
    : [];

  const eventDates = [...eventDateKeys]
    .map(parseTimelineDateKey)
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime());

  const tripStart = parseTripBoundaryDate(tripStartDate);
  const tripEnd = parseTripBoundaryDate(tripEndDate);

  const rangeStart = tripStart && tripEnd && tripStart <= tripEnd
    ? tripStart
    : eventDates[0];
  const rangeEnd = tripStart && tripEnd && tripStart <= tripEnd
    ? tripEnd
    : eventDates[eventDates.length - 1];

  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    return [
      ...eventDates.map((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return {
          dateKey,
          shortLabel: format(date, 'MMM d'),
          weekdayLabel: format(date, 'EEE'),
          isToday: isTimelineDateToday(dateKey),
          hasEvents: itineraryEvents.some((event) => eventOccursOnDayKey(event, dateKey)),
        };
      }),
      ...appendUnscheduled,
    ];
  }

  return [
    ...eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        dateKey,
        shortLabel: format(date, 'MMM d'),
        weekdayLabel: format(date, 'EEE'),
        isToday: isTimelineDateToday(dateKey),
        hasEvents: itineraryEvents.some((event) => eventOccursOnDayKey(event, dateKey)),
      };
    }),
    ...appendUnscheduled,
  ];
};
