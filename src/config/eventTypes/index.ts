import { EventType, Event, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent, BusEvent, ActivityEvent } from '../../types';

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
  },
  flight: {
    type: 'flight',
    label: 'Flight',
    icon: '✈️',
    defaultThumbnail: '/images/flight.jpg',
    fields: {
      required: ['date'],
      optional: ['airline', 'flightNumber', 'departureAirport', 'arrivalAirport', 'departureTime', 'arrivalTime', 'terminal', 'gate', 'bookingReference', 'notes', 'source']
    },
    validate: (event: Event) => {
      const flightEvent = event as FlightEvent;
      return !!(
        flightEvent.date
      );
    }
  },
  train: {
    type: 'train',
    label: 'Train',
    icon: '🚂',
    defaultThumbnail: '/images/train.jpg',
    fields: {
      required: ['date'],
      optional: ['trainNumber', 'trainOperator', 'departureStation', 'arrivalStation', 'departureTime', 'arrivalTime', 'carriageNumber', 'seatNumber', 'bookingReference', 'notes', 'source']
    },
    validate: (event: Event) => {
      const trainEvent = event as TrainEvent;
      return !!(
        trainEvent.date
      );
    }
  },
  rental_car: {
    type: 'rental_car',
    label: 'Rental Car',
    icon: '🚗',
    defaultThumbnail: '/images/rental_car.jpg',
    fields: {
      required: ['date'],
      optional: ['carCompany', 'pickupLocation', 'dropoffLocation', 'pickupTime', 'dropoffTime', 'carType', 'bookingReference', 'licensePlate', 'notes', 'source']
    },
    validate: (event: Event) => {
      const rentalCarEvent = event as RentalCarEvent;
      return !!(
        rentalCarEvent.date
      );
    }
  },
  bus: {
    type: 'bus',
    label: 'Bus',
    icon: '🚌',
    defaultThumbnail: '/images/bus.jpg',
    fields: {
      required: ['date'],
      optional: ['busNumber', 'busOperator', 'departureStation', 'arrivalStation', 'departureTime', 'arrivalTime', 'seatNumber', 'bookingReference', 'notes', 'source']
    },
    validate: (event: Event) => {
      const busEvent = event as BusEvent;
      return !!(
        busEvent.date
      );
    }
  },
  activity: {
    type: 'activity',
    label: 'Activity',
    icon: '🏔️',
    defaultThumbnail: '/images/activity.jpg',
    fields: {
      required: ['date', 'title', 'activityType'],
      optional: ['notes', 'source', 'location']
    },
    validate: (event: Event) => {
      const activityEvent = event as ActivityEvent;
      return !!(
        activityEvent.date &&
        activityEvent.title &&
        activityEvent.activityType
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