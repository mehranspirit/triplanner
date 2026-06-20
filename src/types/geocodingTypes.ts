import { Trip } from '@/types/eventTypes';

export interface GeocodeEventLocation {
  lat: number;
  lng: number;
  address?: string;
  quality?: 'exact' | 'inferred' | 'unresolved' | 'missing';
  query?: string;
  confidence?: number;
  source?: 'manual' | 'geocoded' | 'imported' | 'unknown' | 'google_places';
  placeId?: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface GeocodeSuggestion {
  query: string;
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
  quality: 'exact' | 'inferred';
  score: number;
  provider?: string;
  recommended?: boolean;
}

export interface GeocodePreviewResponse {
  eventId: string;
  mode?: 'single';
  suggestions: GeocodeSuggestion[];
  queryAttempts: GeocodeQueryAttempt[];
  recommended: GeocodeSuggestion | null;
  queriesTried: number;
}

export interface GeocodeEndpointPreview {
  endpoint: 'departure' | 'arrival';
  label: string;
  query?: string;
  suggestions: GeocodeSuggestion[];
  queryAttempts: GeocodeQueryAttempt[];
  recommended: GeocodeSuggestion | null;
  queriesTried: number;
}

export interface GeocodeTransportPreviewResponse {
  eventId: string;
  mode: 'transport';
  departure: GeocodeEndpointPreview;
  arrival: GeocodeEndpointPreview;
}

export type GeocodePreviewResult = GeocodePreviewResponse | GeocodeTransportPreviewResponse;

export const isTransportGeocodePreview = (
  preview: GeocodePreviewResult | null,
): preview is GeocodeTransportPreviewResponse => preview?.mode === 'transport';

export interface TransportLocationApplyPayload {
  departure?: GeocodeEventLocation & { displayName?: string };
  arrival?: GeocodeEventLocation & { displayName?: string };
}

export interface ApplyEventLocationResponse {
  trip: Trip;
  event: import('@/types/eventTypes').Event;
}

export interface PlaceAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface PlaceDetailsResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  types: string[];
  website?: string;
  openingHours?: string;
  contactInfo?: string;
}

export interface PickedEventLocation {
  lat: number;
  lng: number;
  address: string;
  placeId?: string;
  query?: string;
  source: 'google_places';
  quality: 'exact';
  confidence: number;
  website?: string;
  openingHours?: string;
  contactInfo?: string;
}

export interface GeocodeQueryAttempt {
  query: string;
  matched: boolean;
  score?: number;
  confidence?: number;
  provider?: string;
  selected?: boolean;
}

export interface GeocodeEventResult {
  eventId: string;
  skipped?: boolean;
  reason?: 'already_geocoded' | 'no_query' | 'no_improvement';
  query?: string;
  success?: boolean;
  queriesTried?: number;
  queryAttempts?: GeocodeQueryAttempt[];
  location?: GeocodeEventLocation;
}

export interface GeocodeTripEventsResponse {
  trip: Trip;
  updatedCount: number;
  results: GeocodeEventResult[];
}
