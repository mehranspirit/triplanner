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
import { UNSCHEDULED_FILTER_KEY, getMultidayEventDayRole } from '@/utils/timelineDates';
import {
  AVERAGE_URBAN_SPEED_KMH,
  DOMESTIC_CONNECTION_TIGHT_MINUTES,
  INTERNATIONAL_CONNECTION_TIGHT_MINUTES,
  LONG_TRANSFER_DISTANCE_KM,
  LONG_TRANSFER_EXTRA_BUFFER_MINUTES,
  MIN_TRANSFER_DISTANCE_KM,
  TRANSFER_BUFFER_MINUTES,
} from '@/constants/tripHealthThresholds';
import {
  findClosestPriorItineraryEvent as findClosestPriorItineraryEventShared,
  findPreviousItineraryEventForDay as findPreviousItineraryEventForDayShared,
  getCrossDayLegTimes,
  getEffectiveEventEndForTransfer,
  getTimelineDayLegTimes,
  isFlexibleOutboundMultidayLeg,
  isTimelinePrimaryEvent,
  needsCrossDayInboundLeg,
  resolvePreviousTimelineEvent,
  shouldSkipInboundTimelineLeg,
} from '@/utils/timelineTransferLegLogic';

export {
  getCrossDayLegTimes,
  getEffectiveEventEndForTransfer,
  getTimelineDayLegTimes,
  isFlexibleOutboundMultidayLeg,
  isTimelinePrimaryEvent,
  needsCrossDayInboundLeg,
};

export const findPreviousItineraryEventForDay = (
  events: Event[],
  current: Event,
  dayKey: string,
) => {
  if (!dayKey || dayKey === UNSCHEDULED_FILTER_KEY) return null;
  return findPreviousItineraryEventForDayShared(events, current, dayKey);
};

export const findClosestPriorItineraryEvent = findClosestPriorItineraryEventShared;

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
  /** Middle-day hotel/car departures have flexible timing — skip schedule severity. */
  flexibleDeparture?: boolean;
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

/** Day-aware route points for multiday rental pickup vs drop-off days. */
export const getTimelineRoutePoint = (
  event: Event,
  side: 'from' | 'to',
  dayKey: string,
  weatherSnapshots: WeatherSnapshot[] = [],
): RoutePoint | null => {
  const role = getMultidayEventDayRole(event, dayKey);

  if (event.type === 'rental_car' && role === 'end' && side === 'to') {
    return getTransportEndpointRoutePoint(event, 'arrival')
      ?? getRoutePoint(event, side, weatherSnapshots);
  }

  if (event.type === 'rental_car' && role === 'start' && side === 'from') {
    return getTransportEndpointRoutePoint(event, 'departure')
      ?? getRoutePoint(event, side, weatherSnapshots);
  }

  return getRoutePoint(event, side, weatherSnapshots);
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
  weatherSnapshots: WeatherSnapshot[] = [],
  flexibleDeparture = false,
  dayKey?: string,
): TransferSummary | null => {
  const gapMinutes = Math.round((toStart.getTime() - fromEnd.getTime()) / (60 * 1000));
  if (gapMinutes < 0) return null;

  const resolvePoint = dayKey
    ? (event: Event, side: 'from' | 'to') => getTimelineRoutePoint(event, side, dayKey, weatherSnapshots)
    : (event: Event, side: 'from' | 'to') => getRoutePoint(event, side, weatherSnapshots);

  const fromPoint = resolvePoint(from, 'from');
  const toPoint = resolvePoint(to, 'to');
  if (!fromPoint || !toPoint) return null;

  const distanceKm = getDistanceKm(fromPoint, toPoint);
  if (distanceKm < MIN_TRANSFER_DISTANCE_KM) return null;

  const estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
  const tightThresholdMinutes = getConnectionTightThresholdMinutes(from);

  let severity: TransferSeverity = 'ok';
  if (!flexibleDeparture) {
    if (gapMinutes < tightThresholdMinutes || gapMinutes < estimatedTravelMinutes) {
      severity = 'tight';
    } else if (
      distanceKm >= LONG_TRANSFER_DISTANCE_KM
      && gapMinutes < estimatedTravelMinutes + LONG_TRANSFER_EXTRA_BUFFER_MINUTES
    ) {
      severity = 'long';
    }
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
    flexibleDeparture,
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

export interface ResolvedTimelineTransferLeg {
  previousEvent: Event;
  transfer: TransferSummary;
};

/** Resolve a timeline leg from the prior stop, including cross-day inbound anchors. */
export const resolveTimelineTransferLeg = (
  sortedEvents: Event[],
  dayEvents: Event[],
  eventIndex: number,
  event: Event,
  dayKey: string,
  weatherSnapshots: WeatherSnapshot[] = [],
): ResolvedTimelineTransferLeg | null => {
  if (!dayKey || dayKey === UNSCHEDULED_FILTER_KEY) return null;
  if (shouldSkipInboundTimelineLeg(event, dayKey)) return null;

  const resolved = resolvePreviousTimelineEvent(
    sortedEvents,
    dayEvents,
    eventIndex,
    event,
    dayKey,
  );
  if (!resolved) return null;

  const { previousEvent, legTimes } = resolved;
  const transfer = buildTransferSummary(
    previousEvent,
    event,
    legTimes.fromEnd,
    legTimes.toStart,
    weatherSnapshots,
    legTimes.flexibleDeparture,
    dayKey,
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
  if (!dayKey || dayKey === UNSCHEDULED_FILTER_KEY) return null;

  const legTimes = getTimelineDayLegTimes(from, to, dayKey);
  if (!legTimes) return null;

  return buildTransferSummary(
    from,
    to,
    legTimes.fromEnd,
    legTimes.toStart,
    weatherSnapshots,
    legTimes.flexibleDeparture,
    dayKey,
  );
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
