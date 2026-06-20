import { Event, Trip } from '@/types/eventTypes';
import { ALL_DAYS_FILTER_KEY, getEventTimelineDateKeys } from '@/utils/timelineDates';

const hasCoordinates = (event: Event): event is Event & { location: { lat: number; lng: number } } => (
  typeof event.location?.lat === 'number'
  && typeof event.location?.lng === 'number'
  && !(event.location.lat === 0 && event.location.lng === 0)
);

const biasFromEvent = (event: Event) => (
  hasCoordinates(event)
    ? { lat: event.location.lat, lng: event.location.lng }
    : undefined
);

const preferAnchorEvents = (events: Event[]) => (
  events.filter((event) => event.type === 'stay' || event.type === 'destination')
);

export const resolveTripLocationBias = (
  trip: Trip,
  activeDayKey: string = ALL_DAYS_FILTER_KEY,
): { lat: number; lng: number } | undefined => {
  if (trip.location?.lat != null && trip.location?.lng != null) {
    return { lat: trip.location.lat, lng: trip.location.lng };
  }

  const anchorEvents = preferAnchorEvents(trip.events);

  if (activeDayKey && activeDayKey !== ALL_DAYS_FILTER_KEY) {
    const onActiveDay = anchorEvents.find((event) => (
      getEventTimelineDateKeys(event).includes(activeDayKey) && hasCoordinates(event)
    ));
    const dayBias = onActiveDay ? biasFromEvent(onActiveDay) : undefined;
    if (dayBias) return dayBias;
  }

  const stayWithCoords = trip.events.find(
    (event) => event.type === 'stay' && hasCoordinates(event),
  );
  const stayBias = stayWithCoords ? biasFromEvent(stayWithCoords) : undefined;
  if (stayBias) return stayBias;

  const destinationWithCoords = anchorEvents.find(hasCoordinates);
  const destinationBias = destinationWithCoords ? biasFromEvent(destinationWithCoords) : undefined;
  if (destinationBias) return destinationBias;

  const anyWithCoords = trip.events.find(hasCoordinates);
  return anyWithCoords ? biasFromEvent(anyWithCoords) : undefined;
};

export const resolveDefaultPlaceEventDate = (
  trip: Trip,
  activeDayKey: string = ALL_DAYS_FILTER_KEY,
): string => {
  if (activeDayKey && activeDayKey !== ALL_DAYS_FILTER_KEY) {
    return activeDayKey;
  }

  const today = new Date().toISOString().slice(0, 10);
  const tripStart = trip.startDate?.slice(0, 10) || today;
  const tripEnd = trip.endDate?.slice(0, 10) || tripStart;

  if (today >= tripStart && today <= tripEnd) {
    return today;
  }

  return tripStart;
};
