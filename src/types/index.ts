export interface User {
  _id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
}

export interface Trip {
  _id: string;
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
  isPublic: boolean;
}

export interface Collaborator {
  user: User;
  role: 'editor' | 'viewer';
  addedAt: string;
}

export type EventType = 'arrival' | 'departure' | 'stay' | 'destination';

export interface BaseEvent {
  id: string;
  type: EventType;
  thumbnailUrl?: string;
  date: string;
  location?: string;
  notes?: string;
  status?: 'confirmed' | 'exploring' | 'alternative';
  priority?: number;
  source?: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ArrivalDepartureEvent extends BaseEvent {
  type: 'arrival' | 'departure';
  flightNumber?: string;
  airline?: string;
  time: string;
  airport: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string;
}

export interface StayEvent extends BaseEvent {
  type: 'stay';
  accommodationName: string;
  address?: string;
  checkIn: string;
  checkOut: string;
  reservationNumber?: string;
  contactInfo?: string;
}

export interface DestinationEvent extends BaseEvent {
  type: 'destination';
  placeName: string;
  address?: string;
  description: string;
  openingHours?: string;
}

export type Event = ArrivalDepartureEvent | StayEvent | DestinationEvent;

export interface AuthUser extends User {
  token?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
} 