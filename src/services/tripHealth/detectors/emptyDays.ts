import { Event, Trip } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { getEventStart } from '@/utils/eventTime';
import {
  enumerateTripDateKeys,
  formatShortDate,
  getDateKey,
} from '@/utils/tripHealthDates';
import { buildEmptyDayIssueKey } from '../issueKeys';
import { emptyDayResolutionOptions } from '../resolutionOptions';
import { EXPLORING_EVENT_UI_LABEL_PLURAL } from '@/utils/eventStatusLabels';

const SCHEDULE_EVENT_TYPES = new Set([
  'activity',
  'destination',
  'flight',
  'train',
  'bus',
  'rental_car',
  'arrival',
  'departure',
  'stay',
]);

const ANCHOR_EVENT_TYPES = new Set([
  'arrival',
  'departure',
  'stay',
  'flight',
  'train',
  'bus',
  'rental_car',
]);

const eventTouchesDate = (event: Event, dateKey: string): boolean => {
  const start = getEventStart(event);
  if (!start) return false;

  if (event.type === 'stay') {
    const data = event as Event & { checkIn?: string; checkOut?: string };
    const checkIn = data.checkIn || event.startDate;
    const checkOut = data.checkOut || event.endDate;
    if (!checkIn || !checkOut) return getDateKey(start) === dateKey;
    return dateKey >= checkIn.slice(0, 10) && dateKey < checkOut.slice(0, 10);
  }

  return getDateKey(start) === dateKey;
};

const isConfirmedAnchor = (event: Event): boolean => (
  event.status === 'confirmed' && ANCHOR_EVENT_TYPES.has(event.type)
);

export const detectEmptyDays = (trip: Trip, events: Event[]): TripHealthIssue[] => {
  const dateKeys = enumerateTripDateKeys(trip, events);
  if (dateKeys.length === 0 || dateKeys.length > 31) return [];

  const issues: TripHealthIssue[] = [];

  dateKeys.forEach((dateKey) => {
    const dayEvents = events.filter((event) => SCHEDULE_EVENT_TYPES.has(event.type) && eventTouchesDate(event, dateKey));
    if (dayEvents.length === 0) {
      issues.push({
        id: buildEmptyDayIssueKey(dateKey),
        issueKey: buildEmptyDayIssueKey(dateKey),
        type: 'empty_day',
        dimension: 'schedule',
        severity: 'info',
        title: `Open day: ${formatShortDate(dateKey)}`,
        reason: 'No activities, destinations, transport, or stays scheduled for this day.',
        affectedDates: [dateKey],
        resolutionOptions: emptyDayResolutionOptions(dateKey),
      });
      return;
    }

    const hasConfirmedAnchor = dayEvents.some(isConfirmedAnchor);
    const onlyExploring = dayEvents.every((event) => event.status === 'exploring');

    if (onlyExploring && !hasConfirmedAnchor) {
      issues.push({
        id: buildEmptyDayIssueKey(dateKey),
        issueKey: buildEmptyDayIssueKey(dateKey),
        type: 'empty_day',
        dimension: 'schedule',
        severity: 'info',
        title: `Under-planned day: ${formatShortDate(dateKey)}`,
        reason: `Only ${EXPLORING_EVENT_UI_LABEL_PLURAL.toLowerCase()} are scheduled — confirm an anchor or add a plan for this day.`,
        affectedDates: [dateKey],
        relatedEventIds: dayEvents.map((event) => event.id),
        resolutionOptions: emptyDayResolutionOptions(dateKey),
      });
    }
  });

  return issues;
};
