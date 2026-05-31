import { eachDayOfInterval, format, isValid, parseISO, startOfDay } from 'date-fns';
import { Event, RentalCarEvent, StayEvent } from '@/types/eventTypes';
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

export type MultidayEventDayRole = 'start' | 'end' | 'middle' | 'single';

/** How a multiday stay or rental appears on a specific calendar day. */
export const getMultidayEventDayRole = (
  event: Event,
  dayKey: string,
): MultidayEventDayRole | null => {
  if (!eventSpansMultipleDays(event)) return null;

  const keys = getEventTimelineDateKeys(event);
  if (!keys.includes(dayKey)) return null;
  if (keys.length === 1) return 'single';

  const startKey = keys[0];
  const endKey = keys[keys.length - 1];

  if (dayKey === startKey && dayKey === endKey) return 'single';
  if (dayKey === startKey) return 'start';
  if (dayKey === endKey) return 'end';
  return 'middle';
};

/** Overnight dates for a stay; checkout day is departure, not a counted night. */
export const getStayNightDateKeys = (event: Event): string[] => {
  const keys = getEventTimelineDateKeys(event);
  if (event.type !== 'stay' || keys.length <= 1) return keys;
  return keys.slice(0, -1);
};

export const getMultidayDayPosition = (event: Event, dayKey: string) => {
  const keys = event.type === 'stay'
    ? getStayNightDateKeys(event)
    : getEventTimelineDateKeys(event);
  const index = keys.indexOf(dayKey);

  return {
    index: index === -1 ? 1 : index + 1,
    total: keys.length,
  };
};

export interface MultidayEndpointDetails {
  heading: string;
  time?: string;
  location?: string;
  secondaryHeading?: string;
  secondaryTime?: string;
}

const formatTimeLabel = (time?: string) => {
  if (!time?.trim()) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const date = new Date(2000, 0, 1, hours, minutes);
  return format(date, 'h:mm a');
};

/** Role-specific check-in/out or pickup/dropoff copy for timeline cards. */
export const getMultidayEndpointDetails = (
  event: Event,
  role: MultidayEventDayRole,
): MultidayEndpointDetails | null => {
  if (!eventSpansMultipleDays(event)) return null;

  if (event.type === 'stay') {
    const stay = event as StayEvent;
    const checkInTime = formatTimeLabel(stay.checkInTime);
    const checkOutTime = formatTimeLabel(stay.checkOutTime);
    const location = stay.address?.trim() || event.location?.address?.trim();

    if (role === 'start') {
      return { heading: 'Check-in', time: checkInTime, location };
    }
    if (role === 'end') {
      return { heading: 'Check-out', time: checkOutTime, location };
    }
    return {
      heading: 'Check-in',
      time: checkInTime,
      secondaryHeading: 'Check-out',
      secondaryTime: checkOutTime,
      location,
    };
  }

  if (event.type === 'rental_car') {
    const rental = event as RentalCarEvent;
    const pickupTime = formatTimeLabel(rental.pickupTime);
    const dropoffTime = formatTimeLabel(rental.dropoffTime);
    const pickupLocation = rental.pickupLocation?.trim();
    const dropoffLocation = rental.dropoffLocation?.trim();

    if (role === 'start') {
      return { heading: 'Pick up', time: pickupTime, location: pickupLocation };
    }
    if (role === 'end') {
      return { heading: 'Drop off', time: dropoffTime, location: dropoffLocation };
    }
    return {
      heading: 'Pick up',
      time: pickupTime,
      location: pickupLocation,
      secondaryHeading: 'Drop off',
      secondaryTime: dropoffTime,
    };
  }

  return null;
};

export const getMultidaySpanLabel = (event: Event, dayKey: string) => {
  const { index, total } = getMultidayDayPosition(event, dayKey);
  const name = event.type === 'stay'
    ? (event as StayEvent).accommodationName || 'Stay'
    : event.type === 'rental_car'
      ? (event as RentalCarEvent).carCompany
        ? `${(event as RentalCarEvent).carCompany} rental`
        : 'Rental car'
      : 'Booking';

  if (event.type === 'stay') {
    return {
      name,
      progress: total > 1 ? `Night ${index} of ${total}` : 'Staying',
      hint: index === total ? 'Last night' : 'Staying tonight',
    };
  }

  return {
    name,
    progress: `Day ${index} of ${total}`,
    hint: 'Car reserved',
  };
};

export const getTodayTimelineDateKey = () => format(new Date(), 'yyyy-MM-dd');

export const isTimelineDateToday = (dateKey: string) => dateKey === getTodayTimelineDateKey();

/** Best day to focus in the timeline: today when relevant, otherwise trip-relative anchor. */
export const resolveActiveTimelineDayKey = (
  events: Event[],
  tripStartDate?: string,
  tripEndDate?: string,
  now = new Date(),
): string | null => {
  const stripDays = buildTripDayStripItems(events, tripStartDate, tripEndDate).filter(
    (day) => !day.isAllDays,
  );

  if (stripDays.length === 0) return null;

  const unscheduledDay = stripDays.find((day) => day.isUnscheduled);
  const datedDays = stripDays.filter((day) => !day.isUnscheduled);

  if (datedDays.length === 0) {
    return unscheduledDay?.dateKey ?? null;
  }

  const today = startOfDay(now);
  const todayKey = format(today, 'yyyy-MM-dd');
  const todayDay = datedDays.find((day) => day.dateKey === todayKey);
  if (todayDay?.hasEvents) {
    return todayKey;
  }

  const firstDated = datedDays[0];
  const lastDated = datedDays[datedDays.length - 1];
  const firstDate = parseTimelineDateKey(firstDated.dateKey);
  const lastDate = parseTimelineDateKey(lastDated.dateKey);

  if (firstDate && today < startOfDay(firstDate)) {
    return firstDated.dateKey;
  }

  if (lastDate && today > startOfDay(lastDate)) {
    const lastWithEvents = [...datedDays].reverse().find((day) => day.hasEvents);
    return lastWithEvents?.dateKey ?? lastDated.dateKey;
  }

  const upcoming = datedDays.find((day) => {
    const date = parseTimelineDateKey(day.dateKey);
    return date && startOfDay(date) >= today && day.hasEvents;
  });
  if (upcoming) return upcoming.dateKey;

  const previous = [...datedDays].reverse().find((day) => {
    const date = parseTimelineDateKey(day.dateKey);
    return date && startOfDay(date) <= today && day.hasEvents;
  });

  return previous?.dateKey ?? firstDated.dateKey;
};

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
