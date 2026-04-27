const fetch = require('node-fetch');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { geocodeLocation } = require('./geocoding');

const PROVIDER = 'open-meteo';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_FORECAST_DAYS = 16;

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const normalized = String(dateValue).includes('T')
    ? dateValue
    : `${dateValue}T${timeValue || '00:00'}:00`;
  const date = new Date(normalized);
  return isValidDate(date) ? date : null;
};

const getEventStart = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkIn || event.startDate, event.checkInTime);
    case 'rental_car':
      return parseEventDateTime(event.date || event.startDate, event.pickupTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.startDate || event.departureDate, event.departureTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.startDate, event.startTime);
    default:
      return parseEventDateTime(event.startDate);
  }
};

const getEventEnd = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.endDate || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkOut || event.endDate, event.checkOutTime);
    case 'rental_car':
      return parseEventDateTime(event.dropoffDate || event.endDate, event.dropoffTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.endDate || event.arrivalDate, event.arrivalTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.endDate, event.endTime);
    default:
      return parseEventDateTime(event.endDate || event.startDate);
  }
};

const getEventName = (event) => {
  switch (event.type) {
    case 'stay':
      return event.accommodationName || 'Stay';
    case 'destination':
      return event.placeName || 'Destination';
    case 'activity':
      return event.title || 'Activity';
    case 'arrival':
      return `Arrival at ${event.airport || 'airport'}`;
    case 'departure':
      return `Departure from ${event.airport || 'airport'}`;
    case 'flight':
      return event.flightNumber ? `Flight ${event.flightNumber}` : 'Flight';
    case 'train':
      return event.trainNumber ? `Train ${event.trainNumber}` : 'Train';
    case 'bus':
      return event.busNumber ? `Bus ${event.busNumber}` : 'Bus';
    case 'rental_car':
      return event.carCompany ? `${event.carCompany} rental car` : 'Rental car';
    default:
      return event.type;
  }
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeatherCondition = (code) => {
  if ([0].includes(code)) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Forecast';
};

const hasUsableLocation = (event) => (
  event.location &&
  Number(event.location.lat) !== 0 &&
  Number(event.location.lng) !== 0 &&
  !Number.isNaN(Number(event.location.lat)) &&
  !Number.isNaN(Number(event.location.lng))
);

const getEventWeatherWindow = (event) => {
  const start = getEventStart(event);
  const end = getEventEnd(event) || start;
  if (!start || !end) return null;

  return {
    start,
    end,
    dateKey: formatDateKey(start)
  };
};

const getPointWeatherWindow = (date) => {
  if (!date) return null;

  return {
    start: date,
    end: date,
    dateKey: formatDateKey(date)
  };
};

const isForecastWindowSupported = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const forecastLimit = new Date(today);
  forecastLimit.setDate(forecastLimit.getDate() + MAX_FORECAST_DAYS - 1);

  return date >= today && date <= forecastLimit;
};

const fetchOpenMeteoForecast = async ({ lat, lng, startDate, endDate, timezone }) => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max'
  ].join(','));
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', timezone || 'auto');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather provider returned ${response.status}`);
  }

  return response.json();
};

const toDailyForecast = (raw) => {
  const daily = raw.daily || {};
  return (daily.time || []).map((date, index) => ({
    date,
    weatherCode: daily.weather_code?.[index],
    condition: getWeatherCondition(daily.weather_code?.[index]),
    precipitationProbabilityMax: daily.precipitation_probability_max?.[index],
    precipitationSum: daily.precipitation_sum?.[index],
    temperatureMax: daily.temperature_2m_max?.[index],
    temperatureMin: daily.temperature_2m_min?.[index],
    windSpeedMax: daily.wind_speed_10m_max?.[index]
  }));
};

const getLocationName = (event) => (
  event.location?.address ||
  event.address ||
  event.accommodationName ||
  event.placeName ||
  event.title ||
  event.airport
);

const buildEventWeatherTargets = async (event) => {
  if (event.type === 'flight') {
    const targets = [];
    const departureWindow = getPointWeatherWindow(getEventStart(event));
    const arrivalWindow = getPointWeatherWindow(getEventEnd(event));

    if (event.departureAirport && departureWindow) {
      const geocoded = await geocodeLocation(event.departureAirport);
      if (geocoded) {
        targets.push({
          eventId: `${event.id}:departure`,
          originalEventId: event.id,
          locationRole: 'departure',
          window: departureWindow,
          lat: geocoded.lat,
          lng: geocoded.lng,
          locationName: geocoded.displayName || event.departureAirport,
        });
      }
    }

    if (event.arrivalAirport && arrivalWindow) {
      const geocoded = await geocodeLocation(event.arrivalAirport);
      if (geocoded) {
        targets.push({
          eventId: `${event.id}:arrival`,
          originalEventId: event.id,
          locationRole: 'arrival',
          window: arrivalWindow,
          lat: geocoded.lat,
          lng: geocoded.lng,
          locationName: geocoded.displayName || event.arrivalAirport,
        });
      }
    }

    return targets;
  }

  const supportedEventTypes = new Set(['stay', 'destination', 'activity', 'arrival', 'departure']);
  const window = getEventWeatherWindow(event);
  if (!window || !supportedEventTypes.has(event.type) || !hasUsableLocation(event)) {
    return [];
  }

  return [{
    eventId: event.id,
    originalEventId: event.id,
    locationRole: 'event',
    window,
    lat: event.location.lat,
    lng: event.location.lng,
    locationName: getLocationName(event),
  }];
};

const getTripWeather = async ({ trip, refresh = false }) => {
  const snapshots = [];
  const skipped = [];
  const now = new Date();

  for (const event of trip.events || []) {
    const targets = await buildEventWeatherTargets(event);

    if (targets.length === 0) {
      skipped.push({ eventId: event.id, reason: event.type === 'flight' ? 'missing_endpoint_location' : 'missing_location' });
      continue;
    }

    for (const target of targets) {
      const { window } = target;

      if (!isForecastWindowSupported(window.start)) {
        skipped.push({ eventId: event.id, locationRole: target.locationRole, reason: 'outside_forecast_window' });
        continue;
      }

      const cached = !refresh
        ? await WeatherSnapshot.findOne({
            provider: PROVIDER,
            tripId: trip._id,
            eventId: target.eventId,
            date: window.dateKey,
            expiresAt: { $gt: now }
          })
        : null;

      if (cached) {
        snapshots.push(cached);
        continue;
      }

      const startDate = formatDateKey(window.start);
      const endDate = formatDateKey(window.end);
      const raw = await fetchOpenMeteoForecast({
        lat: target.lat,
        lng: target.lng,
        startDate,
        endDate,
        timezone: trip.timezone
      });

      const snapshot = await WeatherSnapshot.findOneAndUpdate(
        {
          provider: PROVIDER,
          tripId: trip._id,
          eventId: target.eventId,
          date: window.dateKey
        },
        {
          $set: {
            originalEventId: target.originalEventId,
            eventType: event.type,
            eventName: getEventName(event),
            locationRole: target.locationRole,
            lat: target.lat,
            lng: target.lng,
            locationName: target.locationName,
            timezone: raw.timezone || trip.timezone,
            daily: toDailyForecast(raw),
            fetchedAt: now,
            expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
            raw
          },
          $setOnInsert: {
            provider: PROVIDER,
            tripId: trip._id,
            eventId: target.eventId,
            date: window.dateKey
          }
        },
        { new: true, upsert: true }
      );

      snapshots.push(snapshot);
    }
  }

  return {
    provider: PROVIDER,
    generatedAt: new Date().toISOString(),
    snapshots,
    skipped
  };
};

module.exports = {
  getTripWeather,
};
