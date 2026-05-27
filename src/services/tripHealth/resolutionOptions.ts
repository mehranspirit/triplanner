import { EventType } from '@/types/eventTypes';
import { ResolutionOption } from '@/types/tripHealthTypes';

export const emptyDayResolutionOptions = (date: string): ResolutionOption[] => [
  {
    id: `empty-day-suggest-${date}`,
    label: 'Suggest activities',
    action: 'ai_suggest',
    payload: { date },
    isPrimary: true,
  },
  {
    id: `empty-day-add-${date}`,
    label: 'Add event manually',
    action: 'create_event',
    payload: { eventType: 'activity', prefill: { date, startDate: date, endDate: date } },
  },
  {
    id: `empty-day-rest-${date}`,
    label: 'Mark as rest day',
    action: 'dismiss',
    payload: { issueKey: `empty_day:${date}`, reason: 'intentional_rest_day' },
  },
  {
    id: `empty-day-defer-${date}`,
    label: 'Plan later',
    action: 'dismiss',
    payload: {
      issueKey: `empty_day:${date}`,
      reason: 'planning_deferred',
      reopenBeforeTripDays: 14,
    },
  },
];

export const lodgingGapResolutionOptions = (
  startDate: string,
  endDate: string,
  adjacentStayEventId?: string,
): ResolutionOption[] => {
  const issueKey = `lodging_gap:${startDate}:${endDate}`;
  const options: ResolutionOption[] = [
    {
      id: `lodging-add-${startDate}-${endDate}`,
      label: 'Add stay for these nights',
      action: 'create_event',
      payload: {
        eventType: 'stay',
        prefill: { checkIn: startDate, checkOut: endDate },
      },
      isPrimary: true,
    },
  ];

  if (adjacentStayEventId) {
    options.push({
      id: `lodging-extend-${adjacentStayEventId}`,
      label: 'Extend nearby stay',
      action: 'extend_stay',
      payload: { eventId: adjacentStayEventId },
    });
  }

  options.push(
    {
      id: `lodging-day-trip-${startDate}-${endDate}`,
      label: 'Day trip — no overnight stay',
      action: 'dismiss',
      payload: { issueKey, reason: 'day_trip' },
    },
    {
      id: `lodging-alternate-${startDate}-${endDate}`,
      label: 'Staying with friends / host',
      action: 'dismiss',
      payload: { issueKey, reason: 'alternate_lodging' },
    },
    {
      id: `lodging-transport-${startDate}-${endDate}`,
      label: 'Overnight transport covers this',
      action: 'dismiss',
      payload: { issueKey, reason: 'overnight_transport' },
    },
    {
      id: `lodging-import-${startDate}-${endDate}`,
      label: 'Import existing booking',
      action: 'open_import',
    },
  );

  return options;
};

export const transportMissingResolutionOptions = (
  arrivalEventId: string,
  eventType: EventType = 'rental_car',
): ResolutionOption[] => {
  const issueKey = `transport_gap:missing:${arrivalEventId}`;
  return [
    {
      id: `transport-add-${arrivalEventId}`,
      label: 'Add ground transport',
      action: 'create_event',
      payload: { eventType, prefill: { afterEventId: arrivalEventId } },
      isPrimary: true,
    },
    {
      id: `transport-rideshare-${arrivalEventId}`,
      label: 'Using rideshare / taxi',
      action: 'dismiss',
      payload: { issueKey, reason: 'ad_hoc_ground_transport' },
    },
    {
      id: `transport-import-${arrivalEventId}`,
      label: 'Import booking',
      action: 'open_import',
    },
  ];
};

export const transportTightResolutionOptions = (
  arrivalEventId: string,
  nextEventId: string,
): ResolutionOption[] => {
  const issueKey = `transport_gap:tight:${arrivalEventId}`;
  return [
    {
      id: `transport-buffer-${arrivalEventId}`,
      label: 'Add buffer time',
      action: 'create_event',
      payload: {
        eventType: 'activity',
        prefill: { afterEventId: arrivalEventId, title: 'Travel buffer' },
      },
      isPrimary: true,
    },
    {
      id: `transport-reschedule-${nextEventId}`,
      label: 'Reschedule next event',
      action: 'edit_event',
      payload: { eventId: nextEventId },
    },
    {
      id: `transport-ok-${arrivalEventId}`,
      label: 'Connection is fine',
      action: 'dismiss',
      payload: { issueKey, reason: 'connection_ok' },
    },
    {
      id: `transport-ground-${arrivalEventId}`,
      label: 'Add ground transport',
      action: 'create_event',
      payload: { eventType: 'rental_car', prefill: { afterEventId: arrivalEventId } },
    },
  ];
};

export const locationResolutionOptions = (eventId: string): ResolutionOption[] => {
  const issueKey = `location:${eventId}`;
  return [
    {
      id: `location-review-${eventId}`,
      label: 'Review location',
      action: 'review_location',
      payload: { eventId },
      isPrimary: true,
    },
    {
      id: `location-edit-${eventId}`,
      label: 'Edit event',
      action: 'edit_event',
      payload: { eventId },
    },
    {
      id: `location-optional-${eventId}`,
      label: 'Map not needed',
      action: 'dismiss',
      payload: { issueKey, reason: 'location_optional' },
    },
  ];
};

export const bookingRefResolutionOptions = (eventId: string): ResolutionOption[] => {
  const issueKey = `booking_ref:${eventId}`;
  return [
    {
      id: `booking-edit-${eventId}`,
      label: 'Add confirmation',
      action: 'edit_event',
      payload: { eventId },
      isPrimary: true,
    },
    {
      id: `booking-import-${eventId}`,
      label: 'Paste from import inbox',
      action: 'open_import',
    },
    {
      id: `booking-skip-${eventId}`,
      label: 'Not required',
      action: 'dismiss',
      payload: { issueKey, reason: 'booking_not_required' },
    },
  ];
};

export const exploringEventResolutionOptions = (eventId: string): ResolutionOption[] => [
  {
    id: `exploring-edit-${eventId}`,
    label: 'Review option',
    action: 'edit_event',
    payload: { eventId },
    isPrimary: true,
  },
  {
    id: `exploring-suggest-${eventId}`,
    label: 'Find alternatives',
    action: 'ai_suggest',
  },
];

export const orphanExploringResolutionOptions = (
  eventId: string,
  sameDayOrphanIds: string[] = [],
): ResolutionOption[] => {
  const options = exploringEventResolutionOptions(eventId);

  if (sameDayOrphanIds.length >= 2 && sameDayOrphanIds.includes(eventId)) {
    options.push({
      id: `exploring-group-${eventId}`,
      label: 'Group for vote',
      action: 'create_decision',
      payload: { optionEventIds: sameDayOrphanIds },
    });
  }

  return options;
};

export const openDecisionResolutionOptions = (
  decisionId: string,
  status: 'open' | 'deferred',
  slotDate?: string,
  slotEndDate?: string,
): ResolutionOption[] => {
  const options: ResolutionOption[] = [
    {
      id: `open-decision-compare-${decisionId}`,
      label: status === 'open' ? 'Open comparison' : 'Review comparison',
      action: 'open_decision',
      payload: { decisionId },
      isPrimary: true,
    },
  ];

  if (status === 'open') {
    options.push(
      {
        id: `open-decision-confirm-${decisionId}`,
        label: 'Confirm winner',
        action: 'open_decision',
        payload: { decisionId },
      },
      {
        id: `open-decision-add-existing-${decisionId}`,
        label: 'Add existing option',
        action: 'add_decision_option',
        payload: { decisionId },
      },
      {
        id: `open-decision-add-${decisionId}`,
        label: 'Explore new option',
        action: 'ai_suggest',
        payload: slotDate
          ? {
            date: slotDate,
            ...(slotEndDate && slotEndDate !== slotDate ? { endDate: slotEndDate } : {}),
          }
          : undefined,
      },
      {
        id: `open-decision-defer-${decisionId}`,
        label: 'Defer decision',
        action: 'defer_decision',
        payload: { decisionId },
      },
    );
  }

  return options;
};

export const scheduleConflictResolutionOptions = (
  issueKey: string,
  eventId: string,
  primaryLabel = 'Review event',
): ResolutionOption[] => [
  {
    id: `conflict-edit-${eventId}`,
    label: primaryLabel,
    action: 'edit_event',
    payload: { eventId },
    isPrimary: true,
  },
  {
    id: `conflict-timeline-${eventId}`,
    label: 'Open timeline',
    action: 'navigate',
    payload: { panel: 'today' },
  },
];
