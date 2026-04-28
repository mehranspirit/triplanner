export interface WeatherDay {
  date: string;
  weatherCode?: number;
  condition?: string;
  precipitationProbabilityMax?: number;
  precipitationSum?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  windSpeedMax?: number;
}

export interface WeatherSnapshot {
  _id: string;
  provider: 'open-meteo' | string;
  tripId: string;
  eventId: string;
  originalEventId?: string;
  eventType?: string;
  eventName?: string;
  locationRole?: 'event' | 'departure' | 'arrival';
  date: string;
  lat: number;
  lng: number;
  locationName?: string;
  timezone?: string;
  daily: WeatherDay[];
  fetchedAt: string;
  expiresAt: string;
}

export interface TripWeatherResponse {
  provider: string;
  generatedAt: string;
  snapshots: WeatherSnapshot[];
  skipped: {
    eventId: string;
    locationRole?: 'event' | 'departure' | 'arrival';
    reason: 'missing_date' | 'missing_location' | 'outside_forecast_window' | string;
  }[];
  diagnostics?: {
    status: 'available' | 'partial' | 'no_targets' | 'outside_window' | 'provider_error' | 'no_data' | string;
    configured: boolean;
    reasonCounts: Record<string, number>;
    attemptedTargets: number;
    availableSnapshots: number;
    forecastWindowDays: number;
    message: string;
  };
}
