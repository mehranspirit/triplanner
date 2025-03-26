import { EventType, Event, ArrivalDepartureEvent, StayEvent, DestinationEvent } from '../../types';

export interface EventTypeConfig {
  type: EventType;
  label: string;
  icon: string;
  defaultThumbnail: string;
  fields: {
    required: string[];
    optional: string[];
  };
  validate: (event: Event) => boolean;
}

const eventTypes: Record<EventType, EventTypeConfig> = {
  arrival: {
    type: 'arrival',
    label: 'Arrival',
    icon: '✈️',
    defaultThumbnail: '/images/arrival.jpg',
    fields: {
      required: ['date', 'time', 'airport'],
      optional: ['flightNumber', 'airline', 'terminal', 'gate', 'bookingReference', 'notes', 'source']
    },
    validate: (event: Event) => {
      const arrivalEvent = event as ArrivalDepartureEvent;
      return !!(
        arrivalEvent.date &&
        arrivalEvent.time &&
        arrivalEvent.airport
      );
    }
  },
  departure: {
    type: 'departure',
    label: 'Departure',
    icon: '✈️',
    defaultThumbnail: '/images/departure.jpg',
    fields: {
      required: ['date', 'time', 'airport'],
      optional: ['flightNumber', 'airline', 'terminal', 'gate', 'bookingReference', 'notes', 'source']
    },
    validate: (event: Event) => {
      const departureEvent = event as ArrivalDepartureEvent;
      return !!(
        departureEvent.date &&
        departureEvent.time &&
        departureEvent.airport
      );
    }
  },
  stay: {
    type: 'stay',
    label: 'Stay',
    icon: '🏨',
    defaultThumbnail: '/images/stay.jpg',
    fields: {
      required: ['date', 'accommodationName', 'checkIn', 'checkOut'],
      optional: ['address', 'reservationNumber', 'contactInfo', 'notes', 'source']
    },
    validate: (event: Event) => {
      const stayEvent = event as StayEvent;
      return !!(
        stayEvent.date &&
        stayEvent.accommodationName &&
        stayEvent.checkIn &&
        stayEvent.checkOut
      );
    }
  },
  destination: {
    type: 'destination',
    label: 'Destination',
    icon: '📍',
    defaultThumbnail: '/images/destination.jpg',
    fields: {
      required: ['date', 'placeName'],
      optional: ['address', 'description', 'openingHours', 'notes', 'source']
    },
    validate: (event: Event) => {
      const destinationEvent = event as DestinationEvent;
      return !!(
        destinationEvent.date &&
        destinationEvent.placeName
      );
    }
  }
};

export const getEventTypeConfig = (type: EventType): EventTypeConfig => {
  return eventTypes[type];
};

export const getAllEventTypes = (): EventType[] => {
  return Object.keys(eventTypes) as EventType[];
};

export const getEventTypeLabel = (type: EventType): string => {
  return eventTypes[type].label;
};

export const getEventTypeIcon = (type: EventType): string => {
  return eventTypes[type].icon;
};

export const getEventTypeDefaultThumbnail = (type: EventType): string => {
  return eventTypes[type].defaultThumbnail;
};

export const validateEvent = (event: Event): boolean => {
  return eventTypes[event.type].validate(event);
}; 