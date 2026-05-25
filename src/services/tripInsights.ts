import { Event, Trip } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripInsight } from '@/types/insightTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import {
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';
import {
  eventHasLocationAttention,
} from '@/utils/eventLocation';

interface TripInsightInput {
  trip: Trip;
  events?: Event[];
  now?: Date;
  sync?: {
    isOnline: boolean;
    pendingCount: number;
  };
  weatherSnapshots?: WeatherSnapshot[];
  flightStatusSnapshots?: FlightStatusSnapshot[];
}

const createInsight = (insight: Omit<TripInsight, 'createdAt'>): TripInsight => ({
  ...insight,
  createdAt: new Date().toISOString(),
});

export const getMissingLocationInsightId = (eventId: string) => `missing-location-${eventId}`;

const getLocationMissingInsight = (event: Event): TripInsight | null => {
  if (!eventHasLocationAttention(event)) {
    return null;
  }

  const isInferred = event.location?.quality === 'inferred';

  return createInsight({
    id: getMissingLocationInsightId(event.id),
    type: 'missing_info',
    severity: 'warning',
    title: isInferred ? 'Approximate location' : 'Location missing',
    message: isInferred
      ? `${getEventDisplayName(event)} has an approximate map location. Add a clearer address for better accuracy.`
      : `${getEventDisplayName(event)} does not have a usable address or map location yet.`,
    actionLabel: 'Edit event',
    actionTarget: 'event',
    source: { kind: 'event', id: event.id },
    dismissible: true,
  });
};

const requiresBookingReference = (event: Event) => {
  return ['arrival', 'departure', 'flight', 'train', 'bus', 'rental_car', 'stay'].includes(event.type);
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
    const isStayOverlapWithTimedEvent = (
      (current.event.type === 'stay' && next.event.type !== 'stay') ||
      (next.event.type === 'stay' && current.event.type !== 'stay')
    );

    if (current.end > next.start && !isStayOverlapWithTimedEvent) {
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

const getTripDateRange = (trip: Trip) => {
  const start = trip.startDate ? new Date(trip.startDate) : null;
  const end = trip.endDate ? new Date(trip.endDate) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getOutOfTripRangeInsights = (trip: Trip, events: Event[]): TripInsight[] => {
  const range = getTripDateRange(trip);
  if (!range) return [];

  return events.flatMap((event) => {
    const start = getEventStart(event);
    if (!start || (start >= range.start && start <= range.end)) {
      return [];
    }

    return [createInsight({
      id: `outside-trip-dates-${event.id}`,
      type: 'conflict',
      severity: 'critical',
      title: 'Event outside trip dates',
      message: `${getEventDisplayName(event)} is dated outside this trip's date range. This can make the timeline look out of order.`,
      actionLabel: 'Edit event',
      actionTarget: 'event',
      source: { kind: 'event', id: event.id },
      dismissible: true,
    })];
  });
};

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatShortDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (Number.isNaN(date.getTime())) return dateKey;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const enumerateTripDateKeys = (trip: Trip) => {
  const range = getTripDateRange(trip);
  if (!range) return [];

  const keys: string[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end && keys.length <= 31) {
    keys.push(getDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
};

interface RoutePoint {
  lat: number;
  lng: number;
}

const getUsableEventLocation = (event: Event): RoutePoint | null => {
  if (
    !event.location ||
    !event.location.lat ||
    !event.location.lng ||
    event.location.lat === 0 ||
    event.location.lng === 0
  ) {
    return null;
  }

  return {
    lat: event.location.lat,
    lng: event.location.lng,
  };
};

const getFlightEndpointPoint = (
  event: Event,
  role: 'departure' | 'arrival',
  weatherSnapshots: WeatherSnapshot[]
): RoutePoint | null => {
  if (event.type !== 'flight') return null;

  const snapshot = weatherSnapshots.find((item) => (
    (item.originalEventId || item.eventId) === event.id &&
    item.locationRole === role &&
    item.lat &&
    item.lng
  ));

  if (!snapshot) return null;

  return {
    lat: snapshot.lat,
    lng: snapshot.lng,
  };
};

const getRoutePoint = (
  event: Event,
  side: 'from' | 'to',
  weatherSnapshots: WeatherSnapshot[]
): RoutePoint | null => {
  if (event.type === 'flight') {
    return getFlightEndpointPoint(event, side === 'from' ? 'arrival' : 'departure', weatherSnapshots);
  }

  return getUsableEventLocation(event);
};

const getDistanceKm = (from: RoutePoint, to: RoutePoint) => {
  const fromLocation = from;
  const toLocation = to;

  if (
    !fromLocation ||
    !toLocation ||
    !fromLocation.lat ||
    !fromLocation.lng ||
    !toLocation.lat ||
    !toLocation.lng ||
    fromLocation.lat === 0 ||
    fromLocation.lng === 0 ||
    toLocation.lat === 0 ||
    toLocation.lng === 0
  ) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLocation.lat - fromLocation.lat);
  const dLng = toRadians(toLocation.lng - fromLocation.lng);
  const lat1 = toRadians(fromLocation.lat);
  const lat2 = toRadians(toLocation.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const estimateTravelMinutes = (distanceKm: number) => {
  const averageUrbanSpeedKmh = 40;
  const bufferMinutes = 15;
  return Math.ceil((distanceKm / averageUrbanSpeedKmh) * 60 + bufferMinutes);
};

const getRouteTimingInsights = (events: Event[], weatherSnapshots: WeatherSnapshot[] = []): TripInsight[] => {
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

    if (getDateKey(current.end) !== getDateKey(next.start)) {
      continue;
    }

    const fromPoint = getRoutePoint(current.event, 'from', weatherSnapshots);
    const toPoint = getRoutePoint(next.event, 'to', weatherSnapshots);

    if (!fromPoint || !toPoint) {
      continue;
    }

    const distanceKm = getDistanceKm(fromPoint, toPoint);
    if (!distanceKm || distanceKm < 2) {
      continue;
    }

    const gapMinutes = Math.round((next.start.getTime() - current.end.getTime()) / (60 * 1000));
    if (gapMinutes < 0) {
      continue;
    }

    const estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
    const distanceMiles = Math.round(distanceKm * 0.621371);

    if (gapMinutes < estimatedTravelMinutes) {
      insights.push(createInsight({
        id: `tight-transfer-${current.event.id}-${next.event.id}`,
        type: 'conflict',
        severity: gapMinutes < estimatedTravelMinutes / 2 ? 'critical' : 'warning',
        title: 'Tight travel buffer',
        message: `There are about ${gapMinutes} minutes between ${getEventDisplayName(current.event)} and ${getEventDisplayName(next.event)}, but the locations are roughly ${distanceMiles} miles apart. Add more buffer or adjust timing.`,
        actionLabel: 'Edit next event',
        actionTarget: 'event',
        source: { kind: 'event', id: next.event.id },
        dismissible: true,
      }));
      continue;
    }

    if (distanceKm >= 50 && gapMinutes < estimatedTravelMinutes + 45) {
      insights.push(createInsight({
        id: `long-transfer-${current.event.id}-${next.event.id}`,
        type: 'suggestion',
        severity: 'info',
        title: 'Long transfer between events',
        message: `${getEventDisplayName(current.event)} and ${getEventDisplayName(next.event)} are roughly ${distanceMiles} miles apart on the same day. Confirm travel time and add a buffer if needed.`,
        actionLabel: 'Review next event',
        actionTarget: 'event',
        source: { kind: 'event', id: next.event.id },
        dismissible: true,
      }));
    }
  }

  return insights;
};

const getItineraryShapeInsights = (trip: Trip, events: Event[]): TripInsight[] => {
  const dateKeys = enumerateTripDateKeys(trip);
  if (dateKeys.length < 2 || dateKeys.length > 21) return [];

  const planningEventTypes = new Set(['activity', 'destination', 'flight', 'train', 'bus', 'rental_car', 'arrival', 'departure']);
  const eventsByDate = new Map<string, Event[]>();

  events.forEach((event) => {
    if (!planningEventTypes.has(event.type)) return;

    const start = getEventStart(event);
    if (!start) return;

    const key = getDateKey(start);
    eventsByDate.set(key, [...(eventsByDate.get(key) || []), event]);
  });

  const insights: TripInsight[] = [];
  const openDateKeys = dateKeys.filter((dateKey) => (eventsByDate.get(dateKey) || []).length === 0);

  if (openDateKeys.length > 0 && events.length > 0) {
    const visibleDates = openDateKeys.slice(0, 3).map(formatShortDate).join(', ');
    insights.push(createInsight({
      id: `open-days-${trip._id}-${openDateKeys.join('-')}`,
      type: 'suggestion',
      severity: 'info',
      title: openDateKeys.length === 1 ? 'Open day in itinerary' : 'Open days in itinerary',
      message: `${visibleDates}${openDateKeys.length > 3 ? ` and ${openDateKeys.length - 3} more day${openDateKeys.length - 3 === 1 ? '' : 's'}` : ''} ${openDateKeys.length === 1 ? 'has' : 'have'} no scheduled activity, destination, or transport. Add a flexible plan or keep it intentionally open.`,
      actionLabel: 'Add activity',
      actionTarget: 'add_event',
      actionEventType: 'activity',
      source: { kind: 'trip', id: trip._id },
      dismissible: true,
    }));
  }

  Array.from(eventsByDate.entries()).forEach(([dateKey, dayEvents]) => {
    if (dayEvents.length < 4) return;

    const sortedDayEvents = sortEventsByStart(dayEvents);
    insights.push(createInsight({
      id: `packed-day-${trip._id}-${dateKey}`,
      type: 'suggestion',
      severity: dayEvents.length >= 6 ? 'warning' : 'info',
      title: 'This day may be packed',
      message: `${formatShortDate(dateKey)} has ${dayEvents.length} scheduled items. Review timing and travel buffers so the day stays realistic.`,
      actionLabel: 'Review first event',
      actionTarget: 'event',
      source: { kind: 'event', id: sortedDayEvents[0]?.id },
      dismissible: true,
    }));
  });

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

const getWeatherInsights = (events: Event[], weatherSnapshots: WeatherSnapshot[] = []): TripInsight[] => {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const outdoorEventTypes = new Set(['activity', 'destination']);
  const insights: TripInsight[] = [];

  weatherSnapshots.forEach((snapshot) => {
    const event = eventsById.get(snapshot.originalEventId || snapshot.eventId);
    if (!event) return;

    const forecast = snapshot.daily?.[0];
    if (!forecast) return;

    const eventName = getEventDisplayName(event);
    const precipitationProbability = forecast.precipitationProbabilityMax ?? 0;
    const precipitationAmount = forecast.precipitationSum ?? 0;
    const windSpeed = forecast.windSpeedMax ?? 0;
    const highTemp = forecast.temperatureMax;
    const locationHint = snapshot.locationName ? ` near ${snapshot.locationName}` : '';

    if (
      outdoorEventTypes.has(event.type) &&
      (precipitationProbability >= 60 || precipitationAmount >= 0.15 || /rain|thunderstorm|drizzle/i.test(forecast.condition || ''))
    ) {
      insights.push(createInsight({
        id: `weather-rain-${snapshot.eventId}-${forecast.date}`,
        type: 'suggestion',
        severity: precipitationProbability >= 80 || precipitationAmount >= 0.4 ? 'warning' : 'info',
        title: 'Add an indoor backup',
        message: `${eventName} has ${forecast.condition?.toLowerCase() || 'wet weather'} forecast for ${forecast.date}${precipitationProbability ? ` with a ${precipitationProbability}% chance of precipitation` : ''}. Add an indoor backup activity${locationHint} so the day still has a plan if weather turns.`,
        actionLabel: 'Add backup activity',
        actionTarget: 'add_event',
        actionEventType: 'activity',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
    }

    if (typeof highTemp === 'number' && highTemp >= 90) {
      insights.push(createInsight({
        id: `weather-heat-${snapshot.eventId}-${forecast.date}`,
        type: 'reminder',
        severity: highTemp >= 100 ? 'warning' : 'info',
        title: 'Consider cooler timing',
        message: `${eventName} may be hot on ${forecast.date}, with a forecast high near ${Math.round(highTemp)} deg F. Consider shifting outdoor plans earlier or later and planning water, shade, and sun protection.`,
        actionLabel: 'Edit event',
        actionTarget: 'event',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
    }

    if (windSpeed >= 30) {
      insights.push(createInsight({
        id: `weather-wind-${snapshot.eventId}-${forecast.date}`,
        type: 'reminder',
        severity: windSpeed >= 40 ? 'warning' : 'info',
        title: 'Windy conditions expected',
        message: `${eventName} has forecast wind up to ${Math.round(windSpeed)} mph on ${forecast.date}. Double-check outdoor plans, exposed viewpoints, boat tours, and travel timing.`,
        actionLabel: 'Edit event',
        actionTarget: 'event',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
    }
  });

  return insights;
};

const getFlightStatusInsights = (
  events: Event[],
  flightStatusSnapshots: FlightStatusSnapshot[] = []
): TripInsight[] => {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const insights: TripInsight[] = [];

  flightStatusSnapshots.forEach((snapshot) => {
    const event = eventsById.get(snapshot.eventId);
    if (!event) return;

    const normalizedStatus = (snapshot.status || '').toLowerCase();
    const departureDelay = snapshot.departure?.delayMinutes || 0;
    const arrivalDelay = snapshot.arrival?.delayMinutes || 0;
    const delayMinutes = Math.max(departureDelay, arrivalDelay);
    const gateInfo = [
      snapshot.departure?.terminal ? `terminal ${snapshot.departure.terminal}` : null,
      snapshot.departure?.gate ? `gate ${snapshot.departure.gate}` : null,
    ].filter(Boolean).join(', ');

    if (/cancel/.test(normalizedStatus)) {
      insights.push(createInsight({
        id: `flight-cancelled-${snapshot.eventId}-${snapshot.dateLocal}`,
        type: 'conflict',
        severity: 'critical',
        title: 'Flight may be cancelled',
        message: `${getEventDisplayName(event)} is showing status "${snapshot.status}". Check with the airline before heading to the airport.`,
        actionLabel: 'Edit flight',
        actionTarget: 'event',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
      return;
    }

    if (delayMinutes >= 30 || /delay/.test(normalizedStatus)) {
      insights.push(createInsight({
        id: `flight-delayed-${snapshot.eventId}-${snapshot.dateLocal}`,
        type: 'reminder',
        severity: delayMinutes >= 90 ? 'warning' : 'info',
        title: 'Flight delay reported',
        message: `${getEventDisplayName(event)} is showing ${delayMinutes ? `about ${delayMinutes} minutes of delay` : `status "${snapshot.status}"`}. Recheck connections, airport pickup, and arrival plans.`,
        actionLabel: 'Edit flight',
        actionTarget: 'event',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
    }

    if (gateInfo) {
      insights.push(createInsight({
        id: `flight-gate-${snapshot.eventId}-${snapshot.dateLocal}`,
        type: 'reminder',
        severity: 'info',
        title: 'Flight gate details available',
        message: `${getEventDisplayName(event)} currently shows departure ${gateInfo}. Verify in the airline app before boarding.`,
        actionLabel: 'Review flight',
        actionTarget: 'event',
        source: { kind: 'event', id: event.id },
        dismissible: true,
      }));
    }
  });

  return insights;
};

export const generateTripInsights = ({
  trip,
  events = trip.events || [],
  sync,
  weatherSnapshots = [],
  flightStatusSnapshots = [],
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
    ...getOutOfTripRangeInsights(trip, events),
    ...getOverlapInsights(events),
    ...eventInsights,
    ...getGroundTransportInsights(events),
    ...getWeatherInsights(events, weatherSnapshots),
    ...getFlightStatusInsights(events, flightStatusSnapshots),
    ...getRouteTimingInsights(events, weatherSnapshots),
    ...getItineraryShapeInsights(trip, events),
    ...getPlanningGapInsights(trip, events),
  ];
};
