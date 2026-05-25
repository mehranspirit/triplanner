const fetch = require('node-fetch');
const GeocodingResult = require('../models/GeocodingResult');

const PROVIDER = 'nominatim';

const normalizeQuery = (query) => query.toLowerCase().replace(/\s+/g, ' ').trim();

const hasUsableLocation = (event) => {
  return !!event.location && Number(event.location.lat) !== 0 && Number(event.location.lng) !== 0;
};

const setLocationQuality = (event, quality, extra = {}) => {
  event.location = {
    ...(event.location || { lat: 0, lng: 0 }),
    quality,
    ...extra
  };
};

const combineLocationParts = (...parts) => {
  const combined = parts.map((part) => (part ? String(part).trim() : '')).filter(Boolean).join(' ');
  return combined || undefined;
};

const uniqueLocationQueries = (...candidates) => {
  const seen = new Set();
  const queries = [];

  for (const candidate of candidates) {
    if (!candidate || !String(candidate).trim()) continue;
    const trimmed = String(candidate).trim();
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    queries.push(trimmed);
  }

  return queries;
};

const getEventLocationQuery = (event) => {
  return getEventLocationQueries(event)[0];
};

const getEventLocationQueries = (event) => {
  switch (event.type) {
    case 'stay':
      return uniqueLocationQueries(
        event.address,
        event.location?.address,
        combineLocationParts(event.accommodationName, event.address),
        event.accommodationName
      );
    case 'destination':
      return uniqueLocationQueries(
        event.address,
        event.location?.address,
        combineLocationParts(event.placeName, event.address),
        event.placeName
      );
    case 'activity':
      return uniqueLocationQueries(
        event.address,
        event.location?.address,
        combineLocationParts(event.title, event.address),
        event.title
      );
    case 'arrival':
    case 'departure':
      return uniqueLocationQueries(event.airport);
    case 'flight':
      return uniqueLocationQueries(event.departureAirport, event.arrivalAirport);
    case 'train':
    case 'bus':
      return uniqueLocationQueries(event.departureStation, event.arrivalStation);
    case 'rental_car':
      return uniqueLocationQueries(event.pickupLocation, event.dropoffLocation);
    default:
      return uniqueLocationQueries(event.location?.address);
  }
};

const geocodeWithNominatim = async (query) => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'TripPlanner/1.0 (server-side geocoding)'
    }
  });

  if (!response.ok) {
    throw new Error(`Geocoding provider returned ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const [result] = data;
  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    displayName: result.display_name,
    confidence: result.importance ? Math.min(1, Number(result.importance)) : 0.7,
    raw: result
  };
};

const geocodeLocation = async (query) => {
  if (!query || !String(query).trim()) return null;

  const normalizedQuery = normalizeQuery(query);
  const cached = await GeocodingResult.findOne({ provider: PROVIDER, normalizedQuery });
  if (cached) {
    return cached;
  }

  const result = await geocodeWithNominatim(query);
  if (!result || Number.isNaN(result.lat) || Number.isNaN(result.lng)) {
    return null;
  }

  return GeocodingResult.findOneAndUpdate(
    { provider: PROVIDER, normalizedQuery },
    {
      $setOnInsert: {
        provider: PROVIDER,
        query,
        normalizedQuery,
        ...result
      }
    },
    { new: true, upsert: true }
  );
};

const geocodeTripEvents = async (trip) => {
  const results = [];
  let updatedCount = 0;

  for (const event of trip.events || []) {
    const queries = getEventLocationQueries(event);
    const primaryQuery = queries[0];

    if (hasUsableLocation(event) || queries.length === 0) {
      if (hasUsableLocation(event) && !event.location.quality) {
        setLocationQuality(event, 'exact', {
          source: event.location.source || 'manual'
        });
        updatedCount += 1;
      }

      if (queries.length === 0 && !hasUsableLocation(event)) {
        setLocationQuality(event, 'missing', {
          source: 'unknown'
        });
        updatedCount += 1;
      }

      results.push({
        eventId: event.id,
        skipped: true,
        reason: hasUsableLocation(event) ? 'already_geocoded' : 'no_query'
      });
      continue;
    }

    let geocoded = null;
    let usedQuery = null;
    for (const query of queries) {
      geocoded = await geocodeLocation(query);
      if (geocoded) {
        usedQuery = query;
        break;
      }
    }

    if (!geocoded) {
      setLocationQuality(event, 'unresolved', {
        source: 'geocoded',
        query: primaryQuery
      });
      updatedCount += 1;
      results.push({ eventId: event.id, query: primaryQuery, success: false });
      continue;
    }

    event.location = {
      lat: geocoded.lat,
      lng: geocoded.lng,
      address: geocoded.displayName || usedQuery,
      quality: geocoded.confidence >= 0.8 ? 'exact' : 'inferred',
      source: 'geocoded',
      query: usedQuery,
      confidence: geocoded.confidence
    };
    updatedCount += 1;
    results.push({
      eventId: event.id,
      query: usedQuery,
      success: true,
      location: event.location
    });
  }

  if (updatedCount > 0) {
    trip.markModified('events');
    await trip.save();
  }

  return {
    updatedCount,
    results
  };
};

module.exports = {
  geocodeLocation,
  geocodeTripEvents,
  getEventLocationQuery,
  getEventLocationQueries,
};
