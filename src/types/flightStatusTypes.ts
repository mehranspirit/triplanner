export interface FlightStatusEndpoint {
  airportName?: string;
  airportIata?: string;
  airportIcao?: string;
  scheduledLocal?: string;
  scheduledUtc?: string;
  revisedLocal?: string;
  revisedUtc?: string;
  actualLocal?: string;
  actualUtc?: string;
  terminal?: string;
  gate?: string;
  delayMinutes?: number;
}

export interface FlightStatusSnapshot {
  _id: string;
  provider: 'aviationstack' | 'aerodatabox' | string;
  tripId: string;
  eventId: string;
  flightNumber: string;
  dateLocal: string;
  status?: string;
  codeshareStatus?: string;
  departure?: FlightStatusEndpoint;
  arrival?: FlightStatusEndpoint;
  fetchedAt: string;
  expiresAt: string;
}

export interface TripFlightStatusesResponse {
  provider: string;
  generatedAt: string;
  configured: boolean;
  snapshots: FlightStatusSnapshot[];
  skipped: {
    eventId: string;
    reason: 'missing_api_key' | 'missing_flight_number' | 'missing_date' | 'not_found' | string;
  }[];
  diagnostics?: {
    status: 'available' | 'partial' | 'not_configured' | 'no_targets' | 'provider_error' | 'no_data' | string;
    configured: boolean;
    reasonCounts: Record<string, number>;
    attemptedFlights: number;
    availableSnapshots: number;
    message: string;
  };
}
