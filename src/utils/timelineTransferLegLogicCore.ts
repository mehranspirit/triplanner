/**
 * Timeline transfer-leg discovery logic (client source of truth).
 * Keep in sync with shared/timelineTransferLegLogic.cjs used by the server.
 */

import { Event } from '@/types/eventTypes';
import { MultidayEventDayRole } from '@/utils/timelineDates';

export const MIN_TRANSFER_DISTANCE_KM = 2;

const TRANSPORT_INBOUND_TYPES = new Set(['flight', 'train', 'bus', 'arrival']);
const MULTIDAY_EVENT_TYPES = new Set(['stay', 'rental_car']);

export interface TimelineLegTimes {
  fromEnd: Date;
  toStart: Date;
  flexibleDeparture: boolean;
}

export interface TimelineTransferLegLogicDeps {
  getEventStart: (event: Event) => Date | null;
  getEventEnd: (event: Event) => Date | null;
  isSameLocalDay: (left: Date, right: Date) => boolean;
  parseTimelineDateKey: (dateKey: string) => Date | null;
  startOfDay: (date: Date) => Date;
  getMultidayEventDayRole: (event: Event, dayKey: string) => MultidayEventDayRole | null;
  eventOccursOnDayKey: (event: Event, dayKey: string) => boolean;
}

export const createTimelineTransferLegLogic = ({
  getEventStart,
  getEventEnd,
  isSameLocalDay,
  parseTimelineDateKey,
  startOfDay,
  getMultidayEventDayRole,
  eventOccursOnDayKey,
}: TimelineTransferLegLogicDeps) => {
  const getEffectiveEventEndForTransfer = (event: Event, beforeTime: Date): Date | null => {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    if (!start || !end) return null;
    if (start.getTime() >= beforeTime.getTime()) return null;

    if (end.getTime() <= beforeTime.getTime()) {
      return end;
    }

    if (event.type === 'stay' || event.type === 'rental_car') {
      return beforeTime;
    }

    return null;
  };

  const shouldSkipInboundTimelineLeg = (event: Event, dayKey: string): boolean => {
    const destinationRole = getMultidayEventDayRole(event, dayKey);
    if (
      (event.type === 'stay' && (destinationRole === 'middle' || destinationRole === 'end'))
      || (event.type === 'rental_car' && destinationRole === 'middle')
    ) {
      return true;
    }
    return destinationRole === 'middle';
  };

  const isFlexibleOutboundMultidayLeg = (from: Event, to: Event, dayKey: string): boolean => {
    const fromRole = getMultidayEventDayRole(from, dayKey);
    if (fromRole !== 'middle') return false;
    if (from.type !== 'stay' && from.type !== 'rental_car') return false;

    const toRole = getMultidayEventDayRole(to, dayKey);
    return toRole !== 'middle';
  };

  const getTimelineDayLegTimes = (
    from: Event,
    to: Event,
    dayKey: string,
  ): TimelineLegTimes | null => {
    const dayDate = parseTimelineDateKey(dayKey);
    if (!dayDate) return null;

    const toStartRaw = getEventStart(to);
    if (!toStartRaw) return null;

    const fromRole = getMultidayEventDayRole(from, dayKey);
    let fromEnd: Date | null = null;

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
    // Activity before checkout time: traveler leaves the villa earlier, not at checkout.
    if (
      from.type === 'stay'
      && fromRole === 'end'
      && toStart.getTime() < fromEnd.getTime()
    ) {
      fromEnd = startOfDay(dayDate);
      flexibleDeparture = true;
    }

    return {
      fromEnd,
      toStart,
      flexibleDeparture,
    };
  };

  const resolveTransferLegToStart = (to: Event, viewDayKey: string): Date | null => {
    const dayDate = parseTimelineDateKey(viewDayKey);
    if (!dayDate) return null;

    const toStartRaw = getEventStart(to);
    if (!toStartRaw) return null;

    const toRole = getMultidayEventDayRole(to, viewDayKey);
    if (toRole === 'end') return getEventEnd(to) ?? toStartRaw;
    if (toRole === 'middle') return startOfDay(dayDate);
    return toStartRaw;
  };

  const getCrossDayLegTimes = (
    from: Event,
    to: Event,
    viewDayKey: string,
  ): TimelineLegTimes | null => {
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

  const isTimelinePrimaryEvent = (event: Event, dayKey: string): boolean => {
    const role = getMultidayEventDayRole(event, dayKey);
    return role !== 'middle';
  };

  const needsCrossDayInboundLeg = (
    dayEvents: Event[],
    event: Event,
    dayKey: string,
    eventIndex: number,
  ): boolean => {
    if (eventIndex > 0) return false;

    const primaryEvents = dayEvents.filter((item) => isTimelinePrimaryEvent(item, dayKey));
    const isSparsePrimaryDay = primaryEvents.length === 1 && primaryEvents[0].id === event.id;
    if (!isSparsePrimaryDay) return false;

    if (TRANSPORT_INBOUND_TYPES.has(event.type)) return true;

    const role = getMultidayEventDayRole(event, dayKey);
    return role === 'start'
      || (role === 'single' && MULTIDAY_EVENT_TYPES.has(event.type));
  };

  const findClosestPriorItineraryEvent = (events: Event[], current: Event): Event | null => {
    const currentStart = getEventStart(current);
    if (!currentStart) return null;

    let bestMatch: Event | null = null;
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

  const findPreviousItineraryEventForDay = (
    events: Event[],
    current: Event,
    dayKey: string,
  ): Event | null => {
    if (!eventOccursOnDayKey(current, dayKey)) return null;

    const currentStart = getEventStart(current);
    if (!currentStart) return null;

    let bestMatch: Event | null = null;
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

  const resolvePreviousTimelineEvent = (
    sortedEvents: Event[],
    dayEvents: Event[],
    eventIndex: number,
    event: Event,
    dayKey: string,
  ) => {
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

    previousEvent = findClosestPriorItineraryEvent(sortedEvents, event);
    if (!previousEvent) return null;

    const legTimes = getCrossDayLegTimes(previousEvent, event, dayKey);
    if (!legTimes) return null;

    return { previousEvent, legTimes };
  };

  const computeGapMinutes = (legTimes: TimelineLegTimes) => (
    Math.round((legTimes.toStart.getTime() - legTimes.fromEnd.getTime()) / (60 * 1000))
  );

  return {
    MIN_TRANSFER_DISTANCE_KM,
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
