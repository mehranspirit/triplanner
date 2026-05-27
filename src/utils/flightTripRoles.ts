import { Event } from '@/types/eventTypes';
import {
  getEventEnd,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';
import { getNextScheduledEvent } from '@/utils/transferAnalysis';

/** Max hours between flights to treat as a connection rather than a destination arrival. */
export const FLIGHT_CONNECTION_MAX_HOURS = 18;

export type FlightTripLeg =
  | 'outbound'
  | 'return'
  | 'connection'
  | 'internal'
  | 'unknown';

export interface FlightEndpointAirports {
  departure?: string;
  arrival?: string;
}

export interface FlightRoleContext {
  leg: FlightTripLeg;
  needsArrivalGroundTransport: boolean;
  needsDepartureGroundTransport: boolean;
  pairedFlightId?: string;
  label: string;
}

const FLIGHT_LIKE_TYPES = new Set(['flight', 'arrival', 'departure']);

export const isFlightLikeEvent = (event: Event): boolean => FLIGHT_LIKE_TYPES.has(event.type);

export const getFlightEndpointAirports = (event: Event): FlightEndpointAirports => {
  const data = event as Event & {
    departureAirport?: string;
    arrivalAirport?: string;
    airport?: string;
  };

  if (event.type === 'arrival') {
    return { arrival: data.airport?.trim().toUpperCase() };
  }

  if (event.type === 'departure') {
    return { departure: data.airport?.trim().toUpperCase() };
  }

  return {
    departure: data.departureAirport?.trim().toUpperCase(),
    arrival: data.arrivalAirport?.trim().toUpperCase(),
  };
};

const airportsMatch = (left?: string, right?: string): boolean => (
  !!left && !!right && left === right
);

export const isRoundTripPair = (earlier: Event, later: Event): boolean => {
  if (earlier.type !== 'flight' || later.type !== 'flight') return false;
  const first = getFlightEndpointAirports(earlier);
  const second = getFlightEndpointAirports(later);
  return airportsMatch(first.departure, second.arrival)
    && airportsMatch(first.arrival, second.departure);
};

const getHoursBetween = (from: Date, to: Date): number => (
  (to.getTime() - from.getTime()) / (60 * 60 * 1000)
);

export const isFlightConnectionGap = (arrivalEvent: Event, nextEvent: Event): boolean => {
  if (!isFlightLikeEvent(nextEvent)) return false;

  const arrivalTime = getEventEnd(arrivalEvent);
  const nextStart = getEventStart(nextEvent);
  if (!arrivalTime || !nextStart) return false;

  const gapHours = getHoursBetween(arrivalTime, nextStart);
  return gapHours >= 0 && gapHours <= FLIGHT_CONNECTION_MAX_HOURS;
};

const getPreviousScheduledEvent = (events: Event[], beforeEvent: Event): Event | null => {
  const sorted = sortEventsByStart(events);
  const beforeStart = getEventStart(beforeEvent);
  if (!beforeStart) return null;

  let previous: Event | null = null;
  sorted.forEach((candidate) => {
    if (candidate.id === beforeEvent.id) return;
    const start = getEventStart(candidate);
    if (!start || start > beforeStart) return;
    if (!previous) {
      previous = candidate;
      return;
    }
    const previousStart = getEventStart(previous);
    if (previousStart && start > previousStart) {
      previous = candidate;
    }
  });

  return previous;
};

const findRoundTripPairs = (flights: Event[]): Map<string, string> => {
  const pairs = new Map<string, string>();
  if (flights.length < 2) return pairs;

  const sorted = sortEventsByStart(flights);
  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = sorted.length - 1; right > left; right -= 1) {
      if (!isRoundTripPair(sorted[left], sorted[right])) continue;
      pairs.set(sorted[left].id, sorted[right].id);
      pairs.set(sorted[right].id, sorted[left].id);
      break;
    }
    if (pairs.has(sorted[left].id)) break;
  }

  return pairs;
};

const buildLegLabel = (leg: FlightTripLeg): string => {
  switch (leg) {
    case 'outbound':
      return 'Outbound to trip';
    case 'return':
      return 'Return home';
    case 'connection':
      return 'Connecting flight';
    case 'internal':
      return 'In-trip flight';
    default:
      return 'Flight';
  }
};

const defaultNeedsForLeg = (leg: FlightTripLeg): Pick<FlightRoleContext, 'needsArrivalGroundTransport' | 'needsDepartureGroundTransport'> => {
  switch (leg) {
    case 'outbound':
      return { needsArrivalGroundTransport: true, needsDepartureGroundTransport: false };
    case 'return':
      return { needsArrivalGroundTransport: false, needsDepartureGroundTransport: true };
    case 'connection':
      return { needsArrivalGroundTransport: false, needsDepartureGroundTransport: false };
    case 'internal':
      return { needsArrivalGroundTransport: true, needsDepartureGroundTransport: false };
    default:
      return { needsArrivalGroundTransport: true, needsDepartureGroundTransport: false };
  }
};

export const buildFlightRoleMap = (events: Event[]): Map<string, FlightRoleContext> => {
  const roles = new Map<string, FlightRoleContext>();
  const flights = sortEventsByStart(events.filter((event) => event.type === 'flight'));
  const pairs = findRoundTripPairs(flights);
  const firstFlightId = flights[0]?.id;
  const lastFlightId = flights[flights.length - 1]?.id;

  flights.forEach((flight, index) => {
    const pairedFlightId = pairs.get(flight.id);
    const nextEvent = getNextScheduledEvent(events, flight);
    const previousEvent = getPreviousScheduledEvent(events, flight);

    let leg: FlightTripLeg = 'unknown';

    if (nextEvent && isFlightConnectionGap(flight, nextEvent)) {
      leg = 'connection';
    } else if (
      previousEvent
      && isFlightLikeEvent(previousEvent)
      && isFlightConnectionGap(previousEvent, flight)
    ) {
      leg = flight.id === lastFlightId ? 'outbound' : 'internal';
    } else if (pairedFlightId) {
      leg = flight.id === firstFlightId || index < flights.findIndex((item) => item.id === pairedFlightId)
        ? 'outbound'
        : 'return';
    } else if (flight.id === firstFlightId && flights.length === 1) {
      leg = 'outbound';
    } else if (flight.id === firstFlightId) {
      leg = 'outbound';
    } else if (flight.id === lastFlightId) {
      leg = 'return';
    } else {
      leg = 'internal';
    }

    const needs = defaultNeedsForLeg(leg);
    roles.set(flight.id, {
      leg,
      ...needs,
      pairedFlightId,
      label: buildLegLabel(leg),
    });
  });

  events.forEach((event) => {
    if (event.type === 'arrival') {
      roles.set(event.id, {
        leg: 'outbound',
        needsArrivalGroundTransport: true,
        needsDepartureGroundTransport: false,
        label: buildLegLabel('outbound'),
      });
    }

    if (event.type === 'departure') {
      roles.set(event.id, {
        leg: 'return',
        needsArrivalGroundTransport: false,
        needsDepartureGroundTransport: true,
        label: buildLegLabel('return'),
      });
    }
  });

  return roles;
};

export const getFlightRole = (
  event: Event,
  events: Event[],
  roleMap: Map<string, FlightRoleContext> = buildFlightRoleMap(events),
): FlightRoleContext | null => roleMap.get(event.id) ?? null;

export const shouldCheckArrivalGroundTransport = (
  event: Event,
  events: Event[],
  roleMap: Map<string, FlightRoleContext> = buildFlightRoleMap(events),
): boolean => {
  if (event.type === 'arrival') return true;
  if (event.type !== 'flight') return false;

  const nextEvent = getNextScheduledEvent(events, event);
  if (nextEvent && isFlightLikeEvent(nextEvent) && isFlightConnectionGap(event, nextEvent)) {
    return false;
  }

  const role = roleMap.get(event.id);
  if (role?.leg === 'return') return false;

  return true;
};

export const shouldCheckDepartureGroundTransport = (
  event: Event,
  roleMap: Map<string, FlightRoleContext> = buildFlightRoleMap([event]),
): boolean => {
  if (event.type === 'departure') return true;
  if (event.type !== 'flight') return false;
  return roleMap.get(event.id)?.needsDepartureGroundTransport ?? false;
};

export const getArrivalGroundTransportReason = (event: Event, role: FlightRoleContext | null): string => {
  const name = event.type === 'flight'
    ? `Flight${role?.leg === 'outbound' ? ' to your trip' : ''}`
    : 'Arrival';

  if (role?.leg === 'internal') {
    return `${name} lands without a nearby rental, train, or bus connection.`;
  }

  return `${name} arrives at your destination without planned ground transport.`;
};

export const getDepartureGroundTransportReason = (event: Event, role: FlightRoleContext | null): string => {
  if (role?.leg === 'return') {
    return 'Return flight departs without planned transport to the airport.';
  }
  return 'Departure flight leaves without planned transport to the airport.';
};
