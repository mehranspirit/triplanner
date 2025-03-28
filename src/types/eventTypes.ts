export type EventType = 'arrival' | 'departure' | 'stay' | 'destination' | 'flight' | 'train' | 'rental_car';

export interface User {
  _id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
}

export interface Event {
  id: string;
  type: EventType;
  thumbnailUrl?: string;
  date: string; // YYYY-MM-DD format
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  notes?: string;
  status: 'confirmed' | 'exploring';
  source?: 'manual' | 'google_places' | 'google_flights' | 'booking.com' | 'airbnb' | 'expedia' | 'tripadvisor' | 'other';
  createdBy: User;
  updatedBy: User;
  createdAt: string;
  updatedAt: string;
  likes?: string[];
  dislikes?: string[];
}

export interface ArrivalDepartureEvent extends Event {
  type: 'arrival' | 'departure';
  flightNumber?: string;
  airline?: string;
  time: string; // HH:mm format
  airport: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string;
}

export interface StayEvent extends Event {
  type: 'stay';
  accommodationName: string;
  address?: string;
  checkIn: string; // YYYY-MM-DD format
  checkOut: string; // YYYY-MM-DD format
  reservationNumber?: string;
  contactInfo?: string;
}

export interface DestinationEvent extends Event {
  type: 'destination';
  placeName: string;
  address?: string;
  description?: string;
  openingHours?: string;
}

export interface Trip {
  _id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  owner: User;
  collaborators: Array<{
    user: User;
    role: 'viewer' | 'editor';
  }>;
  events: Event[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareableLink?: string;
}

export interface AuthUser extends User {
  token?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

export interface EventFormData {
  type: EventType;
  date: string;
  time?: string;
  airport?: string;
  flightNumber?: string;
  airline?: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string;
  accommodationName?: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  reservationNumber?: string;
  contactInfo?: string;
  placeName?: string;
  description?: string;
  openingHours?: string;
  notes?: string;
  status: 'confirmed' | 'exploring';
  thumbnailUrl?: string;
  source?: 'manual' | 'google_places' | 'google_flights' | 'booking.com' | 'airbnb' | 'expedia' | 'tripadvisor' | 'other';
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export interface FlightEvent extends Event {
  type: 'flight';
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string;
}

export interface TrainEvent extends Event {
  type: 'train';
  trainNumber?: string;
  trainOperator?: string;
  departureStation?: string;
  arrivalStation?: string;
  departureTime?: string;
  arrivalTime?: string;
  carriageNumber?: string;
  seatNumber?: string;
  bookingReference?: string;
}

export interface RentalCarEvent extends Event {
  type: 'rental_car';
  carCompany?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  dropoffTime?: string;
  carType?: string;
  bookingReference?: string;
  licensePlate?: string;
} 