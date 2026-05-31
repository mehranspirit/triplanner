import { Event } from '@/types/eventTypes';
import {
  isDualEndpointTransportEvent,
  syncTransportLocationsOnSave,
  transportEndpointNeedsReview,
  endpointLocationIsConfirmed,
  locationPointIsConfirmed,
  getTransportEndpointInfo,
  TransportEvent,
} from '@/utils/transportLocation';

const MAP_OPTIONAL_EVENT_TYPES = new Set(['arrival', 'departure', 'flight', 'train', 'bus']);

const getEventData = (event: Event): Record<string, string | undefined> => (
  event as unknown as Record<string, string | undefined>
);

const combineLocationParts = (...parts: (string | undefined)[]): string | undefined => {
  const combined = parts.map((part) => part?.trim()).filter(Boolean).join(' ');
  return combined || undefined;
};

const uniqueLocationQueries = (...candidates: (string | undefined)[]): string[] => {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const trimmed = candidate.trim();
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    queries.push(trimmed);
  }

  return queries;
};

const LOCATION_LABEL_SUFFIX_PATTERN = /\s+(guided tour|private tour|group tour|tour|experience|visit|excursion|activity|adventure|ticket|tickets|entry|day trip|stop|stopover)$/i;

const stripLocationLabelNoise = (label?: string): string | undefined => {
  if (!label?.trim()) return undefined;
  const stripped = label.replace(LOCATION_LABEL_SUFFIX_PATTERN, '').trim();
  return stripped || undefined;
};

const normalizeAirportQuery = (value?: string): string | undefined => {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (/^[A-Z]{3}$/i.test(trimmed)) {
    return `${trimmed.toUpperCase()} Airport`;
  }
  if (!/\bairport\b/i.test(trimmed)) {
    return `${trimmed} Airport`;
  }
  return trimmed;
};

export const getEventLocationQueries = (event: Event): string[] => {
  const data = getEventData(event);

  switch (event.type) {
    case 'stay':
      return uniqueLocationQueries(
        data.address,
        event.location?.address,
        combineLocationParts(data.accommodationName, data.address),
        data.accommodationName,
      );
    case 'destination': {
      const strippedPlaceName = stripLocationLabelNoise(data.placeName);
      return uniqueLocationQueries(
        data.address,
        event.location?.address,
        combineLocationParts(data.placeName, data.address),
        combineLocationParts(strippedPlaceName, data.address),
        strippedPlaceName,
        data.placeName,
      );
    }
    case 'activity': {
      const strippedTitle = stripLocationLabelNoise(data.title);
      return uniqueLocationQueries(
        data.address,
        event.location?.address,
        combineLocationParts(data.title, data.address),
        combineLocationParts(strippedTitle, data.address),
        strippedTitle,
        data.title,
      );
    }
    case 'arrival':
    case 'departure':
      return uniqueLocationQueries(
        normalizeAirportQuery(data.airport),
        data.airport,
      );
    case 'flight':
      return uniqueLocationQueries(
        normalizeAirportQuery(data.departureAirport),
        data.departureAirport,
        normalizeAirportQuery(data.arrivalAirport),
        data.arrivalAirport,
      );
    case 'train':
    case 'bus':
      return uniqueLocationQueries(
        data.departureStation,
        data.arrivalStation,
        combineLocationParts(data.departureStation, data.arrivalStation),
      );
    case 'rental_car':
      return uniqueLocationQueries(
        data.pickupLocation,
        data.dropoffLocation,
        combineLocationParts(data.pickupLocation, data.dropoffLocation),
      );
    default:
      return uniqueLocationQueries(event.location?.address);
  }
};

export const getEventLocationQuery = (event: Event): string | undefined => (
  getEventLocationQueries(event)[0]
);

/** @deprecated Use getEventLocationQueries — kept for callers that expect a single string. */
export const getEventLocationMapSearchQuery = (event: Event): string | undefined => (
  getEventLocationQueries(event)[0]
);

export const eventHasMapCoordinates = (event: Event): boolean => {
  const location = event.location;
  return !!(
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    location.lat !== 0 &&
    location.lng !== 0
  );
};

export const hasPlaceholderLocation = (event: Event): boolean => {
  if (!eventHasMapCoordinates(event)) {
    return true;
  }

  if (locationPointIsConfirmed(event.location)) {
    return false;
  }

  const quality = event.location?.quality;
  return quality === 'missing' || quality === 'unresolved' || quality === 'inferred';
};

export const eventNeedsMapLocation = (event: Event): boolean => {
  if (MAP_OPTIONAL_EVENT_TYPES.has(event.type)) {
    return false;
  }

  return hasPlaceholderLocation(event);
};

export const eventHasLocationAttention = (event: Event): boolean => {
  if (isDualEndpointTransportEvent(event)) {
    return transportEndpointNeedsReview(event, 'departure')
      || transportEndpointNeedsReview(event, 'arrival');
  }

  return eventNeedsMapLocation(event);
};

export const eventNeedsGeocodeRetry = (event: Event): boolean => {
  if (isDualEndpointTransportEvent(event)) {
    return transportEndpointNeedsReview(event, 'departure')
      || transportEndpointNeedsReview(event, 'arrival');
  }

  const queries = getEventLocationQueries(event);
  if (queries.length === 0) {
    return false;
  }

  if (eventHasMapCoordinates(event) && locationPointIsConfirmed(event.location)) {
    return false;
  }

  if (!eventHasMapCoordinates(event)) {
    return true;
  }

  const quality = event.location?.quality;
  return quality === 'inferred' || quality === 'unresolved' || !quality;
};

export const orderGeocodeQueries = (queries: string[], storedQuery?: string): string[] => {
  if (!storedQuery?.trim()) {
    return queries;
  }

  const normalizedStored = storedQuery.trim().toLowerCase();
  const matched = queries.filter((query) => query.trim().toLowerCase() === normalizedStored);
  const remaining = queries.filter((query) => query.trim().toLowerCase() !== normalizedStored);
  return [...matched, ...remaining];
};

export const EXACT_GEOCODE_CONFIDENCE = 0.8;

export const scoreGeocodeConfidence = (confidence: number): number => {
  const normalized = Number(confidence) || 0;
  return normalized >= EXACT_GEOCODE_CONFIDENCE ? 1000 + normalized : normalized;
};

export const getGeocodeQualityFromConfidence = (confidence: number): 'exact' | 'inferred' => (
  confidence >= EXACT_GEOCODE_CONFIDENCE ? 'exact' : 'inferred'
);

export type GoogleMapsEndpoint = 'departure' | 'arrival' | 'pickup' | 'dropoff';

export interface GoogleMapsSearchOptions {
  endpoint?: GoogleMapsEndpoint;
  query?: string;
}

const normalizeQueryKey = (query: string) => query.trim().toLowerCase();

const getEndpointRawQuery = (event: Event, endpoint: GoogleMapsEndpoint): string | undefined => {
  const data = getEventData(event);

  switch (event.type) {
    case 'flight':
      return endpoint === 'departure' ? data.departureAirport : data.arrivalAirport;
    case 'train':
    case 'bus':
      return endpoint === 'departure' ? data.departureStation : data.arrivalStation;
    case 'rental_car':
      return endpoint === 'pickup' ? data.pickupLocation : data.dropoffLocation;
    case 'arrival':
    case 'departure':
      return data.airport;
    default:
      return undefined;
  }
};

const enrichTransportMapsQuery = (event: Event, rawQuery: string): string => {
  const trimmed = rawQuery.trim();
  if (!trimmed) return trimmed;

  if (event.type === 'flight' || event.type === 'arrival' || event.type === 'departure') {
    return normalizeAirportQuery(trimmed) || trimmed;
  }

  if (event.type === 'train' && !/\btrain station\b/i.test(trimmed)) {
    return `${trimmed} train station`;
  }

  return trimmed;
};

const queriesMatchStoredLocation = (event: Event, candidateQueries: string[]): boolean => {
  const stored = event.location?.query?.trim();
  if (!stored) return false;

  const normalizedStored = normalizeQueryKey(stored);
  return candidateQueries.some((query) => normalizeQueryKey(query) === normalizedStored);
};

const buildGoogleMapsQueryParam = (event: Event, options?: GoogleMapsSearchOptions): string | null => {
  const explicitQuery = options?.query?.trim();
  const endpoint = options?.endpoint;

  if (explicitQuery || endpoint) {
    const rawQuery = explicitQuery || getEndpointRawQuery(event, endpoint!);
    if (!rawQuery) return null;

    const enrichedQuery = enrichTransportMapsQuery(event, rawQuery);
    const candidateQueries = uniqueLocationQueries(rawQuery, enrichedQuery);

    if (queriesMatchStoredLocation(event, candidateQueries) && eventHasMapCoordinates(event)) {
      return `${event.location!.lat},${event.location!.lng}`;
    }

    const matchedFallback = getEventLocationQueries(event).find((query) => (
      candidateQueries.some((candidate) => normalizeQueryKey(candidate) === normalizeQueryKey(query))
    ));

    return matchedFallback || enrichedQuery;
  }

  if (eventHasMapCoordinates(event)) {
    return `${event.location!.lat},${event.location!.lng}`;
  }

  const geocodedAddress = event.location?.address?.trim();
  if (geocodedAddress) {
    return geocodedAddress;
  }

  return getEventLocationQueries(event)[0] || null;
};

export const getGoogleMapsSearchUrl = (
  event: Event,
  options?: GoogleMapsSearchOptions,
): string | null => {
  const queryParam = buildGoogleMapsQueryParam(event, options);
  if (!queryParam) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParam)}`;
};

export const openEventInGoogleMaps = (event: Event, options?: GoogleMapsSearchOptions): void => {
  const url = getGoogleMapsSearchUrl(event, options);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export const eventHasGoogleMapsLocation = (
  event: Event,
  options?: GoogleMapsSearchOptions,
): boolean => getGoogleMapsSearchUrl(event, options) !== null;

export const syncEventLocationOnSave = <T extends Event>(
  event: T,
  previousEvent?: Event | null
): T => {
  if (isDualEndpointTransportEvent(event)) {
    const previousTransport = previousEvent && isDualEndpointTransportEvent(previousEvent)
      ? previousEvent
      : null;
    return syncTransportLocationsOnSave(event, previousTransport) as T;
  }

  const label = getEventLocationQuery(event);
  if (!label) {
    return event;
  }

  const existing = event.location ?? { lat: 0, lng: 0 };
  const previousLabel = previousEvent ? getEventLocationQuery(previousEvent) : undefined;
  const locationQueryChanged = previousEvent ? label !== previousLabel : false;
  const hasCoords = eventHasMapCoordinates(event);

  if (locationQueryChanged || !hasCoords) {
    return {
      ...event,
      location: {
        ...existing,
        address: label,
        lat: locationQueryChanged ? 0 : existing.lat ?? 0,
        lng: locationQueryChanged ? 0 : existing.lng ?? 0,
        quality: 'unresolved',
        source: 'manual',
      },
    };
  }

  return {
    ...event,
    location: {
      ...existing,
      address: label,
      quality: existing.quality ?? 'unresolved',
      source: existing.source || 'manual',
    },
  };
};

const getLocationFieldValues = (event: Event): Record<string, string | undefined> => {
  const data = getEventData(event);

  switch (event.type) {
    case 'activity':
      return { title: data.title, address: data.address };
    case 'stay':
      return { accommodationName: data.accommodationName, address: data.address };
    case 'destination':
      return { placeName: data.placeName, address: data.address };
    case 'arrival':
    case 'departure':
      return { airport: data.airport };
    case 'flight':
      return {
        departureAirport: data.departureAirport,
        arrivalAirport: data.arrivalAirport,
      };
    case 'train':
    case 'bus':
      return {
        departureStation: data.departureStation,
        arrivalStation: data.arrivalStation,
      };
    case 'rental_car':
      return {
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
      };
    default:
      return {
        address: event.location?.address,
        lat: event.location?.lat !== undefined ? String(event.location.lat) : undefined,
        lng: event.location?.lng !== undefined ? String(event.location.lng) : undefined,
      };
  }
};

export const locationFieldsChanged = (
  event: Event,
  previousEvent?: Event | null,
): boolean => {
  if (!previousEvent) {
    return true;
  }

  const current = getLocationFieldValues(event);
  const previous = getLocationFieldValues(previousEvent);
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);

  for (const key of keys) {
    const currentValue = (current[key] || '').trim();
    const previousValue = (previous[key] || '').trim();
    if (currentValue !== previousValue) {
      return true;
    }
  }

  const currentLat = event.location?.lat;
  const currentLng = event.location?.lng;
  const previousLat = previousEvent.location?.lat;
  const previousLng = previousEvent.location?.lng;

  return currentLat !== previousLat || currentLng !== previousLng;
};

export const eventHasManualGoogleLocation = (event: Event): boolean => (
  event.location?.source === 'google_places'
  && eventHasMapCoordinates(event)
  && (event.location?.quality === 'exact' || !event.location?.quality)
);

export const transportLocationsManuallyConfirmed = (event: Event): boolean => {
  if (!isDualEndpointTransportEvent(event)) {
    return false;
  }

  const transportEvent = event as TransportEvent;
  const info = getTransportEndpointInfo(event);
  const hasDepartureQuery = !!info.departureQuery?.trim();
  const hasArrivalQuery = !!info.arrivalQuery?.trim();

  if (!hasDepartureQuery && !hasArrivalQuery) {
    return false;
  }

  if (hasDepartureQuery) {
    if (transportEvent.departureLocation?.source !== 'google_places') {
      return false;
    }
    if (!endpointLocationIsConfirmed(transportEvent.departureLocation)) {
      return false;
    }
  }

  if (hasArrivalQuery) {
    if (transportEvent.arrivalLocation?.source !== 'google_places') {
      return false;
    }
    if (!endpointLocationIsConfirmed(transportEvent.arrivalLocation)) {
      return false;
    }
  }

  return true;
};

export const eventNeedsLocationConfirmation = (
  event: Event,
  previousEvent?: Event | null,
): boolean => {
  if (isDualEndpointTransportEvent(event)) {
    if (!locationFieldsChanged(event, previousEvent)) {
      return false;
    }
    if (transportLocationsManuallyConfirmed(event)) {
      return false;
    }
    return transportEndpointNeedsReview(event, 'departure')
      || transportEndpointNeedsReview(event, 'arrival');
  }

  if (eventHasManualGoogleLocation(event)) {
    return false;
  }

  if (!locationFieldsChanged(event, previousEvent)) {
    return false;
  }

  return getEventLocationQueries(event).length > 0;
};

const MAP_PROGRESS_EVENT_TYPES = new Set([
  'activity',
  'stay',
  'destination',
  'rental_car',
  'flight',
  'train',
  'bus',
]);

export interface TripMapLocationProgress {
  geocoded: number;
  total: number;
  isComplete: boolean;
}

/** Count geocoded vs mappable itinerary events for toolbar progress chip. */
export const getTripMapLocationProgress = (events: Event[]): TripMapLocationProgress => {
  const mappableEvents = events.filter(
    (event) => event.status !== 'alternative' && MAP_PROGRESS_EVENT_TYPES.has(event.type),
  );
  const geocoded = mappableEvents.filter(eventHasMapCoordinates).length;

  return {
    geocoded,
    total: mappableEvents.length,
    isComplete: mappableEvents.length === 0 || geocoded === mappableEvents.length,
  };
};
