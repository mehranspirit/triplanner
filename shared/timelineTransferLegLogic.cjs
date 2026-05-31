/**
 * Shared timeline transfer-leg discovery logic used by the server.
 * Keep in sync with src/utils/timelineTransferLegLogicCore.ts (client source of truth).
 */

const TRANSPORT_INBOUND_TYPES = new Set(['flight', 'train', 'bus', 'arrival']);
const MULTIDAY_EVENT_TYPES = new Set(['stay', 'rental_car']);

const MIN_TRANSFER_DISTANCE_KM = 2;

const createTimelineTransferLegLogic = ({
  getEventStart,
  getEventEnd,
  isSameLocalDay,
  parseTimelineDateKey,
  startOfDay,
  getMultidayEventDayRole,
  eventOccursOnDayKey,
}) => {
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

  const shouldSkipInboundTimelineLeg = (event, dayKey) => {
    const destinationRole = getMultidayEventDayRole(event, dayKey);
    if (
      (event.type === 'stay' && (destinationRole === 'middle' || destinationRole === 'end'))
      || (event.type === 'rental_car' && destinationRole === 'middle')
    ) {
      return true;
    }
    return destinationRole === 'middle';
  };

  const isFlexibleOutboundMultidayLeg = (from, to, dayKey) => {
    const fromRole = getMultidayEventDayRole(from, dayKey);
    if (fromRole !== 'middle') return false;
    if (from.type !== 'stay' && from.type !== 'rental_car') return false;

    const toRole = getMultidayEventDayRole(to, dayKey);
    return toRole !== 'middle';
  };

  const resolveTransferLegToStart = (to, viewDayKey) => {
    const dayDate = parseTimelineDateKey(viewDayKey);
    if (!dayDate) return null;

    const toStartRaw = getEventStart(to);
    if (!toStartRaw) return null;

    const toRole = getMultidayEventDayRole(to, viewDayKey);
    if (toRole === 'end') return getEventEnd(to) ?? toStartRaw;
    if (toRole === 'middle') return startOfDay(dayDate);
    return toStartRaw;
  };

  const applyFlexibleOutboundEndRole = (
    from,
    fromRole,
    fromEnd,
    toStart,
    dayDate,
    flexibleDeparture,
  ) => {
    if (
      (from.type === 'stay' || from.type === 'rental_car')
      && fromRole === 'end'
      && toStart.getTime() < fromEnd.getTime()
    ) {
      return { fromEnd: startOfDay(dayDate), flexibleDeparture: true };
    }
    return { fromEnd, flexibleDeparture };
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

    let flexibleDeparture = isFlexibleOutboundMultidayLeg(from, to, dayKey);
    ({ fromEnd, flexibleDeparture } = applyFlexibleOutboundEndRole(
      from,
      fromRole,
      fromEnd,
      toStart,
      dayDate,
      flexibleDeparture,
    ));

    return { fromEnd, toStart, flexibleDeparture };
  };

  const getCrossDayLegTimes = (from, to, viewDayKey) => {
    const toStart = resolveTransferLegToStart(to, viewDayKey);
    if (!toStart) return null;

    const fromEnd = getEffectiveEventEndForTransfer(from, toStart) ?? getEventEnd(from);
    if (!fromEnd || fromEnd.getTime() > toStart.getTime()) return null;

    return {
      fromEnd,
      toStart,
      flexibleDeparture: isFlexibleOutboundMultidayLeg(from, to, viewDayKey),
    };
  };

  const isTimelinePrimaryEvent = (event, dayKey) => {
    const role = getMultidayEventDayRole(event, dayKey);
    return role !== 'middle';
  };

  const needsCrossDayInboundLeg = (dayEvents, event, dayKey, eventIndex) => {
    if (eventIndex > 0) return false;

    const role = getMultidayEventDayRole(event, dayKey);
    if (event.type === 'rental_car' && role === 'end') {
      return true;
    }

    const primaryEvents = dayEvents.filter((item) => isTimelinePrimaryEvent(item, dayKey));
    const isSparsePrimaryDay = primaryEvents.length === 1 && primaryEvents[0].id === event.id;
    if (!isSparsePrimaryDay) return false;

    if (TRANSPORT_INBOUND_TYPES.has(event.type)) return true;

    return role === 'start'
      || (role === 'single' && MULTIDAY_EVENT_TYPES.has(event.type));
  };

  const findClosestPriorItineraryEvent = (events, current, dayKey) => {
    const currentStart = dayKey
      ? resolveTransferLegToStart(current, dayKey)
      : getEventStart(current);
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

    const currentStart = resolveTransferLegToStart(current, dayKey);
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

  const resolvePreviousTimelineEvent = (sortedEvents, dayEvents, eventIndex, event, dayKey) => {
    let previousEvent = eventIndex > 0 ? dayEvents[eventIndex - 1] : null;

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

    previousEvent = findClosestPriorItineraryEvent(sortedEvents, event, dayKey);
    if (!previousEvent) return null;

    const legTimes = getCrossDayLegTimes(previousEvent, event, dayKey);
    if (!legTimes) return null;

    return { previousEvent, legTimes };
  };

  const computeGapMinutes = (legTimes) => (
    Math.round((legTimes.toStart.getTime() - legTimes.fromEnd.getTime()) / (60 * 1000))
  );

  return {
    MIN_TRANSFER_DISTANCE_KM,
    TRANSPORT_INBOUND_TYPES,
    getEffectiveEventEndForTransfer,
    shouldSkipInboundTimelineLeg,
    isFlexibleOutboundMultidayLeg,
    getTimelineDayLegTimes,
    getCrossDayLegTimes,
    isTimelinePrimaryEvent,
    needsCrossDayInboundLeg,
    findClosestPriorItineraryEvent,
    findPreviousItineraryEventForDay,
    resolvePreviousTimelineEvent,
    computeGapMinutes,
  };
};

module.exports = {
  createTimelineTransferLegLogic,
  MIN_TRANSFER_DISTANCE_KM,
};
