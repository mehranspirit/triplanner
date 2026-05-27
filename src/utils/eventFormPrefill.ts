import { Event, EventType } from '@/types/eventTypes';
import { extractDatePart, getEventEnd } from '@/utils/eventTime';

const formatTimeFromDate = (date: Date): string => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const buildTransportSeedFromEvent = (type: EventType, seed: Event): Record<string, unknown> => {
  if (type !== 'rental_car' && type !== 'train' && type !== 'bus') return {};

  const arrival = getEventEnd(seed);
  if (!arrival) return {};

  const dateKey = extractDatePart(arrival.toISOString()) ?? arrival.toISOString().slice(0, 10);
  const pickupTime = formatTimeFromDate(arrival);

  if (type === 'rental_car') {
    return {
      date: dateKey,
      pickupTime,
      dropoffDate: dateKey,
    };
  }

  return {
    startDate: dateKey,
    endDate: dateKey,
    departureTime: pickupTime,
    arrivalTime: pickupTime,
  };
};

export const buildEventDraftFromPrefill = (
  type: EventType,
  prefill: Record<string, unknown> | undefined,
  events: Event[],
): Partial<Event> | null => {
  if (!prefill || Object.keys(prefill).length === 0) return null;

  const draft: Record<string, unknown> = {
    ...prefill,
    type,
    status: (prefill.status as Event['status']) ?? 'confirmed',
  };

  const afterEventId = typeof prefill.afterEventId === 'string' ? prefill.afterEventId : undefined;
  if (afterEventId) {
    const seed = events.find((event) => event.id === afterEventId);
    if (seed) {
      Object.assign(draft, buildTransportSeedFromEvent(type, seed));
    }
    delete draft.afterEventId;
  }

  if (type === 'stay') {
    const checkIn = extractDatePart(String(draft.checkIn ?? draft.startDate ?? ''));
    const checkOut = extractDatePart(String(draft.checkOut ?? draft.endDate ?? ''));
    if (checkIn) {
      draft.checkIn = checkIn;
      draft.checkInDate = checkIn;
      draft.checkInTime = draft.checkInTime ?? '15:00';
      draft.startDate = `${checkIn}T${draft.checkInTime}:00`;
    }
    if (checkOut) {
      draft.checkOut = checkOut;
      draft.checkOutDate = checkOut;
      draft.checkOutTime = draft.checkOutTime ?? '11:00';
      draft.endDate = `${checkOut}T${draft.checkOutTime}:00`;
    }
  }

  if (type === 'activity') {
    const dateKey = extractDatePart(String(draft.date ?? draft.startDate ?? ''));
    if (dateKey) {
      draft.startDate = dateKey;
      draft.endDate = dateKey;
      draft.startTime = draft.startTime ?? '10:00';
      draft.endTime = draft.endTime ?? '12:00';
    }
    if (typeof draft.title === 'string') {
      draft.title = draft.title;
    }
  }

  if (type === 'destination') {
    const dateKey = extractDatePart(String(draft.date ?? draft.startDate ?? ''));
    if (dateKey) {
      draft.startDate = dateKey;
      draft.endDate = dateKey;
      draft.startTime = draft.startTime ?? '10:00';
      draft.endTime = draft.endTime ?? '12:00';
    }
    if (typeof draft.title === 'string' && !draft.placeName) {
      draft.placeName = draft.title;
    }
  }

  return draft as Partial<Event>;
};
