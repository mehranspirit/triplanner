import { Event, Trip } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import {
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';
import { eventHasLocationAttention } from '@/utils/eventLocation';
import { getTripDateRange, getDateKey } from '@/utils/tripHealthDates';
import {
  buildBookingRefIssueKey,
  buildLocationIssueKey,
  buildScheduleConflictIssueKey,
} from '../issueKeys';
import {
  bookingRefResolutionOptions,
  locationResolutionOptions,
  scheduleConflictResolutionOptions,
} from '../resolutionOptions';

export { detectExploringEvents } from './decisions';

const requiresBookingReference = (event: Event): boolean => (
  ['arrival', 'departure', 'flight', 'train', 'bus', 'rental_car', 'stay'].includes(event.type)
);

export const detectLocationIssues = (events: Event[]): TripHealthIssue[] => (
  events.flatMap((event) => {
    if (!eventHasLocationAttention(event)) return [];

    const isInferred = event.location?.quality === 'inferred';
    const issueKey = buildLocationIssueKey(event.id);

    return [{
      id: issueKey,
      issueKey,
      type: 'location',
      dimension: 'location',
      severity: isInferred ? 'info' : 'warning',
      title: isInferred ? 'Approximate location' : 'Location needs review',
      reason: isInferred
        ? `${getEventDisplayName(event)} has an approximate map pin. Confirm for better routing.`
        : `${getEventDisplayName(event)} is missing a confirmed map location.`,
      relatedEventIds: [event.id],
      resolutionOptions: locationResolutionOptions(event.id),
    }];
  })
);

export const detectBookingRefIssues = (events: Event[]): TripHealthIssue[] => (
  events.flatMap((event) => {
    if (!requiresBookingReference(event) || getEventBookingReference(event)) return [];

    const issueKey = buildBookingRefIssueKey(event.id);
    return [{
      id: issueKey,
      issueKey,
      type: 'booking_ref',
      dimension: 'booking',
      severity: 'info',
      title: 'Confirmation missing',
      reason: `${getEventDisplayName(event)} has no booking or reservation reference.`,
      relatedEventIds: [event.id],
      resolutionOptions: bookingRefResolutionOptions(event.id),
    }];
  })
);

export const detectScheduleConflicts = (trip: Trip, events: Event[]): TripHealthIssue[] => [
  ...detectOverlapIssues(events),
  ...detectOutOfTripRangeIssues(trip, events),
];

const detectOverlapIssues = (events: Event[]): TripHealthIssue[] => {
  const scheduledEvents = sortEventsByStart(events)
    .map((event) => ({
      event,
      start: getEventStart(event),
      end: getEventEnd(event),
    }))
    .filter((item): item is { event: Event; start: Date; end: Date } => !!item.start && !!item.end);

  const issues: TripHealthIssue[] = [];

  for (let index = 0; index < scheduledEvents.length - 1; index += 1) {
    const current = scheduledEvents[index];
    const next = scheduledEvents[index + 1];
    const isStayOverlapWithTimedEvent = (
      (current.event.type === 'stay' && next.event.type !== 'stay')
      || (next.event.type === 'stay' && current.event.type !== 'stay')
    );

    if (current.end > next.start && !isStayOverlapWithTimedEvent) {
      const issueKey = buildScheduleConflictIssueKey('overlap', `${current.event.id}-${next.event.id}`);
      issues.push({
        id: issueKey,
        issueKey,
        type: 'schedule_conflict',
        dimension: 'schedule',
        severity: 'critical',
        title: 'Events overlap',
        reason: `${getEventDisplayName(current.event)} overlaps with ${getEventDisplayName(next.event)}.`,
        relatedEventIds: [current.event.id, next.event.id],
        resolutionOptions: scheduleConflictResolutionOptions(issueKey, next.event.id, 'Review next event'),
      });
    }
  }

  return issues;
};

const detectOutOfTripRangeIssues = (trip: Trip, events: Event[]): TripHealthIssue[] => {
  const range = getTripDateRange(trip, events);
  if (!range) return [];

  return events.flatMap((event) => {
    const start = getEventStart(event);
    if (!start || (start >= range.start && start <= range.end)) {
      return [];
    }

    const issueKey = buildScheduleConflictIssueKey('outside_trip', event.id);
    return [{
      id: issueKey,
      issueKey,
      type: 'schedule_conflict',
      dimension: 'schedule',
      severity: 'critical',
      title: 'Event outside trip dates',
      reason: `${getEventDisplayName(event)} falls outside this trip's date range.`,
      relatedEventIds: [event.id],
      affectedDates: [getDateKey(start)],
      resolutionOptions: scheduleConflictResolutionOptions(issueKey, event.id, 'Edit event'),
    }];
  });
};

