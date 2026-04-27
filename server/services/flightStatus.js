const fetch = require('node-fetch');
const FlightStatusSnapshot = require('../models/FlightStatusSnapshot');

const CACHE_TTL_MS = 20 * 60 * 1000;

const getProvider = () => (
  process.env.FLIGHT_STATUS_PROVIDER || 'aviationstack'
).toLowerCase();

const getProviderApiKey = (provider) => {
  if (provider === 'aerodatabox') return process.env.AERODATABOX_API_KEY;
  return process.env.AVIATIONSTACK_API_KEY;
};

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const normalized = String(dateValue).includes('T')
    ? dateValue
    : `${dateValue}T${timeValue || '00:00'}:00`;
  const date = new Date(normalized);
  return isValidDate(date) ? date : null;
};

const getFlightStart = (event) => parseEventDateTime(
  event.startDate || event.departureDate,
  event.departureTime
);

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeFlightNumber = (flightNumber) => {
  if (!flightNumber) return '';
  return String(flightNumber).toUpperCase().replace(/\s+/g, '').trim();
};

const getAirport = (endpoint = {}) => endpoint.airport || {};
const getTime = (endpoint = {}, key) => endpoint[key] || {};

const normalizeAeroDataBoxEndpoint = (endpoint = {}) => {
  const airport = getAirport(endpoint);
  const scheduledTime = getTime(endpoint, 'scheduledTime');
  const revisedTime = getTime(endpoint, 'revisedTime');
  const actualTime = getTime(endpoint, 'actualTime');

  return {
    airportName: airport.name,
    airportIata: airport.iata,
    airportIcao: airport.icao,
    scheduledLocal: scheduledTime.local,
    scheduledUtc: scheduledTime.utc,
    revisedLocal: revisedTime.local,
    revisedUtc: revisedTime.utc,
    actualLocal: actualTime.local,
    actualUtc: actualTime.utc,
    terminal: endpoint.terminal,
    gate: endpoint.gate,
    delayMinutes: typeof endpoint.delay === 'number' ? endpoint.delay : undefined
  };
};

const normalizeAviationStackEndpoint = (endpoint = {}) => ({
  airportName: endpoint.airport,
  airportIata: endpoint.iata,
  airportIcao: endpoint.icao,
  scheduledLocal: endpoint.scheduled,
  scheduledUtc: endpoint.scheduled,
  revisedLocal: endpoint.estimated,
  revisedUtc: endpoint.estimated,
  actualLocal: endpoint.actual,
  actualUtc: endpoint.actual,
  terminal: endpoint.terminal,
  gate: endpoint.gate,
  delayMinutes: typeof endpoint.delay === 'number' ? endpoint.delay : undefined
});

const pickBestFlight = (flights, event) => {
  if (!Array.isArray(flights) || flights.length === 0) return null;
  if (flights.length === 1) return flights[0];

  const departureHint = String(event.departureAirport || '').toUpperCase();
  const arrivalHint = String(event.arrivalAirport || '').toUpperCase();

  return flights.find((flight) => {
    const departure = normalizeAeroDataBoxEndpoint(flight.departure);
    const arrival = normalizeAeroDataBoxEndpoint(flight.arrival);
    return (
      (departure.airportIata && departureHint.includes(departure.airportIata)) ||
      (arrival.airportIata && arrivalHint.includes(arrival.airportIata))
    );
  }) || flights[0];
};

const pickBestAviationStackFlight = (flights, event) => {
  if (!Array.isArray(flights) || flights.length === 0) return null;
  if (flights.length === 1) return flights[0];

  const departureHint = String(event.departureAirport || '').toUpperCase();
  const arrivalHint = String(event.arrivalAirport || '').toUpperCase();

  return flights.find((flight) => {
    const departure = normalizeAviationStackEndpoint(flight.departure);
    const arrival = normalizeAviationStackEndpoint(flight.arrival);
    return (
      (departure.airportIata && departureHint.includes(departure.airportIata)) ||
      (arrival.airportIata && arrivalHint.includes(arrival.airportIata))
    );
  }) || flights[0];
};

const getAirlineCode = (flightNumber) => {
  const match = normalizeFlightNumber(flightNumber).match(/^[A-Z]{2,3}/);
  return match ? match[0] : '';
};

const getNumericFlightNumber = (flightNumber) => normalizeFlightNumber(flightNumber).replace(/^[A-Z]{2,3}/, '');

const fetchAviationStackFlight = async ({ flightNumber, dateLocal }) => {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    return { unavailable: true, reason: 'missing_api_key' };
  }

  const baseUrl = process.env.AVIATIONSTACK_API_URL || 'http://api.aviationstack.com';
  const url = new URL('/v1/flights', baseUrl);
  url.searchParams.set('access_key', apiKey);
  url.searchParams.set('flight_iata', flightNumber);
  url.searchParams.set('flight_date', dateLocal);
  url.searchParams.set('limit', '10');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Aviationstack returned ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Aviationstack error: ${data.error.message || data.error.code || 'unknown error'}`);
  }

  return data.data || [];
};

const fetchAeroDataBoxFlight = async ({ flightNumber, dateLocal }) => {
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    return { unavailable: true, reason: 'missing_api_key' };
  }

  const host = process.env.AERODATABOX_API_HOST || 'aerodatabox.p.rapidapi.com';
  const baseUrl = process.env.AERODATABOX_API_URL || `https://${host}`;
  const url = new URL(`/flights/number/${encodeURIComponent(flightNumber)}/${dateLocal}`, baseUrl);

  const response = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': host
    }
  });

  if (!response.ok) {
    throw new Error(`AeroDataBox returned ${response.status}`);
  }

  return response.json();
};

const fetchProviderFlights = async ({ provider, flightNumber, dateLocal }) => {
  if (provider === 'aerodatabox') {
    return fetchAeroDataBoxFlight({ flightNumber, dateLocal });
  }

  return fetchAviationStackFlight({ flightNumber, dateLocal });
};

const normalizeProviderFlight = ({ provider, flight, event, flightNumber }) => {
  if (provider === 'aerodatabox') {
    return {
      status: flight.status,
      codeshareStatus: flight.codeshareStatus,
      departure: normalizeAeroDataBoxEndpoint(flight.departure),
      arrival: normalizeAeroDataBoxEndpoint(flight.arrival),
      aircraft: flight.aircraft,
      raw: flight
    };
  }

  return {
    status: flight.flight_status,
    codeshareStatus: flight.flight?.codeshared ? 'codeshare' : undefined,
    departure: normalizeAviationStackEndpoint(flight.departure),
    arrival: normalizeAviationStackEndpoint(flight.arrival),
    aircraft: flight.aircraft,
    raw: {
      ...flight,
      normalizedFlightNumber: flight.flight?.iata || flightNumber,
      airlineCode: getAirlineCode(event.flightNumber),
      numericFlightNumber: getNumericFlightNumber(event.flightNumber)
    }
  };
};

const getTripFlightStatuses = async ({ trip, refresh = false }) => {
  const snapshots = [];
  const skipped = [];
  const now = new Date();
  const provider = getProvider();
  const providerApiKey = getProviderApiKey(provider);

  for (const event of trip.events || []) {
    if (event.type !== 'flight') continue;

    const flightNumber = normalizeFlightNumber(event.flightNumber);
    const start = getFlightStart(event);
    if (!flightNumber || !start) {
      skipped.push({ eventId: event.id, reason: !flightNumber ? 'missing_flight_number' : 'missing_date' });
      continue;
    }

    const dateLocal = formatDateKey(start);
    const cached = !refresh
      ? await FlightStatusSnapshot.findOne({
          provider,
          tripId: trip._id,
          eventId: event.id,
          dateLocal,
          expiresAt: { $gt: now }
        })
      : null;

    if (cached) {
      snapshots.push(cached);
      continue;
    }

    const raw = await fetchProviderFlights({ provider, flightNumber, dateLocal });
    if (raw.unavailable) {
      skipped.push({ eventId: event.id, reason: raw.reason });
      continue;
    }

    const flight = provider === 'aerodatabox'
      ? pickBestFlight(raw, event)
      : pickBestAviationStackFlight(raw, event);
    if (!flight) {
      skipped.push({ eventId: event.id, reason: 'not_found' });
      continue;
    }

    const normalizedFlight = normalizeProviderFlight({ provider, flight, event, flightNumber });

    const snapshot = await FlightStatusSnapshot.findOneAndUpdate(
      {
        provider,
        tripId: trip._id,
        eventId: event.id,
        dateLocal
      },
      {
        $set: {
          flightNumber,
          status: normalizedFlight.status,
          codeshareStatus: normalizedFlight.codeshareStatus,
          departure: normalizedFlight.departure,
          arrival: normalizedFlight.arrival,
          aircraft: normalizedFlight.aircraft,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
          raw: normalizedFlight.raw
        },
        $setOnInsert: {
          provider,
          tripId: trip._id,
          eventId: event.id,
          dateLocal
        }
      },
      { new: true, upsert: true }
    );

    snapshots.push(snapshot);
  }

  return {
    provider,
    generatedAt: new Date().toISOString(),
    configured: Boolean(providerApiKey),
    snapshots,
    skipped
  };
};

module.exports = {
  getTripFlightStatuses,
};
