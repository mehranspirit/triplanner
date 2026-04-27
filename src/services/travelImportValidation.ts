import { Event, EventType } from '@/types/eventTypes';
import {
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventStart,
} from '@/utils/eventTime';

export interface ParsedEventCandidate {
  id: string;
  event: Event;
  selected: boolean;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    duplicateEventIds: string[];
  };
}

const requiredFieldsByType: Record<EventType, string[]> = {
  arrival: ['airport', 'date', 'time'],
  departure: ['airport', 'date', 'time'],
  stay: ['accommodationName', 'checkIn', 'checkInTime', 'checkOut', 'checkOutTime'],
  destination: ['placeName', 'startDate', 'startTime', 'endDate', 'endTime'],
  flight: ['departureAirport', 'arrivalAirport', 'startDate', 'endDate'],
  train: ['departureStation', 'arrivalStation', 'startDate', 'endDate'],
  rental_car: ['pickupLocation', 'dropoffLocation', 'date', 'pickupTime', 'dropoffDate', 'dropoffTime'],
  bus: ['departureStation', 'arrivalStation', 'startDate', 'endDate'],
  activity: ['title', 'activityType', 'startDate', 'startTime', 'endDate', 'endTime'],
};

const hasValue = (value: unknown) => {
  return value !== undefined && value !== null && String(value).trim() !== '';
};

const getMissingRequiredFields = (event: Event) => {
  const eventData = event as any;
  const requiredFields = requiredFieldsByType[event.type] || [];
  return requiredFields.filter((field) => !hasValue(eventData[field]));
};

const isSameDay = (a: Date | null, b: Date | null) => {
  if (!a || !b) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
};

const minutesBetween = (a: Date | null, b: Date | null) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(a.getTime() - b.getTime()) / 60000;
};

const isLikelyDuplicate = (candidate: Event, existing: Event) => {
  if (candidate.type !== existing.type) return false;

  const candidateReference = getEventBookingReference(candidate);
  const existingReference = getEventBookingReference(existing);

  if (candidateReference && existingReference && candidateReference === existingReference) {
    return true;
  }

  const candidateStart = getEventStart(candidate);
  const existingStart = getEventStart(existing);

  if (!isSameDay(candidateStart, existingStart) || minutesBetween(candidateStart, existingStart) > 90) {
    return false;
  }

  return getEventDisplayName(candidate).toLowerCase() === getEventDisplayName(existing).toLowerCase();
};

const needsMapLocationReview = (event: Event) => {
  if (event.location?.lat !== 0 || event.location?.lng !== 0) {
    return false;
  }

  const eventData = event as any;

  switch (event.type) {
    case 'arrival':
    case 'departure':
      return !hasValue(eventData.airport);
    case 'flight':
      return !hasValue(eventData.departureAirport) || !hasValue(eventData.arrivalAirport);
    case 'train':
    case 'bus':
      return !hasValue(eventData.departureStation) || !hasValue(eventData.arrivalStation);
    case 'rental_car':
      return !hasValue(eventData.pickupLocation) || !hasValue(eventData.dropoffLocation);
    default:
      return true;
  }
};

export const buildParsedEventCandidates = (
  parsedEvents: Event[],
  existingEvents: Event[]
): ParsedEventCandidate[] => {
  return parsedEvents.map((event, index) => {
    const missingFields = getMissingRequiredFields(event);
    const start = getEventStart(event);
    const end = getEventEnd(event);
    const duplicateEventIds = existingEvents
      .filter((existingEvent) => isLikelyDuplicate(event, existingEvent))
      .map((existingEvent) => existingEvent.id);

    const errors = [
      ...missingFields.map((field) => `Missing required field: ${field}`),
      ...(!start ? ['Missing or invalid start time'] : []),
      ...(!end ? ['Missing or invalid end time'] : []),
    ];

    const warnings = [
      ...(duplicateEventIds.length > 0 ? ['This looks similar to an existing event.'] : []),
      ...(needsMapLocationReview(event) ? ['Location needs review before map/routing can work well.'] : []),
    ];

    return {
      id: `${event.id || 'parsed'}-${index}`,
      event,
      selected: errors.length === 0 && duplicateEventIds.length === 0,
      validation: {
        valid: errors.length === 0,
        errors,
        warnings,
        duplicateEventIds,
      },
    };
  });
};
