const { geocodeLocation } = require('./geocoding');
const { sortEventsByStart } = require('../utils/eventTime');
const {
  MIN_TRANSFER_DISTANCE_KM,
  groupEventsByTimelineDateKeys,
  resolvePreviousTimelineEvent,
  shouldSkipInboundTimelineLeg,
  computeGapMinutes,
} = require('../utils/timelineTransferLegLogic');

const DUAL_ENDPOINT_TYPES = new Set(['flight', 'train', 'bus', 'rental_car']);

const endpointLocationHasCoordinates = (location) => (
  !!location
  && typeof location.lat === 'number'
  && typeof location.lng === 'number'
  && location.lat !== 0
  && location.lng !== 0
);

const getUsableEventLocation = (event) => {
  if (!endpointLocationHasCoordinates(event.location)) return null;
  return { lat: event.location.lat, lng: event.location.lng };
};

const getTransportEndpointLocation = (event, endpoint) => {
  if (!DUAL_ENDPOINT_TYPES.has(event.type)) return undefined;
  return endpoint === 'departure' ? event.departureLocation : event.arrivalLocation;
};

const getFlightAirportQuery = (event, endpoint) => {
  if (event.type !== 'flight') return null;
  const code = endpoint === 'departure' ? event.departureAirport : event.arrivalAirport;
  if (!code?.trim()) return null;
  const trimmed = code.trim();
  return /^[A-Z]{3}$/i.test(trimmed) ? `${trimmed.toUpperCase()} Airport` : trimmed;
};

const getRoutePoint = async (event, side, geocodeCache) => {
  if (DUAL_ENDPOINT_TYPES.has(event.type)) {
    const endpoint = side === 'from' ? 'arrival' : 'departure';
    const stored = getTransportEndpointLocation(event, endpoint);
    if (endpointLocationHasCoordinates(stored)) {
      return { lat: stored.lat, lng: stored.lng };
    }

    if (event.type === 'flight') {
      const query = getFlightAirportQuery(event, endpoint);
      if (!query) return null;
      if (geocodeCache.has(query)) return geocodeCache.get(query);
      const geocoded = await geocodeLocation(query);
      const point = geocoded?.lat != null && geocoded?.lng != null
        ? { lat: geocoded.lat, lng: geocoded.lng }
        : null;
      geocodeCache.set(query, point);
      return point;
    }

    return null;
  }

  return getUsableEventLocation(event);
};

const getDistanceKm = (from, to) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildLocationKey = (fromPoint, toPoint) => (
  `${fromPoint.lat.toFixed(5)},${fromPoint.lng.toFixed(5)}|${toPoint.lat.toFixed(5)},${toPoint.lng.toFixed(5)}`
);

const discoverTimelineTransferLegs = async (events) => {
  const itineraryEvents = events.filter((event) => event.status !== 'alternative');
  const sortedEvents = sortEventsByStart(itineraryEvents);
  const groupedEvents = groupEventsByTimelineDateKeys(itineraryEvents);
  const geocodeCache = new Map();
  const legs = [];

  for (const [dayKey, dateEvents] of Object.entries(groupedEvents)) {
    const daySorted = sortEventsByStart(dateEvents);

    for (let eventIndex = 0; eventIndex < daySorted.length; eventIndex += 1) {
      const event = daySorted[eventIndex];
      if (shouldSkipInboundTimelineLeg(event, dayKey)) continue;

      const resolved = resolvePreviousTimelineEvent(
        sortedEvents,
        daySorted,
        eventIndex,
        event,
        dayKey,
      );

      if (!resolved) continue;

      const { previousEvent, legTimes } = resolved;

      const fromPoint = await getRoutePoint(previousEvent, 'from', geocodeCache);
      const toPoint = await getRoutePoint(event, 'to', geocodeCache);
      if (!fromPoint || !toPoint) continue;

      const distanceKm = getDistanceKm(fromPoint, toPoint);
      if (distanceKm < MIN_TRANSFER_DISTANCE_KM) continue;

      legs.push({
        fromEventId: previousEvent.id,
        toEventId: event.id,
        dayKey,
        fromPoint,
        toPoint,
        locationKey: buildLocationKey(fromPoint, toPoint),
        gapMinutes: computeGapMinutes(legTimes),
        flexibleDeparture: legTimes.flexibleDeparture,
      });
    }
  }

  return legs;
};

module.exports = {
  discoverTimelineTransferLegs,
  buildLocationKey,
  __test: {
    getRoutePoint,
    getDistanceKm,
    shouldSkipInboundTimelineLeg,
    resolvePreviousTimelineEvent,
    groupEventsByTimelineDateKeys,
  },
};
