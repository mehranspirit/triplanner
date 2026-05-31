import { startOfDay } from 'date-fns';
import { Event } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import {
  getEventEnd,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';
import { getDateKey } from '@/utils/tripHealthDates';
import {
  endpointLocationHasCoordinates,
  getTransportEndpointLocation,
  isDualEndpointTransportEvent,
} from '@/utils/transportLocation';
import {
  eventOccursOnDayKey,
  getMultidayEventDayRole,
  parseTimelineDateKey,
  UNSCHEDULED_FILTER_KEY,
} from '@/utils/timelineDates';
import {
  AVERAGE_URBAN_SPEED_KMH,
  DOMESTIC_CONNECTION_TIGHT_MINUTES,
  INTERNATIONAL_CONNECTION_TIGHT_MINUTES,
  LONG_TRANSFER_DISTANCE_KM,
  LONG_TRANSFER_EXTRA_BUFFER_MINUTES,
  MIN_TRANSFER_DISTANCE_KM,
  TRANSFER_BUFFER_MINUTES,
} from '@/constants/tripHealthThresholds';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export type TransferSeverity = 'ok' | 'tight' | 'long' | 'missing';

export interface TransferSummary {
  from: Event;
  to: Event;
  fromPoint: RoutePoint;
  toPoint: RoutePoint;
  gapMinutes: number;
  estimatedTravelMinutes: number;
  distanceKm: number;
  distanceMiles: number;
  severity: TransferSeverity;
  tightThresholdMinutes: number;
}

const TRANSPORT_ARRIVAL_TYPES = new Set(['flight', 'train', 'bus', 'arrival']);
const GROUND_TRANSPORT_TYPES = new Set(['rental_car', 'train', 'bus']);
const TRANSPORT_INBOUND_TYPES = new Set(['flight', 'train', 'bus', 'arrival']);

export const getUsableEventLocation = (event: Event): RoutePoint | null => {
  if (
    !event.location
    || !event.location.lat
    || !event.location.lng
    || event.location.lat === 0
    || event.location.lng === 0
  ) {
    return null;
  }

  return {
    lat: event.location.lat,
    lng: event.location.lng,
  };
};

export const getFlightEndpointPoint = (
  event: Event,
  role: 'departure' | 'arrival',
  weatherSnapshots: WeatherSnapshot[],
): RoutePoint | null => {
  if (event.type !== 'flight') return null;

  const snapshot = weatherSnapshots.find((item) => (
    (item.originalEventId || item.eventId) === event.id
    && item.locationRole === role
    && item.lat
    && item.lng
  ));

  if (!snapshot) return null;

  return {
    lat: snapshot.lat,
    lng: snapshot.lng,
  };
};

const getTransportEndpointRoutePoint = (
  event: Event,
  endpoint: 'departure' | 'arrival',
): RoutePoint | null => {
  if (!isDualEndpointTransportEvent(event)) return null;

  const location = getTransportEndpointLocation(event, endpoint);
  if (!endpointLocationHasCoordinates(location)) return null;

  return {
    lat: location!.lat,
    lng: location!.lng,
  };
};

export const getRoutePoint = (
  event: Event,
  side: 'from' | 'to',
  weatherSnapshots: WeatherSnapshot[] = [],
): RoutePoint | null => {
  if (isDualEndpointTransportEvent(event)) {
    const endpoint = side === 'from' ? 'arrival' : 'departure';
    const storedPoint = getTransportEndpointRoutePoint(event, endpoint);
    if (storedPoint) return storedPoint;

    if (event.type === 'flight') {
      return getFlightEndpointPoint(event, endpoint, weatherSnapshots);
    }

    return null;
  }

  return getUsableEventLocation(event);
};

export const getDistanceKm = (from: RoutePoint, to: RoutePoint): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const estimateTravelMinutes = (distanceKm: number): number => (
  Math.ceil((distanceKm / AVERAGE_URBAN_SPEED_KMH) * 60 + TRANSFER_BUFFER_MINUTES)
);

const isLikelyInternationalFlight = (event: Event): boolean => {
  if (event.type !== 'flight') return false;
  const data = event as Event & { departureAirport?: string; arrivalAirport?: string };
  const departure = data.departureAirport?.trim().toUpperCase();
  const arrival = data.arrivalAirport?.trim().toUpperCase();
  if (!departure || !arrival) return true;
  return departure !== arrival;
};

export const getConnectionTightThresholdMinutes = (arrivalEvent: Event): number => {
  if (arrivalEvent.type === 'flight') {
    return isLikelyInternationalFlight(arrivalEvent)
      ? INTERNATIONAL_CONNECTION_TIGHT_MINUTES
      : DOMESTIC_CONNECTION_TIGHT_MINUTES;
  }

  return DOMESTIC_CONNECTION_TIGHT_MINUTES;
};

const buildTransferSummary = (
  from: Event,
  to: Event,
  fromEnd: Date,
  toStart: Date,
  weatherSnapshots: WeatherSnapshot[],
): TransferSummary | null => {
  const gapMinutes = Math.round((toStart.getTime() - fromEnd.getTime()) / (60 * 1000));
  if (gapMinutes < 0) return null;

  const fromPoint = getRoutePoint(from, 'from', weatherSnapshots);
  const toPoint = getRoutePoint(to, 'to', weatherSnapshots);
  if (!fromPoint || !toPoint) return null;

  const distanceKm = getDistanceKm(fromPoint, toPoint);
  if (distanceKm < MIN_TRANSFER_DISTANCE_KM) return null;

  const estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
  const tightThresholdMinutes = getConnectionTightThresholdMinutes(from);

  let severity: TransferSeverity = 'ok';
  if (gapMinutes < tightThresholdMinutes || gapMinutes < estimatedTravelMinutes) {
    severity = 'tight';
  } else if (
    distanceKm >= LONG_TRANSFER_DISTANCE_KM
    && gapMinutes < estimatedTravelMinutes + LONG_TRANSFER_EXTRA_BUFFER_MINUTES
  ) {
    severity = 'long';
  }

  return {
    from,
    to,
    fromPoint,
    toPoint,
    gapMinutes,
    estimatedTravelMinutes,
    distanceKm,
    distanceMiles: Math.round(distanceKm * 0.621371),
    severity,
    tightThresholdMinutes,
  };
};

export const getTransferSummary = (
  from: Event,
  to: Event,
  weatherSnapshots: WeatherSnapshot[] = [],
): TransferSummary | null => {
  const fromEnd = getEventEnd(from);
  const toStart = getEventStart(to);
  if (!fromEnd || !toStart) return null;

  return buildTransferSummary(from, to, fromEnd, toStart, weatherSnapshots);
};

/** Resolve leg times for multiday stays/rentals on a specific timeline day. */
export const getTimelineDayLegTimes = (
  from: Event,
  to: Event,
  dayKey: string,
): { fromEnd: Date; toStart: Date } | null => {
  if (!dayKey || dayKey === UNSCHEDULED_FILTER_KEY) return null;

  const dayDate = parseTimelineDateKey(dayKey);
  if (!dayDate) return null;

  const toStartRaw = getEventStart(to);
  if (!toStartRaw) return null;

  const fromRole = getMultidayEventDayRole(from, dayKey);
  let fromEnd: Date | null = null;

  if (fromRole === 'middle') {
    fromEnd = startOfDay(dayDate);
  } else if (fromRole === 'start') {
    fromEnd = getEventStart(from) ?? startOfDay(dayDate);
  } else {
    fromEnd = getEventEnd(from);
  }

  if (!fromEnd) return null;

  const toRole = getMultidayEventDayRole(to, dayKey);
  let toStart = toStartRaw;

  if (toRole === 'end') {
    toStart = getEventEnd(to) ?? toStartRaw;
  } else if (toRole === 'middle') {
    toStart = startOfDay(dayDate);
  }

  if (!isSameLocalDay(fromEnd, toStart)) return null;

  return { fromEnd, toStart };
};

/**
 * When the first event on a timeline day isn't preceded by another card in that day's
 * group, look for a same-day predecessor (e.g. overnight flight arriving before check-in).
 */
export const findPreviousItineraryEventForDay = (
  events: Event[],
  current: Event,
  dayKey: string,
): Event | null => {
  if (!dayKey || dayKey === UNSCHEDULED_FILTER_KEY) return null;
  if (!eventOccursOnDayKey(current, dayKey)) return null;

  const currentStart = getEventStart(current);
  if (!currentStart) return null;

  let bestMatch: Event | null = null;
  let bestEndTime = Number.NEGATIVE_INFINITY;

  for (const candidate of events) {
    if (candidate.id === current.id || candidate.status === 'alternative') continue;

    const candidateEnd = getEventEnd(candidate);
    if (!candidateEnd) continue;
    if (!isSameLocalDay(candidateEnd, currentStart)) continue;
    if (candidateEnd.getTime() > currentStart.getTime()) continue;

    if (candidateEnd.getTime() > bestEndTime) {
      bestEndTime = candidateEnd.getTime();
      bestMatch = candidate;
    }
  }

  return bestMatch;
};

/** Effective end time when transferring from an event that may still be active. */
export const getEffectiveEventEndForTransfer = (event: Event, beforeTime: Date): Date | null => {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  if (!start || !end) return null;
  if (start.getTime() >= beforeTime.getTime()) return null;

  if (end.getTime() <= beforeTime.getTime()) {
    return end;
  }

  if (event.type === 'stay' || event.type === 'rental_car') {
    return beforeTime;
  }

  return null;
};

/** Closest itinerary stop before the current event, including prior days. */
export const findClosestPriorItineraryEvent = (events: Event[], current: Event): Event | null => {
  const currentStart = getEventStart(current);
  if (!currentStart) return null;

  let bestMatch: Event | null = null;
  let bestEndTime = Number.NEGATIVE_INFINITY;

  for (const candidate of events) {
    if (candidate.id === current.id || candidate.status === 'alternative') continue;

    const effectiveEnd = getEffectiveEventEndForTransfer(candidate, currentStart);
    if (!effectiveEnd) continue;

    if (effectiveEnd.getTime() > bestEndTime) {
      bestEndTime = effectiveEnd.getTime();
      bestMatch = candidate;
    }
  }

  return bestMatch;
};

export const isTimelinePrimaryEvent = (event: Event, dayKey: string): boolean => {
  const role = getMultidayEventDayRole(event, dayKey);
  return role !== 'middle';
};

/** Sparse days with only a check-in, pickup, or transport anchor. */
export const needsCrossDayInboundLeg = (
  dayEvents: Event[],
  event: Event,
  dayKey: string,
  eventIndex: number,
): boolean => {
  if (eventIndex > 0) return false;

  const primaryEvents = dayEvents.filter((item) => isTimelinePrimaryEvent(item, dayKey));
  const isSparsePrimaryDay = primaryEvents.length === 1 && primaryEvents[0].id === event.id;
  if (!isSparsePrimaryDay) return false;

  if (TRANSPORT_INBOUND_TYPES.has(event.type)) return true;

  const role = getMultidayEventDayRole(event, dayKey);
  return role === 'start'
    || (role === 'single' && (event.type === 'stay' || event.type === 'rental_car'));
};

const resolveTransferLegToStart = (to: Event, viewDayKey: string): Date | null => {
  const dayDate = parseTimelineDateKey(viewDayKey);
  if (!dayDate) return null;

  const toStartRaw = getEventStart(to);
  if (!toStartRaw) return null;

  const toRole = getMultidayEventDayRole(to, viewDayKey);
  if (toRole === 'end') return getEventEnd(to) ?? toStartRaw;
  if (toRole === 'middle') return startOfDay(dayDate);
  return toStartRaw;
};

/** Leg times when the prior stop was on an earlier day. */
export const getCrossDayLegTimes = (
  from: Event,
  to: Event,
  viewDayKey: string,
): { fromEnd: Date; toStart: Date } | null => {
  const toStart = resolveTransferLegToStart(to, viewDayKey);
  if (!toStart) return null;

  const fromEnd = getEffectiveEventEndForTransfer(from, toStart) ?? getEventEnd(from);
  if (!fromEnd || fromEnd.getTime() > toStart.getTime()) return null;

  return { fromEnd, toStart };
};

export interface ResolvedTimelineTransferLeg {
  previousEvent: Event;
  transfer: TransferSummary;
}

/** Resolve a timeline leg from the prior stop, including cross-day inbound anchors. */
export const resolveTimelineTransferLeg = (
  sortedEvents: Event[],
  dayEvents: Event[],
  eventIndex: number,
  event: Event,
  dayKey: string,
  weatherSnapshots: WeatherSnapshot[] = [],
): ResolvedTimelineTransferLeg | null => {
  // No inbound leg to a middle stay/rental day — the traveler is already there.
  const destinationRole = getMultidayEventDayRole(event, dayKey);
  if (destinationRole === 'middle') {
    return null;
  }

  let previousEvent = eventIndex > 0 ? dayEvents[eventIndex - 1] : null;

  if (!previousEvent) {
    previousEvent = findPreviousItineraryEventForDay(sortedEvents, event, dayKey);
  }

  if (previousEvent) {
    const sameDayTransfer = getTimelineDayTransferLeg(
      previousEvent,
      event,
      dayKey,
      weatherSnapshots,
    );
    if (sameDayTransfer) {
      return { previousEvent, transfer: sameDayTransfer };
    }
  }

  if (!needsCrossDayInboundLeg(dayEvents, event, dayKey, eventIndex)) {
    return null;
  }

  previousEvent = findClosestPriorItineraryEvent(sortedEvents, event);
  if (!previousEvent) return null;

  const legTimes = getCrossDayLegTimes(previousEvent, event, dayKey);
  if (!legTimes) return null;

  const transfer = buildTransferSummary(
    previousEvent,
    event,
    legTimes.fromEnd,
    legTimes.toStart,
    weatherSnapshots,
  );

  return transfer ? { previousEvent, transfer } : null;
};

/** Transfer leg between consecutive stops on the same timeline day. */
export const getTimelineDayTransferLeg = (
  from: Event,
  to: Event,
  dayKey: string,
  weatherSnapshots: WeatherSnapshot[] = [],
): TransferSummary | null => {
  const legTimes = getTimelineDayLegTimes(from, to, dayKey);
  if (!legTimes) return null;

  return buildTransferSummary(from, to, legTimes.fromEnd, legTimes.toStart, weatherSnapshots);
};

export const formatTransferLegLabel = (transfer: TransferSummary): string => {
  const distanceLabel = transfer.distanceMiles >= 1
    ? `${transfer.distanceMiles} mi`
    : `${Math.round(transfer.distanceKm * 1000)} m`;

  return `${distanceLabel} · ~${transfer.estimatedTravelMinutes} min`;
};

export const formatCachedDrivingLegLabel = (
  driveDistanceLabel: string,
  driveDurationLabel: string,
): string => `${driveDistanceLabel} · ${driveDurationLabel} drive`;

export const isTransportArrivalEvent = (event: Event): boolean => (
  TRANSPORT_ARRIVAL_TYPES.has(event.type)
);

export const isGroundTransportEvent = (event: Event): boolean => (
  GROUND_TRANSPORT_TYPES.has(event.type)
);

export const getNextScheduledEvent = (events: Event[], afterEvent: Event): Event | null => {
  const sorted = sortEventsByStart(events);
  const afterStart = getEventStart(afterEvent);
  if (!afterStart) return null;

  return sorted.find((candidate) => {
    if (candidate.id === afterEvent.id) return false;
    const start = getEventStart(candidate);
    return !!start && start >= afterStart;
  }) ?? null;
};

export const hasNearbyGroundTransport = (
  events: Event[],
  arrivalEvent: Event,
  lookupHours = 12,
): boolean => {
  const arrivalTime = getEventEnd(arrivalEvent);
  if (!arrivalTime) return false;

  return events.some((event) => {
    if (!isGroundTransportEvent(event) || event.id === arrivalEvent.id) return false;
    const transportStart = getEventStart(event);
    if (!transportStart) return false;

    const hoursAfterArrival = (transportStart.getTime() - arrivalTime.getTime()) / (60 * 60 * 1000);
    return hoursAfterArrival >= -1 && hoursAfterArrival <= lookupHours;
  });
};

export const isSameLocalDay = (left: Date, right: Date): boolean => (
  getDateKey(left) === getDateKey(right)
);

export const getDirectionsUrl = (from: RoutePoint, to: RoutePoint): string => {
  const origin = `${from.lat},${from.lng}`;
  const destination = `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
};
