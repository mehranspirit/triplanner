import { Event, Trip } from '@/types/eventTypes';
import { extractDatePart, getEventEnd, getEventStart } from '@/utils/eventTime';

export interface TripDateRange {
  start: Date;
  end: Date;
}

export const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date | null => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addDaysToDateKey = (dateKey: string, days: number): string | null => {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return getDateKey(date);
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

/** Trip bounds from explicit dates, falling back to event span when needed. */
export const getTripDateRange = (
  trip: Trip,
  events: Event[] = trip.events ?? [],
): TripDateRange | null => {
  const tripStartKey = extractDatePart(trip.startDate);
  const tripEndKey = extractDatePart(trip.endDate);

  let start = tripStartKey ? parseDateKey(tripStartKey) : null;
  let end = tripEndKey ? parseDateKey(tripEndKey) : null;

  const eventStarts = events
    .map(getEventStart)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
  const eventEnds = events
    .map(getEventEnd)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));

  if (!start && eventStarts.length > 0) {
    start = startOfDay(new Date(Math.min(...eventStarts.map((date) => date.getTime()))));
  }
  if (!end && eventEnds.length > 0) {
    end = endOfDay(new Date(Math.max(...eventEnds.map((date) => date.getTime()))));
  }

  if (!start && !end) return null;
  if (!start && end) start = startOfDay(end);
  if (!end && start) end = endOfDay(start);

  start = startOfDay(start!);
  end = endOfDay(end!);

  if (start.getTime() > end.getTime()) return null;
  return { start, end };
};

export const enumerateTripDateKeys = (
  trip: Trip,
  events: Event[] = trip.events ?? [],
  maxDays = 366,
): string[] => {
  const range = getTripDateRange(trip, events);
  if (!range) return [];

  const keys: string[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end && keys.length < maxDays) {
    keys.push(getDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
};

/** Nights that typically need lodging (all trip days except the final departure day). */
export const enumerateTripNightDateKeys = (
  trip: Trip,
  events: Event[] = trip.events ?? [],
): string[] => {
  const keys = enumerateTripDateKeys(trip, events);
  if (keys.length <= 1) return keys;
  return keys.slice(0, -1);
};

export const formatShortDate = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export const formatShortDateRange = (startDate: string, endDate: string): string => {
  if (startDate === endDate) return formatShortDate(startDate);
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
};

export const dateKeyFromDate = (date: Date): string => getDateKey(date);

export const isDateKeyInRange = (dateKey: string, startDate: string, endDate: string): boolean => (
  dateKey >= startDate && dateKey <= endDate
);

export const getTripDateKeyBounds = (
  trip: Trip,
  events: Event[] = trip.events ?? [],
): { startDate: string; endDate: string } | null => {
  const range = getTripDateRange(trip, events);
  if (!range) return null;
  return {
    startDate: getDateKey(range.start),
    endDate: getDateKey(range.end),
  };
};
