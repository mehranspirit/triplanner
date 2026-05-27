const fetch = require('node-fetch');
const GeocodingResult = require('../models/GeocodingResult');
const Trip = require('../models/Trip');
const logger = require('../utils/logger');

const PRIMARY_PROVIDER = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const normalizeQuery = (query) => query.toLowerCase().replace(/\s+/g, ' ').trim();

const summarizeQuery = (query) => {
  const text = String(query).trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
};

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

const LOCATION_LABEL_SUFFIX_PATTERN = /\s+(guided tour|private tour|group tour|tour|experience|visit|excursion|activity|adventure|ticket|tickets|entry|day trip|stop|stopover)$/i;

const stripLocationLabelNoise = (label) => {
  if (!label || !String(label).trim()) return undefined;
  const stripped = String(label).replace(LOCATION_LABEL_SUFFIX_PATTERN, '').trim();
  return stripped || undefined;
};

const normalizeAirportQuery = (value) => {
  if (!value || !String(value).trim()) return undefined;
  const trimmed = String(value).trim();
  if (/^[A-Z]{3}$/i.test(trimmed)) {
    return `${trimmed.toUpperCase()} Airport`;
  }
  if (!/\bairport\b/i.test(trimmed)) {
    return `${trimmed} Airport`;
  }
  return trimmed;
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
    case 'destination': {
      const strippedPlaceName = stripLocationLabelNoise(event.placeName);
      return uniqueLocationQueries(
        event.address,
        event.location?.address,
        combineLocationParts(event.placeName, event.address),
        combineLocationParts(strippedPlaceName, event.address),
        strippedPlaceName,
        event.placeName
      );
    }
    case 'activity': {
      const strippedTitle = stripLocationLabelNoise(event.title);
      return uniqueLocationQueries(
        event.address,
        event.location?.address,
        combineLocationParts(event.title, event.address),
        combineLocationParts(strippedTitle, event.address),
        strippedTitle,
        event.title
      );
    }
    case 'arrival':
    case 'departure':
      return uniqueLocationQueries(
        normalizeAirportQuery(event.airport),
        event.airport
      );
    case 'flight':
      return uniqueLocationQueries(
        normalizeAirportQuery(event.departureAirport),
        event.departureAirport,
        normalizeAirportQuery(event.arrivalAirport),
        event.arrivalAirport
      );
    case 'train':
    case 'bus':
      return uniqueLocationQueries(
        event.departureStation,
        event.arrivalStation,
        combineLocationParts(event.departureStation, event.arrivalStation)
      );
    case 'rental_car':
      return uniqueLocationQueries(
        event.pickupLocation,
        event.dropoffLocation,
        combineLocationParts(event.pickupLocation, event.dropoffLocation)
      );
    default:
      return uniqueLocationQueries(event.location?.address);
  }
};

const EXACT_CONFIDENCE_THRESHOLD = 0.8;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const SAVE_MAX_RETRIES = 3;

const GOOGLE_LOCATION_TYPE_CONFIDENCE = {
  ROOFTOP: 0.95,
  RANGE_INTERPOLATED: 0.85,
  GEOMETRIC_CENTER: 0.75,
  APPROXIMATE: 0.55,
};

let lastNominatimRequestAt = 0;
const tripGeocodeLocks = new Map();

const getActivePrimaryProvider = () => {
  if (PRIMARY_PROVIDER === 'google' && GOOGLE_MAPS_API_KEY) {
    return 'google';
  }

  if (PRIMARY_PROVIDER === 'google' && !GOOGLE_MAPS_API_KEY) {
    logger.warn('GEOCODING_PROVIDER=google but GOOGLE_MAPS_API_KEY is missing; using nominatim');
  }

  return 'nominatim';
};

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

const geocodeWithGoogle = async (query) => {
  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Google geocode skipped: missing GOOGLE_MAPS_API_KEY', {
      query: summarizeQuery(query),
    });
    return null;
  }

  const querySummary = summarizeQuery(query);
  logger.info('Google geocode request', { query: querySummary });

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    logger.warn('Google geocode HTTP error', { query: querySummary, status: response.status });
    return null;
  }

  const data = await response.json();

  if (data.status === 'ZERO_RESULTS') {
    logger.info('Google geocode returned no results', { query: querySummary });
    return null;
  }

  if (data.status === 'OVER_QUERY_LIMIT') {
    logger.warn('Google geocode rate limited', { query: querySummary });
    return null;
  }

  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    logger.warn('Google geocode failed', {
      query: querySummary,
      status: data.status,
      errorMessage: data.error_message,
    });
    return null;
  }

  const [result] = data.results;
  const locationType = result.geometry?.location_type || 'APPROXIMATE';
  let confidence = GOOGLE_LOCATION_TYPE_CONFIDENCE[locationType] || 0.7;

  if (result.partial_match) {
    confidence = Math.min(confidence, 0.65);
  }

  logger.info('Google geocode matched', {
    query: querySummary,
    lat: Number(result.geometry.location.lat),
    lng: Number(result.geometry.location.lng),
    locationType,
    confidence,
    partialMatch: !!result.partial_match,
    displayName: result.formatted_address,
  });

  return {
    lat: Number(result.geometry.location.lat),
    lng: Number(result.geometry.location.lng),
    displayName: result.formatted_address,
    confidence,
    raw: result,
  };
};

const geocodeWithNominatim = async (query) => {
  await waitForNominatimSlot();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'TripPlanner/1.0 (server-side geocoding)',
    },
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
    raw: result,
  };
};

const geocodeWithProvider = async (query, provider) => {
  if (provider === 'google') {
    return geocodeWithGoogle(query);
  }

  return geocodeWithNominatim(query);
};

const getProvidersToTry = () => [getActivePrimaryProvider()];

const cacheGeocodeResult = async (provider, query, normalizedQuery, result) => (
  GeocodingResult.findOneAndUpdate(
    { provider, normalizedQuery },
    {
      $setOnInsert: {
        provider,
        query,
        normalizedQuery,
        ...result,
      },
    },
    { new: true, upsert: true }
  )
);

const geocodeLocation = async (query) => {
  if (!query || !String(query).trim()) return null;

  const trimmedQuery = String(query).trim();
  const normalizedQuery = normalizeQuery(trimmedQuery);
  const querySummary = summarizeQuery(trimmedQuery);
  const providersToTry = getProvidersToTry();

  for (const provider of providersToTry) {
    const cached = await GeocodingResult.findOne({ provider, normalizedQuery });
    if (cached) {
      logger.debug('Geocode cache hit', { provider, query: querySummary });
      return cached;
    }
  }

  for (let index = 0; index < providersToTry.length; index += 1) {
    const provider = providersToTry[index];
    const fallbackProvider = providersToTry[index + 1];

    if (provider === 'google') {
      logger.info('Geocoding with Google', { query: querySummary });
    } else {
      logger.debug('Geocoding with provider', { provider, query: querySummary });
    }

    const result = await geocodeWithProvider(trimmedQuery, provider);
    if (!result || Number.isNaN(result.lat) || Number.isNaN(result.lng)) {
      if (fallbackProvider) {
        logger.info('Geocode provider missed, trying fallback', {
          query: querySummary,
          provider,
          fallbackProvider,
        });
      }
      continue;
    }

    logger.info('Geocode result cached', {
      provider,
      query: querySummary,
      lat: result.lat,
      lng: result.lng,
      confidence: result.confidence,
    });

    return cacheGeocodeResult(provider, trimmedQuery, normalizedQuery, result);
  }

  logger.warn('Geocode failed for all providers', {
    query: querySummary,
    providers: providersToTry,
  });

  return null;
};

const geocodeBestFromQueries = async (queries, options = {}) => {
  const { minScore = -1, event = null } = options;
  const orderedQueries = event ? orderQueriesForEvent(event, queries) : queries;

  let bestGeocoded = null;
  let bestQuery = null;
  let bestScore = minScore;
  let queriesTried = 0;
  const attempts = [];

  for (const query of orderedQueries) {
    const geocoded = await geocodeLocation(query);
    queriesTried += 1;

    if (!geocoded) {
      attempts.push({
        query,
        matched: false,
      });
      logger.info('Geocode fallback missed', {
        eventId: event?.id,
        query: summarizeQuery(query),
        attempt: queriesTried,
        totalQueries: orderedQueries.length,
      });
      continue;
    }

    const score = scoreGeocodeCandidate(geocoded);
    const isBest = score > bestScore;
    attempts.push({
      query,
      matched: true,
      score,
      confidence: Number(geocoded.confidence) || 0,
      provider: geocoded.provider,
      selected: isBest,
    });

    if (isBest) {
      attempts.forEach((attempt) => {
        if (attempt.query !== query) {
          attempt.selected = false;
        }
      });
      bestScore = score;
      bestGeocoded = geocoded;
      bestQuery = query;
    }

    logger.info('Geocode fallback scored', {
      eventId: event?.id,
      query: summarizeQuery(query),
      score,
      confidence: Number(geocoded.confidence) || 0,
      provider: geocoded.provider,
      selected: isBest,
      attempt: queriesTried,
      totalQueries: orderedQueries.length,
    });

    if (bestScore >= 1000 + EXACT_CONFIDENCE_THRESHOLD) {
      break;
    }
  }

  if (bestQuery) {
    logger.info('Geocode best fallback selected', {
      eventId: event?.id,
      query: summarizeQuery(bestQuery),
      score: bestScore,
      queriesTried,
    });
  }

  return {
    geocoded: bestGeocoded,
    usedQuery: bestQuery,
    score: bestScore,
    queriesTried,
    attempts,
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
          queryAttempts: bestMatch.attempts,
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
        queryAttempts: bestMatch.attempts,
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
      queryAttempts: bestMatch.attempts,
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

  logger.info('Trip geocode batch completed', {
    tripId: String(trip._id),
    eventsProcessed: events.length,
    updatedCount,
    successCount: results.filter((result) => result.success).length,
    skippedCount: results.filter((result) => result.skipped).length,
  });

  return {
    updatedCount,
    results,
  };
};

const previewFromQueries = async (queries) => {
  if (!queries || queries.length === 0) {
    return {
      suggestions: [],
      queryAttempts: [],
      recommended: null,
      queriesTried: 0,
    };
  }

  const attempts = [];
  const suggestionByKey = new Map();

  for (const query of queries) {
    const geocoded = await geocodeLocation(query);

    if (!geocoded) {
      attempts.push({ query, matched: false });
      continue;
    }

    const confidence = Number(geocoded.confidence) || 0;
    const score = scoreGeocodeCandidate(geocoded);
    const quality = getGeocodeQuality(confidence);
    const provider = geocoded.provider || getActivePrimaryProvider();
    const coordKey = `${Number(geocoded.lat).toFixed(5)},${Number(geocoded.lng).toFixed(5)}`;

    const suggestion = {
      query,
      lat: geocoded.lat,
      lng: geocoded.lng,
      displayName: geocoded.displayName || query,
      confidence,
      quality,
      score,
      provider,
    };

    const existing = suggestionByKey.get(coordKey);
    if (!existing || existing.score < score) {
      suggestionByKey.set(coordKey, suggestion);
    }

    attempts.push({
      query,
      matched: true,
      score,
      confidence,
      provider,
      selected: false,
    });
  }

  const suggestions = [...suggestionByKey.values()].sort((left, right) => right.score - left.score);

  if (suggestions.length > 0) {
    suggestions[0].recommended = true;
    const bestQuery = suggestions[0].query;
    for (const attempt of attempts) {
      if (attempt.matched && attempt.query === bestQuery) {
        attempt.selected = true;
      }
    }
  }

  return {
    suggestions,
    queryAttempts: attempts,
    recommended: suggestions[0] || null,
    queriesTried: queries.length,
  };
};

const TRANSPORT_DUAL_ENDPOINT_TYPES = new Set(['flight', 'train', 'bus', 'rental_car']);

const getTransportEndpointQueryList = (event, endpoint) => {
  switch (event.type) {
    case 'flight': {
      const raw = endpoint === 'departure' ? event.departureAirport : event.arrivalAirport;
      return uniqueLocationQueries(normalizeAirportQuery(raw), raw);
    }
    case 'train':
    case 'bus': {
      const raw = endpoint === 'departure' ? event.departureStation : event.arrivalStation;
      if (!raw || !String(raw).trim()) return [];
      const trimmed = String(raw).trim();
      if (event.type === 'train' && !/\btrain station\b/i.test(trimmed)) {
        return uniqueLocationQueries(`${trimmed} train station`, trimmed);
      }
      return uniqueLocationQueries(trimmed);
    }
    case 'rental_car': {
      const raw = endpoint === 'departure' ? event.pickupLocation : event.dropoffLocation;
      return uniqueLocationQueries(raw);
    }
    default:
      return [];
  }
};

const getTransportEndpointLabel = (event, endpoint) => {
  switch (event.type) {
    case 'flight':
      return endpoint === 'departure' ? 'Departure airport' : 'Arrival airport';
    case 'train':
    case 'bus':
      return endpoint === 'departure' ? 'Departure station' : 'Arrival station';
    case 'rental_car':
      return endpoint === 'departure' ? 'Pickup location' : 'Drop-off location';
    default:
      return endpoint === 'departure' ? 'Departure' : 'Arrival';
  }
};

const previewTransportEventGeocode = async (event) => {
  const departureQueries = getTransportEndpointQueryList(event, 'departure');
  const arrivalQueries = getTransportEndpointQueryList(event, 'arrival');
  const [departurePreview, arrivalPreview] = await Promise.all([
    previewFromQueries(departureQueries),
    previewFromQueries(arrivalQueries),
  ]);

  return {
    eventId: event.id,
    mode: 'transport',
    departure: {
      endpoint: 'departure',
      label: getTransportEndpointLabel(event, 'departure'),
      query: departureQueries[0],
      ...departurePreview,
    },
    arrival: {
      endpoint: 'arrival',
      label: getTransportEndpointLabel(event, 'arrival'),
      query: arrivalQueries[0],
      ...arrivalPreview,
    },
  };
};

const previewEventGeocode = async (event) => {
  if (TRANSPORT_DUAL_ENDPOINT_TYPES.has(event.type)) {
    return previewTransportEventGeocode(event);
  }

  const queries = orderQueriesForEvent(event, getEventLocationQueries(event));

  if (queries.length === 0) {
    return {
      eventId: event.id,
      mode: 'single',
      suggestions: [],
      queryAttempts: [],
      recommended: null,
      queriesTried: 0,
    };
  }

  const preview = await previewFromQueries(queries);

  return {
    eventId: event.id,
    mode: 'single',
    ...preview,
  };
};

const normalizeAppliedLocation = (locationUpdate, userId) => ({
  lat: Number(locationUpdate.lat),
  lng: Number(locationUpdate.lng),
  address: locationUpdate.address || locationUpdate.displayName,
  quality: locationUpdate.quality || getGeocodeQuality(Number(locationUpdate.confidence) || 0),
  source: locationUpdate.source || 'geocoded',
  query: locationUpdate.query,
  confidence: locationUpdate.confidence,
  placeId: locationUpdate.placeId,
  confirmedAt: new Date().toISOString(),
  confirmedBy: String(userId),
});

const getConfirmedLocationLabel = (locationUpdate) => {
  const label = locationUpdate?.address || locationUpdate?.displayName;
  if (!label || !String(label).trim()) {
    return null;
  }
  return String(label).trim();
};

const syncEventLocationLabelField = (event, endpoint, confirmedLabel) => {
  if (!confirmedLabel) {
    return;
  }

  if (endpoint === 'departure') {
    switch (event.type) {
      case 'flight':
        event.departureAirport = confirmedLabel;
        break;
      case 'train':
      case 'bus':
        event.departureStation = confirmedLabel;
        break;
      case 'rental_car':
        event.pickupLocation = confirmedLabel;
        break;
      default:
        break;
    }
    return;
  }

  if (endpoint === 'arrival') {
    switch (event.type) {
      case 'flight':
        event.arrivalAirport = confirmedLabel;
        break;
      case 'train':
      case 'bus':
        event.arrivalStation = confirmedLabel;
        break;
      case 'rental_car':
        event.dropoffLocation = confirmedLabel;
        break;
      default:
        break;
    }
    return;
  }

  switch (event.type) {
    case 'activity':
    case 'stay':
    case 'destination':
      event.address = confirmedLabel;
      break;
    case 'arrival':
    case 'departure':
      event.airport = confirmedLabel;
      break;
    default:
      break;
  }
};

const applyEventLocation = async (tripId, eventId, locationUpdate, userId) => {
  const isTransportApply = !!(locationUpdate?.departure || locationUpdate?.arrival);

  return withTripGeocodeLock(tripId, async () => {
    for (let attempt = 0; attempt < SAVE_MAX_RETRIES; attempt += 1) {
      const trip = await Trip.findById(tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      const access = trip.hasAccess(userId);
      if (!access || (access !== 'owner' && access !== 'editor')) {
        throw new Error('Access denied');
      }

      const event = (trip.events || []).find((item) => item.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      if (isTransportApply) {
        if (locationUpdate.departure) {
          event.departureLocation = {
            ...(event.departureLocation || { lat: 0, lng: 0 }),
            ...normalizeAppliedLocation(locationUpdate.departure, userId),
          };
          syncEventLocationLabelField(
            event,
            'departure',
            getConfirmedLocationLabel(locationUpdate.departure),
          );
        }
        if (locationUpdate.arrival) {
          event.arrivalLocation = {
            ...(event.arrivalLocation || { lat: 0, lng: 0 }),
            ...normalizeAppliedLocation(locationUpdate.arrival, userId),
          };
          syncEventLocationLabelField(
            event,
            'arrival',
            getConfirmedLocationLabel(locationUpdate.arrival),
          );
        }
      } else {
        const { lat, lng } = locationUpdate || {};
        if (lat === undefined || lng === undefined || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
          throw new Error('Valid lat and lng are required');
        }

        event.location = {
          ...(event.location || { lat: 0, lng: 0 }),
          ...normalizeAppliedLocation(locationUpdate, userId),
        };
        syncEventLocationLabelField(
          event,
          null,
          getConfirmedLocationLabel(locationUpdate),
        );
      }

      trip.markModified('events');

      try {
        await trip.save();
        return { trip, event };
      } catch (error) {
        if (error.name !== 'VersionError' || attempt === SAVE_MAX_RETRIES - 1) {
          throw error;
        }
      }
    }

    throw new Error('Failed to apply event location');
  });
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
  previewEventGeocode,
  applyEventLocation,
  getEventLocationQuery,
  getEventLocationQueries,
  withTripGeocodeLock,
  getActivePrimaryProvider,
};
