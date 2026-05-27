import { Event, EventType } from '@/types/eventTypes';

export type EventLocationPoint = NonNullable<Event['location']>;

export const TRANSPORT_DUAL_ENDPOINT_TYPES = new Set<EventType>([
  'flight',
  'train',
  'bus',
  'rental_car',
]);

export interface TransportEndpointInfo {
  departureLabel: string;
  arrivalLabel: string;
  departureQuery?: string;
  arrivalQuery?: string;
}

export interface TransportEvent extends Event {
  departureLocation?: EventLocationPoint;
  arrivalLocation?: EventLocationPoint;
}

export const isDualEndpointTransportEvent = (event: Event): event is TransportEvent => (
  TRANSPORT_DUAL_ENDPOINT_TYPES.has(event.type)
);

const getEventData = (event: Event): Record<string, string | undefined> => (
  event as unknown as Record<string, string | undefined>
);

export const getTransportEndpointInfo = (event: Event): TransportEndpointInfo => {
  const data = getEventData(event);

  switch (event.type) {
    case 'flight':
      return {
        departureLabel: 'Departure airport',
        arrivalLabel: 'Arrival airport',
        departureQuery: data.departureAirport,
        arrivalQuery: data.arrivalAirport,
      };
    case 'train':
    case 'bus':
      return {
        departureLabel: 'Departure station',
        arrivalLabel: 'Arrival station',
        departureQuery: data.departureStation,
        arrivalQuery: data.arrivalStation,
      };
    case 'rental_car':
      return {
        departureLabel: 'Pickup location',
        arrivalLabel: 'Drop-off location',
        departureQuery: data.pickupLocation,
        arrivalQuery: data.dropoffLocation,
      };
    default:
      return {
        departureLabel: 'Departure',
        arrivalLabel: 'Arrival',
      };
  }
};

export const getTransportEndpointQueries = (
  event: Event,
  endpoint: 'departure' | 'arrival',
): string[] => {
  const info = getTransportEndpointInfo(event);
  const rawQuery = endpoint === 'departure' ? info.departureQuery : info.arrivalQuery;
  if (!rawQuery?.trim()) {
    return [];
  }

  const trimmed = rawQuery.trim();
  if (event.type === 'flight') {
    const normalized = /^[A-Z]{3}$/i.test(trimmed)
      ? `${trimmed.toUpperCase()} Airport`
      : /\bairport\b/i.test(trimmed)
        ? trimmed
        : `${trimmed} Airport`;
    return [normalized, trimmed].filter((query, index, list) => (
      list.indexOf(query) === index
    ));
  }

  if (event.type === 'train' && !/\btrain station\b/i.test(trimmed)) {
    return [`${trimmed} train station`, trimmed];
  }

  return [trimmed];
};

export const endpointLocationHasCoordinates = (location?: EventLocationPoint): boolean => (
  !!location
  && typeof location.lat === 'number'
  && typeof location.lng === 'number'
  && location.lat !== 0
  && location.lng !== 0
);

export const locationPointIsConfirmed = (location?: EventLocationPoint): boolean => {
  if (!endpointLocationHasCoordinates(location)) {
    return false;
  }

  if (location?.source === 'google_places' || location?.source === 'geocoded') {
    return true;
  }

  if (location?.confirmedAt) {
    return true;
  }

  return location?.quality === 'exact';
};

export const endpointLocationIsConfirmed = (location?: EventLocationPoint): boolean => (
  locationPointIsConfirmed(location)
);

export const getTransportEndpointLocation = (
  event: Event,
  endpoint: 'departure' | 'arrival',
): EventLocationPoint | undefined => {
  if (!isDualEndpointTransportEvent(event)) {
    return undefined;
  }

  return endpoint === 'departure'
    ? event.departureLocation
    : event.arrivalLocation;
};

export const transportEndpointNeedsReview = (
  event: Event,
  endpoint: 'departure' | 'arrival',
): boolean => {
  const queries = getTransportEndpointQueries(event, endpoint);
  if (queries.length === 0) {
    return false;
  }

  return !endpointLocationIsConfirmed(getTransportEndpointLocation(event, endpoint));
};

export const createUnresolvedEndpointLocation = (
  query: string,
): EventLocationPoint => ({
  lat: 0,
  lng: 0,
  address: query,
  quality: 'unresolved',
  source: 'manual',
});

export const syncTransportLocationsOnSave = <T extends TransportEvent>(
  event: T,
  previousEvent?: TransportEvent | null,
): T => {
  const info = getTransportEndpointInfo(event);
  const previousInfo = previousEvent ? getTransportEndpointInfo(previousEvent) : null;
  const isNewEvent = !previousEvent;

  const departureChanged = isNewEvent
    || (info.departureQuery || '').trim() !== (previousInfo?.departureQuery || '').trim();
  const arrivalChanged = isNewEvent
    || (info.arrivalQuery || '').trim() !== (previousInfo?.arrivalQuery || '').trim();

  let departureLocation = event.departureLocation;
  let arrivalLocation = event.arrivalLocation;

  if (info.departureQuery?.trim()) {
    if (departureChanged || !endpointLocationHasCoordinates(departureLocation)) {
      departureLocation = createUnresolvedEndpointLocation(info.departureQuery.trim());
    }
  }

  if (info.arrivalQuery?.trim()) {
    if (arrivalChanged || !endpointLocationHasCoordinates(arrivalLocation)) {
      arrivalLocation = createUnresolvedEndpointLocation(info.arrivalQuery.trim());
    }
  }

  return {
    ...event,
    departureLocation,
    arrivalLocation,
  };
};
