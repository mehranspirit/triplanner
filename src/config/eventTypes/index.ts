import { EventType, Event, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent, BusEvent, ActivityEvent } from '../../types/eventTypes';

export interface EventTypeConfig<T extends Event = Event> {
  type: EventType;
  label: string;
  icon: string;
  color: string;
  getDate: (event: T) => string;
  getTime: (event: T) => string;
  getLocation: (event: T) => string;
  getTitle: (event: T) => string;
  getSubtitle: (event: T) => string;
  validate: (event: T) => boolean;
}

export const eventTypeConfigs: {
  arrival: EventTypeConfig<ArrivalDepartureEvent>;
  departure: EventTypeConfig<ArrivalDepartureEvent>;
  stay: EventTypeConfig<StayEvent>;
  destination: EventTypeConfig<DestinationEvent>;
  flight: EventTypeConfig<FlightEvent>;
  train: EventTypeConfig<TrainEvent>;
  rental_car: EventTypeConfig<RentalCarEvent>;
  bus: EventTypeConfig<BusEvent>;
  activity: EventTypeConfig<ActivityEvent>;
} = {
  arrival: {
    type: 'arrival',
    label: 'Arrival',
    icon: 'plane-arrival',
    color: 'blue',
    getDate: (event: ArrivalDepartureEvent) => event.date,
    getTime: (event: ArrivalDepartureEvent) => event.time,
    getLocation: (event: ArrivalDepartureEvent) => event.airport,
    getTitle: (event: ArrivalDepartureEvent) => `Arrival at ${event.airport}`,
    getSubtitle: (event: ArrivalDepartureEvent) => event.flightNumber ? `Flight ${event.flightNumber}` : '',
    validate: (event: ArrivalDepartureEvent) => !!(event.date && event.time && event.airport)
  },
  departure: {
    type: 'departure',
    label: 'Departure',
    icon: 'plane-departure',
    color: 'red',
    getDate: (event: ArrivalDepartureEvent) => event.date,
    getTime: (event: ArrivalDepartureEvent) => event.time,
    getLocation: (event: ArrivalDepartureEvent) => event.airport,
    getTitle: (event: ArrivalDepartureEvent) => `Departure from ${event.airport}`,
    getSubtitle: (event: ArrivalDepartureEvent) => event.flightNumber ? `Flight ${event.flightNumber}` : '',
    validate: (event: ArrivalDepartureEvent) => !!(event.date && event.time && event.airport)
  },
  stay: {
    type: 'stay',
    label: 'Stay',
    icon: 'bed',
    color: 'green',
    getDate: (event: StayEvent) => event.checkIn,
    getTime: (event: StayEvent) => event.checkInTime,
    getLocation: (event: StayEvent) => event.accommodationName,
    getTitle: (event: StayEvent) => event.accommodationName,
    getSubtitle: (event: StayEvent) => `${event.checkIn} - ${event.checkOut}`,
    validate: (event: StayEvent) => !!(event.checkIn && event.checkOut && event.accommodationName)
  },
  destination: {
    type: 'destination',
    label: 'Destination',
    icon: 'map-marker-alt',
    color: 'purple',
    getDate: (event: DestinationEvent) => event.startDate,
    getTime: (event: DestinationEvent) => event.startTime,
    getLocation: (event: DestinationEvent) => event.placeName,
    getTitle: (event: DestinationEvent) => event.placeName,
    getSubtitle: (event: DestinationEvent) => event.description || '',
    validate: (event: DestinationEvent) => !!(event.startDate && event.placeName)
  },
  flight: {
    type: 'flight',
    label: 'Flight',
    icon: 'plane',
    color: 'blue',
    getDate: (event: FlightEvent) => event.startDate,
    getTime: (event: FlightEvent) => event.departureTime || '',
    getLocation: (event: FlightEvent) => `${event.departureAirport} → ${event.arrivalAirport}`,
    getTitle: (event: FlightEvent) => `Flight ${event.flightNumber || ''}`,
    getSubtitle: (event: FlightEvent) => `${event.departureAirport} → ${event.arrivalAirport}`,
    validate: (event: FlightEvent) => !!(event.startDate && event.departureAirport && event.arrivalAirport)
  },
  train: {
    type: 'train',
    label: 'Train',
    icon: 'train',
    color: 'orange',
    getDate: (event: TrainEvent) => event.startDate,
    getTime: (event: TrainEvent) => event.departureTime || '',
    getLocation: (event: TrainEvent) => `${event.departureStation} → ${event.arrivalStation}`,
    getTitle: (event: TrainEvent) => `Train ${event.trainNumber || ''}`,
    getSubtitle: (event: TrainEvent) => `${event.departureStation} → ${event.arrivalStation}`,
    validate: (event: TrainEvent) => !!(event.startDate && event.departureStation && event.arrivalStation)
  },
  rental_car: {
    type: 'rental_car',
    label: 'Rental Car',
    icon: 'car',
    color: 'yellow',
    getDate: (event: RentalCarEvent) => event.date,
    getTime: (event: RentalCarEvent) => event.pickupTime,
    getLocation: (event: RentalCarEvent) => event.pickupLocation || '',
    getTitle: (event: RentalCarEvent) => `${event.carCompany || 'Car Rental'}`,
    getSubtitle: (event: RentalCarEvent) => `${event.pickupLocation} → ${event.dropoffLocation}`,
    validate: (event: RentalCarEvent) => !!(event.date && event.pickupTime && event.pickupLocation && event.dropoffLocation)
  },
  bus: {
    type: 'bus',
    label: 'Bus',
    icon: 'bus',
    color: 'green',
    getDate: (event: BusEvent) => event.startDate,
    getTime: (event: BusEvent) => event.departureTime || '',
    getLocation: (event: BusEvent) => `${event.departureStation} → ${event.arrivalStation}`,
    getTitle: (event: BusEvent) => `Bus ${event.busNumber || ''}`,
    getSubtitle: (event: BusEvent) => `${event.departureStation} → ${event.arrivalStation}`,
    validate: (event: BusEvent) => !!(event.startDate && event.departureStation && event.arrivalStation)
  },
  activity: {
    type: 'activity',
    label: 'Activity',
    icon: 'calendar-check',
    color: 'purple',
    getDate: (event: ActivityEvent) => event.startDate,
    getTime: (event: ActivityEvent) => event.startTime,
    getLocation: (event: ActivityEvent) => event.address || '',
    getTitle: (event: ActivityEvent) => event.title,
    getSubtitle: (event: ActivityEvent) => event.description || '',
    validate: (event: ActivityEvent) => !!(event.startDate && event.title && event.activityType)
  }
};

export const getEventTypeConfig = <T extends Event>(type: EventType): EventTypeConfig<T> => {
  return eventTypeConfigs[type] as EventTypeConfig<T>;
};

export const getAllEventTypes = (): EventType[] => {
  return Object.keys(eventTypeConfigs) as EventType[];
};

export const getEventTypeLabel = (type: EventType): string => {
  return eventTypeConfigs[type].label;
};

export const getEventTypeIcon = (type: EventType): string => {
  return eventTypeConfigs[type].icon;
};

export const getEventTypeColor = (type: EventType): string => {
  return eventTypeConfigs[type].color;
};

export const getEventTypeDate = <T extends Event>(type: EventType, event: T): string => {
  return eventTypeConfigs[type].getDate(event as any);
};

export const getEventTypeTime = <T extends Event>(type: EventType, event: T): string => {
  return eventTypeConfigs[type].getTime(event as any);
};

export const getEventTypeLocation = <T extends Event>(type: EventType, event: T): string => {
  return eventTypeConfigs[type].getLocation(event as any);
};

export const getEventTypeTitle = <T extends Event>(type: EventType, event: T): string => {
  return eventTypeConfigs[type].getTitle(event as any);
};

export const getEventTypeSubtitle = <T extends Event>(type: EventType, event: T): string => {
  return eventTypeConfigs[type].getSubtitle(event as any);
};

export const validateEvent = (event: Event): boolean => {
  const config = eventTypeConfigs[event.type];
  return config.validate(event as any);
}; 