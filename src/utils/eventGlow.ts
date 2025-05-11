import { Event, EventType, StayEvent, FlightEvent, TrainEvent, BusEvent, RentalCarEvent, ActivityEvent, DestinationEvent, ArrivalDepartureEvent } from '@/types/eventTypes';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

// Color mapping for each event type
export const eventColors = {
  arrival: 'blue',
  departure: 'red',
  stay: 'yellow',
  destination: 'pink',
  flight: 'blue',
  train: 'orange',
  rental_car: 'red',
  bus: 'purple',
  activity: 'indigo'
} as const;

// Get the tailwind color class based on event type
export const getEventColor = (type: EventType) => {
  const color = eventColors[type];
  return `${color}-500`;
};

// Check if an event is currently active based on its type and dates
export const isEventCurrentlyActive = (event: Event): boolean => {
  const today = new Date();

  switch (event.type) {
    case 'stay': {
      const stayEvent = event as StayEvent;
      const checkInDate = new Date(stayEvent.checkIn);
      const checkOutDate = new Date(stayEvent.checkOut);
      return isWithinInterval(today, {
        start: startOfDay(checkInDate),
        end: endOfDay(checkOutDate)
      });
    }
    
    case 'flight':
    case 'train':
    case 'bus': {
      const transportEvent = event as FlightEvent | TrainEvent | BusEvent;
      const startDate = new Date(transportEvent.startDate);
      const endDate = transportEvent.endDate ? new Date(transportEvent.endDate) : startDate;
      return isWithinInterval(today, {
        start: startOfDay(startDate),
        end: endOfDay(endDate)
      });
    }
    
    case 'rental_car': {
      const carEvent = event as RentalCarEvent;
      const pickupDate = new Date(carEvent.date);
      const dropoffDate = carEvent.dropoffDate ? new Date(carEvent.dropoffDate) : pickupDate;
      return isWithinInterval(today, {
        start: startOfDay(pickupDate),
        end: endOfDay(dropoffDate)
      });
    }
    
    case 'activity':
    case 'destination': {
      const timeEvent = event as ActivityEvent | DestinationEvent;
      const startDate = new Date(timeEvent.startDate);
      const endDate = timeEvent.endDate ? new Date(timeEvent.endDate) : startDate;
      return isWithinInterval(today, {
        start: startOfDay(startDate),
        end: endOfDay(endDate)
      });
    }
    
    case 'arrival':
    case 'departure': {
      const airportEvent = event as ArrivalDepartureEvent;
      const date = new Date(airportEvent.date);
      return isWithinInterval(today, {
        start: startOfDay(date),
        end: endOfDay(date)
      });
    }
    
    default:
      return false;
  }
}; 