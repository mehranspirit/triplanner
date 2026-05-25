import { Event } from '@/types/eventTypes';

const DEFAULT_TIME = '00:00';
const DEFAULT_END_TIME = '17:00';
const DEFAULT_START_TIME = '09:00';

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

export const extractDatePart = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(trimmed);
  return isValidDate(parsed) ? parsed.toISOString().slice(0, 10) : null;
};

export const normalizeTimePart = (value?: string | null, fallback = DEFAULT_TIME): string => {
  if (!value) return fallback;
  const match = String(value).trim().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
};

export const normalizeActivityDestinationSchedule = <T extends Event>(event: T): T => {
  if (event.type !== 'activity' && event.type !== 'destination') {
    return event;
  }

  const startDay = extractDatePart(event.startDate) || extractDatePart((event as Event & { date?: string }).date);
  if (!startDay) {
    return event;
  }

  let endDay = extractDatePart(event.endDate);
  const eventTimes = event as Event & { startTime?: string; endTime?: string };
  const startTime = normalizeTimePart(eventTimes.startTime, DEFAULT_START_TIME);
  let endTime = normalizeTimePart(eventTimes.endTime, DEFAULT_END_TIME);

  if (!endDay || endDay < startDay) {
    endDay = startDay;
  }

  const startDayMs = new Date(`${startDay}T12:00:00`).getTime();
  const endDayMs = new Date(`${endDay}T12:00:00`).getTime();
  const dayDiff = Math.round((endDayMs - startDayMs) / (24 * 60 * 60 * 1000));
  if (dayDiff === 1 && endTime <= startTime) {
    endDay = startDay;
  }

  if (endDay === startDay && endTime <= startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    endTime = `${String(Math.min(hours + 2, 23)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return {
    ...event,
    date: startDay,
    startDate: startDay,
    endDate: endDay,
    startTime,
    endTime,
  } as T;
};

export const parseEventDateTime = (dateValue?: string, timeValue?: string): Date | null => {
  if (!dateValue) return null;

  const normalizedDate = dateValue.includes('T')
    ? dateValue
    : `${dateValue}T${timeValue || DEFAULT_TIME}`;

  const date = new Date(normalizedDate);
  return isValidDate(date) ? date : null;
};

export const getEventStart = (event: Event): Date | null => {
  const eventData = event as any;

  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(eventData.date || event.startDate, eventData.time);
    case 'stay':
      return parseEventDateTime(eventData.checkIn || event.startDate, eventData.checkInTime);
    case 'rental_car':
      return parseEventDateTime(eventData.date || event.startDate, eventData.pickupTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.startDate || eventData.departureDate, eventData.departureTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.startDate, eventData.startTime);
    default:
      return parseEventDateTime(event.startDate);
  }
};

export const getEventEnd = (event: Event): Date | null => {
  const eventData = event as any;

  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(eventData.date || event.endDate || event.startDate, eventData.time);
    case 'stay':
      return parseEventDateTime(eventData.checkOut || event.endDate, eventData.checkOutTime);
    case 'rental_car':
      return parseEventDateTime(eventData.dropoffDate || event.endDate, eventData.dropoffTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.endDate || eventData.arrivalDate, eventData.arrivalTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.endDate || event.startDate, eventData.endTime);
    default:
      return parseEventDateTime(event.endDate || event.startDate);
  }
};

export const getEventDisplayName = (event: Event): string => {
  const eventData = event as any;

  switch (event.type) {
    case 'arrival':
      return `Arrival at ${eventData.airport || 'airport'}`;
    case 'departure':
      return `Departure from ${eventData.airport || 'airport'}`;
    case 'stay':
      return eventData.accommodationName || 'Stay';
    case 'destination':
      return eventData.placeName || 'Destination';
    case 'flight':
      return eventData.flightNumber ? `Flight ${eventData.flightNumber}` : 'Flight';
    case 'train':
      return eventData.trainNumber ? `Train ${eventData.trainNumber}` : 'Train';
    case 'bus':
      return eventData.busNumber ? `Bus ${eventData.busNumber}` : 'Bus';
    case 'rental_car':
      return eventData.carCompany ? `${eventData.carCompany} rental car` : 'Rental car';
    case 'activity':
      return eventData.title || 'Activity';
    default:
      return event.type;
  }
};

export const getEventLocationLabel = (event: Event): string | undefined => {
  const eventData = event as any;

  return (
    event.location?.address ||
    eventData.address ||
    eventData.airport ||
    eventData.accommodationName ||
    eventData.placeName ||
    eventData.pickupLocation ||
    eventData.departureAirport ||
    eventData.departureStation
  );
};

export const getEventBookingReference = (event: Event): string | undefined => {
  const eventData = event as any;
  return eventData.bookingReference || eventData.reservationNumber;
};

export const sortEventsByStart = (events: Event[]): Event[] => {
  return [...events].sort((a, b) => {
    const startA = getEventStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const startB = getEventStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return startA - startB;
  });
};

export const getCurrentEvent = (events: Event[], now = new Date()): Event | null => {
  return sortEventsByStart(events).find((event) => {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    return !!start && !!end && start <= now && now <= end;
  }) || null;
};

export const getNextEvent = (events: Event[], now = new Date()): Event | null => {
  return sortEventsByStart(events).find((event) => {
    const start = getEventStart(event);
    return !!start && start > now;
  }) || null;
};

export const formatEventDateTime = (date: Date | null, timezone?: string): string => {
  if (!date) return 'Time TBD';

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  };

  try {
    return new Intl.DateTimeFormat(undefined, formatOptions).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      ...formatOptions,
      timeZone: undefined,
    }).format(date);
  }
};
