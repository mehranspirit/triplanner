const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { formatOpeningHours, buildPlaceContactInfo } = require('./placesFormatting');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const AUTOCOMPLETE_FIELD_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text.text',
  'suggestions.placePrediction.structuredFormat.mainText.text',
  'suggestions.placePrediction.structuredFormat.secondaryText.text',
  'suggestions.placePrediction.types',
].join(',');
const PLACE_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'regularOpeningHours',
].join(',');

const summarizeInput = (input) => {
  const text = String(input).trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

const buildGoogleHeaders = (fieldMask) => ({
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
  'X-Goog-FieldMask': fieldMask,
});

const mapPlaceDetails = (place) => {
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const openingHours = formatOpeningHours(place.regularOpeningHours);
  const website = place.websiteUri || undefined;
  const contactInfo = buildPlaceContactInfo(place);

  return {
    placeId: place.id,
    name: place.displayName?.text || '',
    formattedAddress: place.formattedAddress || '',
    lat,
    lng,
    types: place.types || [],
    website,
    openingHours,
    contactInfo,
  };
};

const autocompletePlaces = async (input, options = {}) => {
  const trimmedInput = String(input || '').trim();
  if (!trimmedInput) {
    return [];
  }

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Places autocomplete skipped: missing GOOGLE_MAPS_API_KEY');
    return [];
  }

  const body = { input: trimmedInput };
  const sessionToken = String(options.sessionToken || '').trim();
  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  const lat = Number(options.lat);
  const lng = Number(options.lng);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    body.locationBias = {
      circle: {
        center: {
          latitude: lat,
          longitude: lng,
        },
        radius: Number(options.radius) || 50000,
      },
    };
  }

  logger.info('Places autocomplete request', {
    input: summarizeInput(trimmedInput),
    hasSessionToken: Boolean(sessionToken),
  });

  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: buildGoogleHeaders(AUTOCOMPLETE_FIELD_MASK),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.warn('Places autocomplete HTTP error', {
      input: summarizeInput(trimmedInput),
      status: response.status,
      errorBody: errorBody.slice(0, 300),
    });
    return [];
  }

  const data = await response.json();
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  return suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .slice(0, 8)
    .map((prediction) => ({
      placeId: prediction.placeId,
      description: prediction.text?.text || '',
      mainText: prediction.structuredFormat?.mainText?.text
        || prediction.text?.text
        || '',
      secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
      types: prediction.types || [],
    }));
};

const getPlaceDetails = async (placeId, options = {}) => {
  const normalizedPlaceId = String(placeId || '').trim();
  if (!normalizedPlaceId) {
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Place details skipped: missing GOOGLE_MAPS_API_KEY');
    return null;
  }

  const sessionToken = String(options.sessionToken || '').trim();
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`);
  if (sessionToken) {
    url.searchParams.set('sessionToken', sessionToken);
  }

  logger.info('Place details request', {
    placeId: normalizedPlaceId,
    hasSessionToken: Boolean(sessionToken),
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildGoogleHeaders(PLACE_DETAILS_FIELD_MASK),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.warn('Place details HTTP error', {
      placeId: normalizedPlaceId,
      status: response.status,
      errorBody: errorBody.slice(0, 300),
    });
    return null;
  }

  const place = await response.json();
  return mapPlaceDetails(place);
};

module.exports = {
  autocompletePlaces,
  getPlaceDetails,
  mapPlaceDetails,
};
