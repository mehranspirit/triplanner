import { Trip } from '@/types/eventTypes';
import { getEventEnd, getEventStart } from '@/utils/eventTime';

export type TripTemporalStatus = 'upcoming' | 'active' | 'completed' | 'unscheduled';

export interface TripStatusSummary {
  status: TripTemporalStatus;
  label: string;
  description: string;
  start: Date | null;
  end: Date | null;
}

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const daysBetween = (from: Date, to: Date) => {
  const milliseconds = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(milliseconds / (24 * 60 * 60 * 1000));
};

const getTripBounds = (trip: Trip) => {
  const eventStarts = (trip.events || [])
    .map(getEventStart)
    .filter((date): date is Date => Boolean(date));
  const eventEnds = (trip.events || [])
    .map(getEventEnd)
    .filter((date): date is Date => Boolean(date));

  const start = parseDate(trip.startDate) || eventStarts.sort((a, b) => a.getTime() - b.getTime())[0] || null;
  const end = parseDate(trip.endDate) || eventEnds.sort((a, b) => b.getTime() - a.getTime())[0] || start;

  return {
    start: start ? startOfDay(start) : null,
    end: end ? endOfDay(end) : null,
  };
};

export const getTripStatusSummary = (trip: Trip, now = new Date()): TripStatusSummary => {
  const { start, end } = getTripBounds(trip);

  if (!start || !end) {
    return {
      status: 'unscheduled',
      label: 'Trip dates missing',
      description: 'Add trip dates or itinerary events to unlock active-trip guidance.',
      start,
      end,
    };
  }

  if (now < start) {
    const daysUntil = daysBetween(now, start);
    return {
      status: 'upcoming',
      label: daysUntil === 0 ? 'Starts today' : `Starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
      description: 'Use Today to prepare for the next scheduled trip details.',
      start,
      end,
    };
  }

  if (now > end) {
    return {
      status: 'completed',
      label: 'Trip completed',
      description: 'Today is now most useful for wrap-up tasks, notes, and expenses.',
      start,
      end,
    };
  }

  const daysRemaining = Math.max(0, daysBetween(now, end));
  return {
    status: 'active',
    label: daysRemaining === 0 ? 'Last day of trip' : `Active, ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
    description: 'Focus on what is happening now, next, and what still needs attention.',
    start,
    end,
  };
};
