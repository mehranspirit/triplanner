import { Event } from '@/types/eventTypes';
import { getEventLocationLabel } from '@/utils/eventTime';

const MAP_OPTIONAL_EVENT_TYPES = new Set(['arrival', 'departure', 'flight', 'train', 'bus']);

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
  return quality === 'missing' || quality === 'unresolved';
};

export const eventNeedsMapLocation = (event: Event): boolean => {
  if (MAP_OPTIONAL_EVENT_TYPES.has(event.type)) {
    return false;
  }

  return hasPlaceholderLocation(event);
};

export const eventHasLocationAttention = (event: Event): boolean => {
  if (MAP_OPTIONAL_EVENT_TYPES.has(event.type)) {
    return false;
  }

  if (eventNeedsMapLocation(event)) {
    return true;
  }

  return event.location?.quality === 'inferred';
};

export const syncEventLocationOnSave = <T extends Event>(
  event: T,
  previousEvent?: Event | null
): T => {
  const label = getEventLocationLabel(event);
  if (!label) {
    return event;
  }

  const existing = event.location ?? { lat: 0, lng: 0 };
  const previousLabel = previousEvent ? getEventLocationLabel(previousEvent) : undefined;
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
