import { Event } from '@/types/eventTypes';

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
    case 'destination':
      return uniqueLocationQueries(
        data.address,
        event.location?.address,
        combineLocationParts(data.placeName, data.address),
        data.placeName,
      );
    case 'activity':
      return uniqueLocationQueries(
        data.address,
        event.location?.address,
        combineLocationParts(data.title, data.address),
        data.title,
      );
    case 'arrival':
    case 'departure':
      return uniqueLocationQueries(data.airport);
    case 'flight':
      return uniqueLocationQueries(data.departureAirport, data.arrivalAirport);
    case 'train':
    case 'bus':
      return uniqueLocationQueries(data.departureStation, data.arrivalStation);
    case 'rental_car':
      return uniqueLocationQueries(data.pickupLocation, data.dropoffLocation);
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

  const quality = event.location?.quality;
  return quality === 'missing' || quality === 'unresolved' || quality === 'inferred';
};

export const eventNeedsMapLocation = (event: Event): boolean => {
  if (MAP_OPTIONAL_EVENT_TYPES.has(event.type)) {
    return false;
  }

  return hasPlaceholderLocation(event);
};

export const eventHasLocationAttention = (event: Event): boolean => (
  eventNeedsMapLocation(event)
);

export const eventNeedsGeocodeRetry = (event: Event): boolean => {
  const queries = getEventLocationQueries(event);
  if (queries.length === 0) {
    return false;
  }

  if (eventHasMapCoordinates(event) && event.location?.quality === 'exact') {
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

export const syncEventLocationOnSave = <T extends Event>(
  event: T,
  previousEvent?: Event | null
): T => {
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
      quality:
        existing.quality === 'missing' || existing.quality === 'unresolved'
          ? 'exact'
          : existing.quality,
      source: existing.source || 'manual',
    },
  };
};
