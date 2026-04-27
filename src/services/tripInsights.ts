import { Event, Trip } from '@/types/eventTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventLocationLabel,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';

interface TripInsightInput {
  trip: Trip;
  events?: Event[];
  now?: Date;
  sync?: {
    isOnline: boolean;
    pendingCount: number;
  };
}

const createInsight = (insight: Omit<TripInsight, 'createdAt'>): TripInsight => ({
  ...insight,
  createdAt: new Date().toISOString(),
});

const hasPlaceholderLocation = (event: Event) => {
  return event.location?.lat === 0 && event.location?.lng === 0;
};

const requiresBookingReference = (event: Event) => {
  return ['arrival', 'departure', 'flight', 'train', 'bus', 'rental_car', 'stay'].includes(event.type);
};

const getLocationMissingInsight = (event: Event): TripInsight | null => {
  if (['arrival', 'departure', 'flight', 'train', 'bus'].includes(event.type)) {
    return null;
  }

  if (getEventLocationLabel(event) && !hasPlaceholderLocation(event)) {
    return null;
  }

  return createInsight({
    id: `missing-location-${event.id}`,
    type: 'missing_info',
    severity: 'warning',
    title: 'Location missing',
    message: `${getEventDisplayName(event)} does not have a usable address or map location yet.`,
    actionLabel: 'Edit event',
    actionTarget: 'event',
    source: { kind: 'event', id: event.id },
    dismissible: true,
  });
};

const getBookingReferenceInsight = (event: Event): TripInsight | null => {
  if (!requiresBookingReference(event) || getEventBookingReference(event)) {
    return null;
  }

  return createInsight({
    id: `missing-booking-${event.id}`,
    type: 'missing_info',
    severity: 'info',
    title: 'Confirmation missing',
    message: `${getEventDisplayName(event)} is missing a booking or reservation reference.`,
    actionLabel: 'Edit event',
    actionTarget: 'event',
    source: { kind: 'event', id: event.id },
    dismissible: true,
  });
};

const getTimeMissingInsight = (event: Event): TripInsight | null => {
  const start = getEventStart(event);
  const end = getEventEnd(event);

  if (start && end) {
    return null;
  }

  return createInsight({
    id: `missing-time-${event.id}`,
    type: 'missing_info',
    severity: 'warning',
    title: 'Time missing',
    message: `${getEventDisplayName(event)} is missing a start or end time, so itinerary checks may be incomplete.`,
    actionLabel: 'Edit event',
    actionTarget: 'event',
    source: { kind: 'event', id: event.id },
    dismissible: true,
  });
};

const getOverlapInsights = (events: Event[]): TripInsight[] => {
  const scheduledEvents = sortEventsByStart(events)
    .map((event) => ({
      event,
      start: getEventStart(event),
      end: getEventEnd(event),
    }))
    .filter((item): item is { event: Event; start: Date; end: Date } => !!item.start && !!item.end);

  const insights: TripInsight[] = [];

  for (let i = 0; i < scheduledEvents.length - 1; i += 1) {
    const current = scheduledEvents[i];
    const next = scheduledEvents[i + 1];

    if (current.end > next.start) {
      insights.push(createInsight({
        id: `overlap-${current.event.id}-${next.event.id}`,
        type: 'conflict',
        severity: 'critical',
        title: 'Events overlap',
        message: `${getEventDisplayName(current.event)} overlaps with ${getEventDisplayName(next.event)}.`,
        actionLabel: 'Review timeline',
        actionTarget: 'event',
        source: { kind: 'event', id: next.event.id },
        dismissible: true,
      }));
    }
  }

  return insights;
};

const getPlanningGapInsights = (trip: Trip, events: Event[]): TripInsight[] => {
  const insights: TripInsight[] = [];
  const hasTravel = events.some((event) => ['arrival', 'departure', 'flight', 'train', 'bus'].includes(event.type));
  const hasStay = events.some((event) => event.type === 'stay');
  const hasActivity = events.some((event) => ['activity', 'destination'].includes(event.type));
  const exploringCount = events.filter((event) => event.status === 'exploring').length;

  if (events.length === 0) {
    insights.push(createInsight({
      id: `empty-trip-${trip._id}`,
      type: 'suggestion',
      severity: 'info',
      title: 'Start with your bookings',
      message: 'Paste a confirmation email or add your first event to start building the trip.',
      actionLabel: 'Parse with AI',
      actionTarget: 'ai_import',
      source: { kind: 'trip', id: trip._id },
      dismissible: false,
    }));
  }

  if (hasTravel && !hasStay) {
    insights.push(createInsight({
      id: `missing-stay-${trip._id}`,
      type: 'missing_info',
      severity: 'warning',
      title: 'No stay added',
      message: 'This trip has transportation but no lodging yet.',
      actionLabel: 'Add stay',
      actionTarget: 'add_event',
      actionEventType: 'stay',
      source: { kind: 'trip', id: trip._id },
      dismissible: true,
    }));
  }

  if (hasStay && !hasTravel) {
    insights.push(createInsight({
      id: `missing-transport-${trip._id}`,
      type: 'suggestion',
      severity: 'info',
      title: 'Transportation not added',
      message: 'You have lodging, but no arrival, departure, or transit events yet.',
      actionLabel: 'Add transport',
      actionTarget: 'add_event',
      actionEventType: 'rental_car',
      source: { kind: 'trip', id: trip._id },
      dismissible: true,
    }));
  }

  if (!hasActivity && events.length > 0) {
    insights.push(createInsight({
      id: `missing-activities-${trip._id}`,
      type: 'suggestion',
      severity: 'info',
      title: 'No activities planned',
      message: 'Add activities or destinations so the trip has more than logistics.',
      actionLabel: 'Generate ideas',
      actionTarget: 'ai_import',
      source: { kind: 'trip', id: trip._id },
      dismissible: true,
    }));
  }

  if (exploringCount > 0) {
    insights.push(createInsight({
      id: `exploring-events-${trip._id}`,
      type: 'reminder',
      severity: 'info',
      title: 'Some events need decisions',
      message: `${exploringCount} event${exploringCount === 1 ? '' : 's'} still marked as exploring.`,
      actionLabel: 'Review events',
      actionTarget: 'event',
      source: { kind: 'trip', id: trip._id },
      dismissible: true,
    }));
  }

  return insights;
};

const getGroundTransportInsights = (events: Event[]): TripInsight[] => {
  const transitTypes = new Set(['rental_car', 'train', 'bus']);

  return events
    .filter((event) => event.type === 'flight')
    .flatMap((flight) => {
      const flightData = flight as any;
      const arrivalTime = getEventEnd(flight);

      if (!arrivalTime || !flightData.arrivalAirport) {
        return [];
      }

      const hasNearbyGroundTransport = events.some((event) => {
        if (!transitTypes.has(event.type)) return false;
        const transportStart = getEventStart(event);
        if (!transportStart) return false;

        const hoursAfterArrival = (transportStart.getTime() - arrivalTime.getTime()) / (60 * 60 * 1000);
        return hoursAfterArrival >= -1 && hoursAfterArrival <= 12;
      });

      if (hasNearbyGroundTransport) {
        return [];
      }

      return [createInsight({
        id: `ground-transport-${flight.id}`,
        type: 'suggestion',
        severity: 'info',
        title: 'Plan ground transport',
        message: `${getEventDisplayName(flight)} arrives at ${flightData.arrivalAirport}. Add how you will get from the airport to your next stop.`,
        actionLabel: 'Add transport',
        actionTarget: 'add_event',
        actionEventType: 'rental_car',
        source: { kind: 'event', id: flight.id },
        dismissible: true,
      })];
    });
};

export const generateTripInsights = ({
  trip,
  events = trip.events || [],
  sync,
}: TripInsightInput): TripInsight[] => {
  const eventInsights = events.flatMap((event) => [
    getLocationMissingInsight(event),
    getBookingReferenceInsight(event),
    getTimeMissingInsight(event),
  ]).filter((insight): insight is TripInsight => Boolean(insight));

  const syncInsights: TripInsight[] = sync?.pendingCount
    ? [createInsight({
        id: `pending-sync-${trip._id}`,
        type: 'sync',
        severity: sync.isOnline ? 'info' : 'warning',
        title: sync.isOnline ? 'Changes are syncing' : 'Offline changes pending',
        message: `${sync.pendingCount} change${sync.pendingCount === 1 ? '' : 's'} waiting to sync.`,
        actionLabel: 'Review sync',
        actionTarget: undefined,
        source: { kind: 'sync' },
        dismissible: false,
      })]
    : [];

  return [
    ...syncInsights,
    ...getOverlapInsights(events),
    ...eventInsights,
    ...getGroundTransportInsights(events),
    ...getPlanningGapInsights(trip, events),
  ];
};
