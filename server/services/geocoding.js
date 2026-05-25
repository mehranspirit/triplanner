const fetch = require('node-fetch');
const GeocodingResult = require('../models/GeocodingResult');
const Trip = require('../models/Trip');

const PROVIDER = 'nominatim';

const normalizeQuery = (query) => query.toLowerCase().replace(/\s+/g, ' ').trim();

const hasUsableLocation = (event) => {
  return !!event.location && Number(event.location.lat) !== 0 && Number(event.location.lng) !== 0;
};

const hasExactLocation = (event) => {
  return hasUsableLocation(event) && event.location.quality === 'exact';
};

const shouldRetryGeocoding = (event) => {
  if (!hasUsableLocation(event)) {
    return true;
  }

  const quality = event.location?.quality;
  return quality === 'inferred' || quality === 'unresolved';
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

const EXACT_CONFIDENCE_THRESHOLD = 0.8;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const SAVE_MAX_RETRIES = 3;

let lastNominatimRequestAt = 0;
const tripGeocodeLocks = new Map();

const orderQueriesForEvent = (event, queries) => {
  const storedQuery = event.location?.query;
  if (!storedQuery || !String(storedQuery).trim()) {
    return queries;
  }

  const normalizedStored = normalizeQuery(storedQuery);
  const matched = queries.filter((query) => normalizeQuery(query) === normalizedStored);
  const remaining = queries.filter((query) => normalizeQuery(query) !== normalizedStored);
  return [...matched, ...remaining];
};

const waitForNominatimSlot = async () => {
  const now = Date.now();
  const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimRequestAt = Date.now();
};

const getGeocodeQuality = (confidence) => (
  confidence >= EXACT_CONFIDENCE_THRESHOLD ? 'exact' : 'inferred'
);

const scoreGeocodeCandidate = (geocoded) => {
  const confidence = Number(geocoded?.confidence) || 0;
  const quality = getGeocodeQuality(confidence);
  return quality === 'exact' ? 1000 + confidence : confidence;
};

const getStoredGeocodeScore = (event) => {
  if (!hasUsableLocation(event)) {
    return -1;
  }

  const quality = event.location?.quality;
  const confidence = Number(event.location?.confidence) || 0;

  if (quality === 'exact') {
    return 1000 + confidence;
  }

  if (quality === 'inferred') {
    return confidence;
  }

  return -1;
};

const geocodeWithNominatim = async (query) => {
  await waitForNominatimSlot();

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
    if (response.status === 429) {
      console.warn('Nominatim rate limited geocode request', { query });
      return null;
    }
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

const geocodeBestFromQueries = async (queries, options = {}) => {
  const { minScore = -1, event = null } = options;
  const orderedQueries = event ? orderQueriesForEvent(event, queries) : queries;

  let bestGeocoded = null;
  let bestQuery = null;
  let bestScore = minScore;
  let queriesTried = 0;

  for (const query of orderedQueries) {
    const geocoded = await geocodeLocation(query);
    queriesTried += 1;
    if (!geocoded) {
      continue;
    }

    const score = scoreGeocodeCandidate(geocoded);
    if (score > bestScore) {
      bestScore = score;
      bestGeocoded = geocoded;
      bestQuery = query;
    }

    if (bestScore >= 1000 + EXACT_CONFIDENCE_THRESHOLD) {
      break;
    }
  }

  return {
    geocoded: bestGeocoded,
    usedQuery: bestQuery,
    score: bestScore,
    queriesTried,
  };
};

const resolveEventGeocode = async (event) => {
  const queries = getEventLocationQueries(event);
  const primaryQuery = queries[0];

  if (queries.length === 0) {
    if (!hasUsableLocation(event)) {
      return {
        update: {
          lat: 0,
          lng: 0,
          quality: 'missing',
          source: 'unknown',
        },
        result: {
          eventId: event.id,
          skipped: true,
          reason: 'no_query',
        },
      };
    }

    return {
      result: {
        eventId: event.id,
        skipped: true,
        reason: 'no_query',
      },
    };
  }

  if (hasExactLocation(event)) {
    return {
      result: {
        eventId: event.id,
        skipped: true,
        reason: 'already_geocoded',
      },
    };
  }

  if (hasUsableLocation(event) && !event.location.quality) {
    return {
      update: {
        ...(event.location || { lat: 0, lng: 0 }),
        quality: 'exact',
        source: event.location?.source || 'manual',
      },
      result: {
        eventId: event.id,
        skipped: true,
        reason: 'already_geocoded',
      },
    };
  }

  if (!shouldRetryGeocoding(event)) {
    return {
      result: {
        eventId: event.id,
        skipped: true,
        reason: 'already_geocoded',
      },
    };
  }

  const existingScore = getStoredGeocodeScore(event);
  const bestMatch = await geocodeBestFromQueries(queries, {
    minScore: existingScore,
    event,
  });

  if (!bestMatch.geocoded || bestMatch.score <= existingScore) {
    if (!bestMatch.geocoded && !hasUsableLocation(event)) {
      return {
        update: {
          ...(event.location || { lat: 0, lng: 0 }),
          quality: 'unresolved',
          source: 'geocoded',
          query: primaryQuery,
        },
        result: {
          eventId: event.id,
          query: primaryQuery,
          success: false,
          queriesTried: bestMatch.queriesTried,
        },
      };
    }

    return {
      result: {
        eventId: event.id,
        skipped: true,
        reason: 'no_improvement',
        query: bestMatch.usedQuery || event.location?.query || primaryQuery,
        queriesTried: bestMatch.queriesTried,
        location: event.location,
      },
    };
  }

  const { geocoded, usedQuery } = bestMatch;
  const confidence = Number(geocoded.confidence) || 0;
  const location = {
    lat: geocoded.lat,
    lng: geocoded.lng,
    address: geocoded.displayName || usedQuery,
    quality: getGeocodeQuality(confidence),
    source: 'geocoded',
    query: usedQuery,
    confidence,
  };

  return {
    update: location,
    result: {
      eventId: event.id,
      query: usedQuery,
      success: true,
      queriesTried: bestMatch.queriesTried,
      location,
    },
  };
};

const applyPendingGeocodeUpdates = (trip, pendingUpdates) => {
  let updatedCount = 0;

  for (const [eventId, locationUpdate] of pendingUpdates) {
    const event = (trip.events || []).find((item) => item.id === eventId);
    if (!event) continue;

    if (hasExactLocation(event)) continue;

    event.location = locationUpdate;
    updatedCount += 1;
  }

  return updatedCount;
};

const saveTripGeocodeUpdates = async (tripId, pendingUpdates) => {
  for (let attempt = 0; attempt < SAVE_MAX_RETRIES; attempt += 1) {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    const updatedCount = applyPendingGeocodeUpdates(trip, pendingUpdates);
    if (updatedCount === 0) {
      return { trip, updatedCount: 0 };
    }

    trip.markModified('events');
    try {
      await trip.save();
      return { trip, updatedCount };
    } catch (error) {
      if (error.name !== 'VersionError' || attempt === SAVE_MAX_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error('Failed to save geocoded event locations');
};

const geocodeTripEvents = async (trip, options = {}) => {
  const { eventIds } = options;
  const results = [];
  const pendingUpdates = new Map();

  const events = (trip.events || []).filter((event) => (
    !Array.isArray(eventIds) || eventIds.length === 0 || eventIds.includes(event.id)
  ));

  for (const event of events) {
    const { update, result } = await resolveEventGeocode(event);
    results.push(result);
    if (update) {
      pendingUpdates.set(event.id, update);
    }
  }

  if (pendingUpdates.size === 0) {
    return {
      updatedCount: 0,
      results,
    };
  }

  const { updatedCount } = await saveTripGeocodeUpdates(trip._id, pendingUpdates);

  return {
    updatedCount,
    results,
  };
};

const withTripGeocodeLock = async (tripId, fn) => {
  const tripKey = String(tripId);
  const previous = tripGeocodeLocks.get(tripKey) || Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  tripGeocodeLocks.set(tripKey, run);

  try {
    return await run;
  } finally {
    if (tripGeocodeLocks.get(tripKey) === run) {
      tripGeocodeLocks.delete(tripKey);
    }
  }
};

module.exports = {
  geocodeLocation,
  geocodeTripEvents,
  getEventLocationQuery,
  getEventLocationQueries,
  withTripGeocodeLock,
};
