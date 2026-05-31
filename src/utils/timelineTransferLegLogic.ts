import { startOfDay } from 'date-fns';
import { Event } from '@/types/eventTypes';
import { createTimelineTransferLegLogic } from '@/utils/timelineTransferLegLogicCore';
import { getEventEnd, getEventStart } from '@/utils/eventTime';
import {
  eventOccursOnDayKey,
  getMultidayEventDayRole,
  parseTimelineDateKey,
} from '@/utils/timelineDates';
import { getDateKey } from '@/utils/tripHealthDates';

export type { TimelineLegTimes } from '@/utils/timelineTransferLegLogicCore';

const isSameLocalDay = (left: Date, right: Date) => getDateKey(left) === getDateKey(right);

const rawLogic = createTimelineTransferLegLogic({
  getEventStart,
  getEventEnd,
  isSameLocalDay,
  parseTimelineDateKey,
  startOfDay,
  getMultidayEventDayRole,
  eventOccursOnDayKey,
});

export const shouldSkipInboundTimelineLeg = (event: Event, dayKey: string) => (
  rawLogic.shouldSkipInboundTimelineLeg(event, dayKey)
);

export const isFlexibleOutboundMultidayLeg = (from: Event, to: Event, dayKey: string) => (
  rawLogic.isFlexibleOutboundMultidayLeg(from, to, dayKey)
);

export const getTimelineDayLegTimes = (
  from: Event,
  to: Event,
  dayKey: string,
) => rawLogic.getTimelineDayLegTimes(from, to, dayKey);

export const getCrossDayLegTimes = (
  from: Event,
  to: Event,
  viewDayKey: string,
) => rawLogic.getCrossDayLegTimes(from, to, viewDayKey);

export const isTimelinePrimaryEvent = (event: Event, dayKey: string) => (
  rawLogic.isTimelinePrimaryEvent(event, dayKey)
);

export const needsCrossDayInboundLeg = (
  dayEvents: Event[],
  event: Event,
  dayKey: string,
  eventIndex: number,
) => rawLogic.needsCrossDayInboundLeg(dayEvents, event, dayKey, eventIndex);

export const findClosestPriorItineraryEvent = (events: Event[], current: Event) => (
  rawLogic.findClosestPriorItineraryEvent(events, current)
);

export const findPreviousItineraryEventForDay = (
  events: Event[],
  current: Event,
  dayKey: string,
) => rawLogic.findPreviousItineraryEventForDay(events, current, dayKey);

export const getEffectiveEventEndForTransfer = (event: Event, beforeTime: Date) => (
  rawLogic.getEffectiveEventEndForTransfer(event, beforeTime)
);

export const resolvePreviousTimelineEvent = (
  sortedEvents: Event[],
  dayEvents: Event[],
  eventIndex: number,
  event: Event,
  dayKey: string,
) => rawLogic.resolvePreviousTimelineEvent(
  sortedEvents,
  dayEvents,
  eventIndex,
  event,
  dayKey,
);
