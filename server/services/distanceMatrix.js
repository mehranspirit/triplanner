const fetch = require('node-fetch');
const logger = require('../utils/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

const formatLocation = (coords, query) => {
  if (coords?.lat != null && coords?.lng != null) {
    return `${coords.lat},${coords.lng}`;
  }
  if (query) return query;
  return null;
};

const formatDuration = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`;
};

const formatDistanceMeters = (meters) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const fetchMatrixRow = async (origin, destinations, mode) => {
  if (!GOOGLE_MAPS_API_KEY || !origin || destinations.length === 0) {
    return null;
  }

  const url = new URL(DISTANCE_MATRIX_URL);
  url.searchParams.set('origins', origin);
  url.searchParams.set('destinations', destinations.join('|'));
  url.searchParams.set('mode', mode);
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Distance Matrix request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.status !== 'OK') {
    throw new Error(`Distance Matrix error: ${payload.status}`);
  }

  return payload.rows?.[0]?.elements || [];
};

const getTravelTimesFromReference = async (referencePoint, destinations) => {
  const origin = formatLocation(referencePoint?.coords, referencePoint?.mapsQuery);
  const destinationEntries = destinations
    .map((entry) => ({
      eventId: entry.eventId,
      location: formatLocation(entry.coords, entry.mapsQuery),
    }))
    .filter((entry) => entry.location);

  if (!origin || destinationEntries.length === 0) {
    return new Map();
  }

  const locationList = destinationEntries.map((entry) => entry.location);

  try {
    const [drivingElements, transitElements] = await Promise.all([
      fetchMatrixRow(origin, locationList, 'driving').catch((error) => {
        logger.warn('Driving distance matrix failed:', error.message);
        return null;
      }),
      fetchMatrixRow(origin, locationList, 'transit').catch((error) => {
        logger.warn('Transit distance matrix failed:', error.message);
        return null;
      }),
    ]);

    const results = new Map();

    destinationEntries.forEach((entry, index) => {
      const driving = drivingElements?.[index];
      const transit = transitElements?.[index];

      results.set(entry.eventId, {
        driveTimeLabel: driving?.status === 'OK'
          ? `${formatDuration(driving.duration?.value)} drive · ${formatDistanceMeters(driving.distance?.value)}`
          : null,
        transitTimeLabel: transit?.status === 'OK'
          ? `${formatDuration(transit.duration?.value)} transit · ${formatDistanceMeters(transit.distance?.value)}`
          : null,
      });
    });

    return results;
  } catch (error) {
    logger.warn('Distance matrix lookup failed:', error.message);
    return new Map();
  }
};

const STATIC_MAP_COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'yellow'];

const buildStaticMapUrl = (referencePoint, optionMarkers) => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const markers = [];

  if (referencePoint?.coords) {
    markers.push({
      color: 'black',
      label: 'R',
      lat: referencePoint.coords.lat,
      lng: referencePoint.coords.lng,
    });
  }

  optionMarkers.forEach((option, index) => {
    if (!option.coords) return;
    markers.push({
      color: STATIC_MAP_COLORS[index % STATIC_MAP_COLORS.length],
      label: String.fromCharCode(65 + index),
      lat: option.coords.lat,
      lng: option.coords.lng,
    });
  });

  if (markers.length === 0) return null;

  const markerParams = markers.map((marker) => (
    `markers=color:${marker.color}%7Clabel:${marker.label}%7C${marker.lat},${marker.lng}`
  )).join('&');

  return `https://maps.googleapis.com/maps/api/staticmap?size=640x240&scale=2&maptype=roadmap&${markerParams}&key=${GOOGLE_MAPS_API_KEY}`;
};

module.exports = {
  getTravelTimesFromReference,
  buildStaticMapUrl,
  __test: {
    formatDuration,
    formatDistanceMeters,
  },
};
