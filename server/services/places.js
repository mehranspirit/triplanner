const fetch = require('node-fetch');
const logger = require('../utils/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const summarizeInput = (input) => {
  const text = String(input).trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
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

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', trimmedInput);
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const lat = Number(options.lat);
  const lng = Number(options.lng);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(options.radius || 50000));
  }

  logger.info('Places autocomplete request', { input: summarizeInput(trimmedInput) });

  const response = await fetch(url.toString());
  if (!response.ok) {
    logger.warn('Places autocomplete HTTP error', {
      input: summarizeInput(trimmedInput),
      status: response.status,
    });
    return [];
  }

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    logger.warn('Places autocomplete failed', {
      input: summarizeInput(trimmedInput),
      status: data.status,
      errorMessage: data.error_message,
    });
    return [];
  }

  const predictions = Array.isArray(data.predictions) ? data.predictions : [];

  return predictions.slice(0, 8).map((prediction) => ({
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text || prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text || '',
    types: prediction.types || [],
  }));
};

const getPlaceDetails = async (placeId) => {
  const normalizedPlaceId = String(placeId || '').trim();
  if (!normalizedPlaceId) {
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Place details skipped: missing GOOGLE_MAPS_API_KEY');
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', normalizedPlaceId);
  url.searchParams.set(
    'fields',
    'place_id,name,formatted_address,geometry,types',
  );
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  logger.info('Place details request', { placeId: normalizedPlaceId });

  const response = await fetch(url.toString());
  if (!response.ok) {
    logger.warn('Place details HTTP error', {
      placeId: normalizedPlaceId,
      status: response.status,
    });
    return null;
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.result) {
    logger.warn('Place details failed', {
      placeId: normalizedPlaceId,
      status: data.status,
      errorMessage: data.error_message,
    });
    return null;
  }

  const { result } = data;
  const lat = Number(result.geometry?.location?.lat);
  const lng = Number(result.geometry?.location?.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return {
    placeId: result.place_id,
    name: result.name,
    formattedAddress: result.formatted_address,
    lat,
    lng,
    types: result.types || [],
  };
};

module.exports = {
  autocompletePlaces,
  getPlaceDetails,
};
