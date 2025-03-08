export type EventType = 'arrival' | 'departure' | 'stays' | 'destinations';

export interface BaseEvent {
  id: string;
  type: EventType;
  thumbnailUrl: string;
  date: string;
  location?: string;
  notes?: string;
}

export interface ArrivalDepartureEvent extends BaseEvent {
  type: 'arrival' | 'departure';
  flightNumber: string;
  airline: string;
  time: string;
  airport: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string;
}

export interface StaysEvent extends BaseEvent {
  type: 'stays';
  accommodationName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  reservationNumber?: string;
  contactInfo?: string;
}

export interface DestinationsEvent extends BaseEvent {
  type: 'destinations';
  placeName: string;
  address: string;
  description: string;
  openingHours?: string;
  notes?: string;
}

export type Event = ArrivalDepartureEvent | StaysEvent | DestinationsEvent;

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Collaborator {
  user: User;
  role: 'editor' | 'viewer';
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  startDate?: string;
  endDate?: string;
  events: Event[];
  owner: User;
  collaborators: Collaborator[];
  shareableLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
} 