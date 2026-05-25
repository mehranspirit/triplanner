import { Trip } from '@/types/eventTypes';

export interface GeocodeEventLocation {
  lat: number;
  lng: number;
  address?: string;
  quality?: 'exact' | 'inferred' | 'unresolved' | 'missing';
  query?: string;
  confidence?: number;
}

export interface GeocodeEventResult {
  eventId: string;
  skipped?: boolean;
  reason?: 'already_geocoded' | 'no_query';
  query?: string;
  success?: boolean;
  location?: GeocodeEventLocation;
}

export interface GeocodeTripEventsResponse {
  trip: Trip;
  updatedCount: number;
  results: GeocodeEventResult[];
}
