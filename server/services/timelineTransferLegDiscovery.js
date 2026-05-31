const { geocodeLocation } = require('./geocoding');
const {
  getEventStart,
  getEventEnd,
  sortEventsByStart,
  isSameLocalDay,
} = require('../utils/eventTime');

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const eachDayOfInterval = ({ start, end }) => {
  const days = [];
  const cursor = startOfDay(start);
  const rangeEnd = startOfDay(end);

  while (cursor <= rangeEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const MIN_TRANSFER_DISTANCE_KM = 2;
const MULTIDAY_EVENT_TYPES = new Set(['stay', 'rental_car']);
const DUAL_ENDPOINT_TYPES = new Set(['flight', 'train', 'bus', 'rental_car']);

const parseTimelineDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const eventSpansMultipleDays = (event) => MULTIDAY_EVENT_TYPES.has(event.type);

const getEventTimelineDateKeys = (event) => {
  const start = getEventStart(event);
  if (!start) return [];

  if (!eventSpansMultipleDays(event)) {
    return [formatDateKey(startOfDay(start))];
  }

  const end = getEventEnd(event);
  if (!end) {
    return [formatDateKey(startOfDay(start))];
  }

  const rangeStart = startOfDay(start <= end ? start : end);
  const rangeEnd = startOfDay(start <= end ? end : start);

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(
    (date) => formatDateKey(date),
  );
};

const eventOccursOnDayKey = (event, dayKey) => getEventTimelineDateKeys(event).includes(dayKey);

const groupEventsByTimelineDateKeys = (events) => (
  events.reduce((groups, event) => {
    getEventTimelineDateKeys(event).forEach((dateKey) => {
      if (!groups[dateKey]) groups[dateKey] = [];
      if (!groups[dateKey].some((existing) => existing.id === event.id)) {
        groups[dateKey].push(event);
      }
    });
    return groups;
  }, {})
);

const getMultidayEventDayRole = (event, dayKey) => {
  if (!eventSpansMultipleDays(event)) return null;

  const keys = getEventTimelineDateKeys(event);
  if (!keys.includes(dayKey)) return null;
  if (keys.length === 1) return 'single';

  const startKey = keys[0];
  const endKey = keys[keys.length - 1];

  if (dayKey === startKey && dayKey === endKey) return 'single';
  if (dayKey === startKey) return 'start';
  if (dayKey === endKey) return 'end';
  return 'middle';
};

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

const getTimelineDayLegTimes = (from, to, dayKey) => {
  const dayDate = parseTimelineDateKey(dayKey);
  if (!dayDate) return null;

  const toStartRaw = getEventStart(to);
  if (!toStartRaw) return null;

  const fromRole = getMultidayEventDayRole(from, dayKey);
  let fromEnd = null;

  if (fromRole === 'middle') {
    fromEnd = startOfDay(dayDate);
  } else if (fromRole === 'start') {
    fromEnd = getEventStart(from) ?? startOfDay(dayDate);
  } else {
    fromEnd = getEventEnd(from);
  }

  if (!fromEnd) return null;

  const toRole = getMultidayEventDayRole(to, dayKey);
  let toStart = toStartRaw;

  if (toRole === 'end') {
    toStart = getEventEnd(to) ?? toStartRaw;
  } else if (toRole === 'middle') {
    toStart = startOfDay(dayDate);
  }

  if (!isSameLocalDay(fromEnd, toStart)) return null;

  return { fromEnd, toStart };
};

const getCrossDayLegTimes = (from, to, viewDayKey) => {
  const dayDate = parseTimelineDateKey(viewDayKey);
  if (!dayDate) return null;

  const toStartRaw = getEventStart(to);
  if (!toStartRaw) return null;

  const toRole = getMultidayEventDayRole(to, viewDayKey);
  let toStart = toStartRaw;
  if (toRole === 'end') {
    toStart = getEventEnd(to) ?? toStartRaw;
  } else if (toRole === 'middle') {
    toStart = startOfDay(dayDate);
  }

  const fromEnd = getEffectiveEventEndForTransfer(from, toStart) ?? getEventEnd(from);
  if (!fromEnd || fromEnd.getTime() > toStart.getTime()) return null;

  return { fromEnd, toStart };
};

const getEffectiveEventEndForTransfer = (event, beforeTime) => {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  if (!start || !end || !beforeTime) return null;
  if (start.getTime() >= beforeTime.getTime()) return null;

  if (end.getTime() <= beforeTime.getTime()) {
    return end;
  }

  if (event.type === 'stay' || event.type === 'rental_car') {
    return beforeTime;
  }

  return null;
};

const TRANSPORT_INBOUND_TYPES = new Set(['flight', 'train', 'bus', 'arrival']);

const isTimelinePrimaryEvent = (event, dayKey) => {
  const role = getMultidayEventDayRole(event, dayKey);
  return role !== 'middle';
};

const needsCrossDayInboundLeg = (dayEvents, event, dayKey, eventIndex) => {
  if (eventIndex > 0) return false;

  const primaryEvents = dayEvents.filter((item) => isTimelinePrimaryEvent(item, dayKey));
  const isSparsePrimaryDay = primaryEvents.length === 1 && primaryEvents[0].id === event.id;
  if (!isSparsePrimaryDay) return false;

  if (TRANSPORT_INBOUND_TYPES.has(event.type)) return true;

  const role = getMultidayEventDayRole(event, dayKey);
  return role === 'start'
    || (role === 'single' && (event.type === 'stay' || event.type === 'rental_car'));
};

const findClosestPriorItineraryEvent = (events, current) => {
  const currentStart = getEventStart(current);
  if (!currentStart) return null;

  let bestMatch = null;
  let bestEndTime = Number.NEGATIVE_INFINITY;

  for (const candidate of events) {
    if (candidate.id === current.id || candidate.status === 'alternative') continue;

    const effectiveEnd = getEffectiveEventEndForTransfer(candidate, currentStart);
    if (!effectiveEnd) continue;

    if (effectiveEnd.getTime() > bestEndTime) {
      bestEndTime = effectiveEnd.getTime();
      bestMatch = candidate;
    }
  }

  return bestMatch;
};

const findPreviousItineraryEventForDay = (events, current, dayKey) => {
  if (!eventOccursOnDayKey(current, dayKey)) return null;

  const currentStart = getEventStart(current);
  if (!currentStart) return null;

  let bestMatch = null;
  let bestEndTime = Number.NEGATIVE_INFINITY;

  for (const candidate of events) {
    if (candidate.id === current.id || candidate.status === 'alternative') continue;

    const candidateEnd = getEventEnd(candidate);
    if (!candidateEnd) continue;
    if (!isSameLocalDay(candidateEnd, currentStart)) continue;
    if (candidateEnd.getTime() > currentStart.getTime()) continue;

    if (candidateEnd.getTime() > bestEndTime) {
      bestEndTime = candidateEnd.getTime();
      bestMatch = candidate;
    }
  }

  return bestMatch;
};

const buildLocationKey = (fromPoint, toPoint) => (
  `${fromPoint.lat.toFixed(5)},${fromPoint.lng.toFixed(5)}|${toPoint.lat.toFixed(5)},${toPoint.lng.toFixed(5)}`
);

const resolvePreviousTimelineEvent = (
  sortedEvents,
  dayEvents,
  eventIndex,
  event,
  dayKey,
) => {
  let previousEvent = eventIndex > 0 ? dayEvents[eventIndex - 1] : null;
  let useCrossDay = false;

  if (!previousEvent) {
    previousEvent = findPreviousItineraryEventForDay(sortedEvents, event, dayKey);
  }

  if (previousEvent) {
    const sameDayTimes = getTimelineDayLegTimes(previousEvent, event, dayKey);
    if (sameDayTimes) {
      return { previousEvent, legTimes: sameDayTimes };
    }
  }

  if (!needsCrossDayInboundLeg(dayEvents, event, dayKey, eventIndex)) {
    return null;
  }

  previousEvent = findClosestPriorItineraryEvent(sortedEvents, event);
  if (!previousEvent) return null;

  const legTimes = getCrossDayLegTimes(previousEvent, event, dayKey);
  if (!legTimes) return null;

  return { previousEvent, legTimes };
};

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
      if (getMultidayEventDayRole(event, dayKey) === 'middle') continue;

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

      const gapMinutes = Math.round(
        (legTimes.toStart.getTime() - legTimes.fromEnd.getTime()) / (60 * 1000),
      );

      legs.push({
        fromEventId: previousEvent.id,
        toEventId: event.id,
        dayKey,
        fromPoint,
        toPoint,
        locationKey: buildLocationKey(fromPoint, toPoint),
        gapMinutes,
      });
    }
  }

  return legs;
};

module.exports = {
  discoverTimelineTransferLegs,
  buildLocationKey,
};
