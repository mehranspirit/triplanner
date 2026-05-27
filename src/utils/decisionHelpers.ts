import { ActivityEvent, Event, StayEvent, Trip } from '@/types/eventTypes';
import { DecisionSet } from '@/types/decisionTypes';
import { getEventDisplayName, getEventStart, extractDatePart } from '@/utils/eventTime';
import { formatCurrency } from '@/utils/format';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

const VOTEABLE_TYPES = new Set(['activity', 'destination', 'stay']);

export const DECISION_COMPARISON_TYPES = ['activity', 'destination', 'stay'] as const;
export type DecisionComparisonType = typeof DECISION_COMPARISON_TYPES[number];

export const DECISION_TYPE_SECTION_LABELS: Record<DecisionComparisonType, string> = {
  activity: 'Activities',
  destination: 'Destinations',
  stay: 'Stays',
};

export const DECISION_TYPE_SINGULAR_LABELS: Record<DecisionComparisonType, string> = {
  activity: 'activity',
  destination: 'destination',
  stay: 'stay',
};

export const isDecisionComparisonType = (value: string): value is DecisionComparisonType => (
  DECISION_COMPARISON_TYPES.includes(value as DecisionComparisonType)
);

export const isVoteableEvent = (event: Event): boolean => (
  VOTEABLE_TYPES.has(event.type)
);

export const getOpenDecisions = (decisions: DecisionSet[] = []): DecisionSet[] => (
  decisions.filter((decision) => decision.status === 'open' || decision.status === 'deferred')
);

export const getActiveDecisionEventIds = (decisions: DecisionSet[] = []): Set<string> => {
  const ids = new Set<string>();
  getOpenDecisions(decisions).forEach((decision) => {
    decision.optionEventIds.forEach((eventId) => ids.add(eventId));
  });
  return ids;
};

export const getDecisionForEvent = (
  decisions: DecisionSet[] = [],
  eventId: string,
): DecisionSet | undefined => (
  getOpenDecisions(decisions).find((decision) => decision.optionEventIds.includes(eventId))
);

export const getOrphanExploringEvents = (trip: Trip): Event[] => {
  const reservedIds = getActiveDecisionEventIds(trip.decisions);
  return trip.events.filter((event) => (
    event.status === 'exploring'
    && isVoteableEvent(event)
    && !reservedIds.has(event.id)
  ));
};

export interface DecisionVoteStats {
  eventId: string;
  likeCount: number;
  dislikeCount: number;
  voterCount: number;
}

export const getDecisionVoteStats = (
  decision: DecisionSet,
  events: Event[],
): DecisionVoteStats[] => (
  decision.optionEventIds.map((eventId) => {
    const event = events.find((candidate) => candidate.id === eventId);
    const likes = event?.likes ?? [];
    const dislikes = event?.dislikes ?? [];
    return {
      eventId,
      likeCount: likes.length,
      dislikeCount: dislikes.length,
      voterCount: new Set([...likes, ...dislikes]).size,
    };
  })
);

export const getDecisionParticipation = (
  decision: DecisionSet,
  events: Event[],
  collaboratorCount: number,
): { votedCount: number; eligibleCount: number } => {
  const voterIds = new Set<string>();
  decision.optionEventIds.forEach((eventId) => {
    const event = events.find((candidate) => candidate.id === eventId);
    (event?.likes ?? []).forEach((id) => voterIds.add(id));
    (event?.dislikes ?? []).forEach((id) => voterIds.add(id));
  });

  return {
    votedCount: voterIds.size,
    eligibleCount: Math.max(collaboratorCount, 1),
  };
};

export const getDecisionTieEventIds = (
  decision: DecisionSet,
  events: Event[],
): string[] => {
  const stats = getDecisionVoteStats(decision, events);
  if (stats.length < 2) return [];

  const maxLikes = Math.max(...stats.map((entry) => entry.likeCount));
  if (maxLikes === 0) return [];

  const leaders = stats.filter((entry) => entry.likeCount === maxLikes);
  return leaders.length > 1 ? leaders.map((entry) => entry.eventId) : [];
};

export const sortDecisionOptionEvents = (decision: DecisionSet, events: Event[]): Event[] => {
  const stats = new Map(getDecisionVoteStats(decision, events).map((entry) => [entry.eventId, entry]));

  return decision.optionEventIds
    .map((eventId) => events.find((event) => event.id === eventId))
    .filter((event): event is Event => Boolean(event))
    .sort((left, right) => {
      const leftStats = stats.get(left.id) ?? { likeCount: 0, dislikeCount: 0 };
      const rightStats = stats.get(right.id) ?? { likeCount: 0, dislikeCount: 0 };

      if (rightStats.likeCount !== leftStats.likeCount) {
        return rightStats.likeCount - leftStats.likeCount;
      }
      if (leftStats.dislikeCount !== rightStats.dislikeCount) {
        return leftStats.dislikeCount - rightStats.dislikeCount;
      }

      const leftStart = getEventStart(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightStart = getEventStart(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart;
    });
};

export const suggestDecisionTitle = (events: Event[]): string => {
  if (events.length === 0) return 'Compare options';

  if (isStayDecisionComparison(events)) {
    const inferred = inferDecisionSlotFromEvents(events);
    return inferred?.label ? `Stay options · ${inferred.label}` : 'Stay options';
  }

  const inferred = inferDecisionSlotFromEvents(events);
  const datePart = inferred?.label
    || (inferred?.date
      ? new Date(`${inferred.date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      : '');

  if (events.every((event) => event.type === 'destination')) {
    return datePart ? `Destination options · ${datePart}` : 'Destination options';
  }

  if (events.every((event) => event.type === 'activity')) {
    const activityTypes = events
      .map((event) => (event as ActivityEvent).activityType?.trim())
      .filter(Boolean) as string[];
    const uniqueActivityTypes = new Set(activityTypes.map((value) => value.toLowerCase()));

    if (uniqueActivityTypes.size === 1) {
      const activityType = activityTypes[0];
      return datePart ? `${activityType} options · ${datePart}` : `${activityType} options`;
    }

    return datePart ? `Activity options · ${datePart}` : 'Activity options';
  }

  return datePart ? `Compare options · ${datePart}` : 'Compare options';
};

export const groupOrphanEventsByType = (events: Event[]): Record<DecisionComparisonType, Event[]> => ({
  activity: events.filter((event) => event.type === 'activity'),
  destination: events.filter((event) => event.type === 'destination'),
  stay: events.filter((event) => event.type === 'stay'),
});

export const getSharedDecisionComparisonType = (events: Event[]): DecisionComparisonType | null => {
  if (events.length === 0) return null;

  const firstType = events[0].type;
  if (!isDecisionComparisonType(firstType)) return null;
  return events.every((event) => event.type === firstType) ? firstType : null;
};

export const eventsAreComparableTogether = (events: Event[]): boolean => (
  getSharedDecisionComparisonType(events) !== null
);

export const hasComparableDecisionPair = (events: Event[]): boolean => (
  Object.values(groupOrphanEventsByType(events)).some((group) => group.length >= 2)
);

export const normalizePreselectedDecisionIds = (
  orphanEvents: Event[],
  preselectedIds: string[],
): string[] => {
  const allowed = orphanEvents.filter((event) => preselectedIds.includes(event.id));
  if (allowed.length === 0) return [];

  const sharedType = getSharedDecisionComparisonType(allowed);
  if (sharedType) {
    return allowed.map((event) => event.id);
  }

  const firstType = allowed[0].type;
  if (!isDecisionComparisonType(firstType)) return [];
  return allowed.filter((event) => event.type === firstType).map((event) => event.id);
};

export const getExploreScopeForDecisionEvent = (
  event: Event,
): { date?: string; endDate?: string; defaultKeywords?: string } => {
  const inferred = inferDecisionSlotFromEvents([event]);
  const scope: { date?: string; endDate?: string; defaultKeywords?: string } = {};

  if (inferred?.date) {
    scope.date = inferred.date;
  }
  if (inferred?.endDate && inferred.endDate !== inferred.date) {
    scope.endDate = inferred.endDate;
  }

  if (event.type === 'activity') {
    const activityType = (event as ActivityEvent).activityType?.trim();
    if (activityType) scope.defaultKeywords = activityType;
  } else if (event.type === 'stay') {
    scope.defaultKeywords = 'hotel lodging stay';
  } else if (event.type === 'destination') {
    const placeName = (event as { placeName?: string }).placeName?.trim();
    if (placeName) scope.defaultKeywords = placeName;
  }

  return scope;
};

export const formatDecisionSlot = (decision: DecisionSet): string | null => {
  if (decision.slot?.label) return decision.slot.label;
  if (decision.slot?.date) {
    if (decision.slot.endDate && decision.slot.endDate !== decision.slot.date) {
      return formatDecisionSlotRange(decision.slot.date, decision.slot.endDate);
    }

    const parts = [decision.slot.date];
    if (decision.slot.startTime) {
      parts.push(decision.slot.startTime);
      if (decision.slot.endTime) parts.push(`– ${decision.slot.endTime}`);
    }
    return parts.join(' ');
  }
  return null;
};

export const formatDecisionSlotRange = (startDate: string, endDate: string): string => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startDate === endDate) {
    return format(start, 'EEEE, MMM d, yyyy');
  }
  if (startYear === endYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
};

export const buildDecisionSlotLabel = (date: string, endDate?: string): string => {
  if (!endDate || endDate === date) {
    return format(parseISO(date), 'EEEE, MMM d');
  }
  return formatDecisionSlotRange(date, endDate);
};

export const getStayCheckInDateKey = (event: Event): string | undefined => {
  if (event.type !== 'stay') return undefined;
  const stay = event as StayEvent;
  const raw = stay.checkIn || event.startDate;
  return raw ? String(raw).slice(0, 10) : undefined;
};

export const getStayCheckOutDateKey = (event: Event): string | undefined => {
  if (event.type !== 'stay') return undefined;
  const stay = event as StayEvent;
  const raw = stay.checkOut || event.endDate;
  return raw ? String(raw).slice(0, 10) : undefined;
};

export const countStayNights = (checkIn?: string, checkOut?: string): number | undefined => {
  if (!checkIn || !checkOut) return undefined;
  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
  return nights > 0 ? nights : undefined;
};

export const isStayDecisionComparison = (events: Event[]): boolean => (
  events.length > 0 && events.every((event) => event.type === 'stay')
);

export interface InferredDecisionSlot {
  date?: string;
  endDate?: string;
  label?: string;
}

export const inferDecisionSlotFromEvents = (events: Event[]): InferredDecisionSlot | undefined => {
  if (events.length === 0) return undefined;

  if (isStayDecisionComparison(events)) {
    const checkIns = events.map(getStayCheckInDateKey).filter(Boolean) as string[];
    const checkOuts = events.map(getStayCheckOutDateKey).filter(Boolean) as string[];
    if (checkIns.length === 0) return undefined;

    const date = [...checkIns].sort()[0];
    const endDate = checkOuts.length > 0 ? [...checkOuts].sort().reverse()[0] : undefined;

    return {
      date,
      endDate,
      label: endDate ? buildDecisionSlotLabel(date, endDate) : buildDecisionSlotLabel(date),
    };
  }

  const firstStart = getEventStart(events[0]);
  if (!firstStart) return undefined;

  const date = `${firstStart.getFullYear()}-${String(firstStart.getMonth() + 1).padStart(2, '0')}-${String(firstStart.getDate()).padStart(2, '0')}`;
  return {
    date,
    label: buildDecisionSlotLabel(date),
  };
};

export const getDecisionAffectedDates = (decision: DecisionSet): string[] | undefined => {
  if (!decision.slot?.date) return undefined;

  const startDate = decision.slot.date;
  const endDate = decision.slot.endDate || startDate;
  if (endDate <= startDate) return [startDate];

  const dates: string[] = [];
  let current = parseISO(startDate);
  const lastNight = parseISO(endDate);

  while (current < lastNight) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return dates.length > 0 ? dates : [startDate];
};

export const getDecisionOptionLabel = (event: Event): string => getEventDisplayName(event);

export const isEventSelectableForDecision = (event: Event, trip: Trip): boolean => (
  event.status === 'exploring'
  && isVoteableEvent(event)
  && !getActiveDecisionEventIds(trip.decisions).has(event.id)
);

export const inferDecisionSlotDate = (events: Event[]): string | undefined => (
  inferDecisionSlotFromEvents(events)?.date
);

export type OptionSlotAlignment = 'aligned' | 'partial' | 'misaligned' | 'unknown';

export const getEventDateKey = (event: Event): string | undefined => {
  if (event.type === 'stay') {
    return getStayCheckInDateKey(event);
  }
  const start = getEventStart(event);
  if (start) {
    return format(start, 'yyyy-MM-dd');
  }
  return extractDatePart(event.startDate) || extractDatePart((event as Event & { date?: string }).date) || undefined;
};

export const getOptionSlotAlignment = (
  decision: DecisionSet,
  event: Event,
): OptionSlotAlignment => {
  const slotDate = decision.slot?.date;
  if (!slotDate) return 'unknown';

  const slotStart = slotDate;
  const slotEnd = decision.slot?.endDate || slotDate;

  if (event.type === 'stay') {
    const checkIn = getStayCheckInDateKey(event);
    const checkOut = getStayCheckOutDateKey(event);
    if (!checkIn || !checkOut) return 'unknown';

    const overlaps = checkIn <= slotEnd && checkOut >= slotStart;
    if (!overlaps) return 'misaligned';

    const contained = checkIn >= slotStart && checkOut <= slotEnd;
    return contained ? 'aligned' : 'partial';
  }

  const eventDate = getEventDateKey(event);
  if (!eventDate) return 'unknown';
  return eventDate >= slotStart && eventDate <= slotEnd ? 'aligned' : 'misaligned';
};

export const getOptionSlotAlignmentLabel = (alignment: OptionSlotAlignment): string => {
  if (alignment === 'aligned') return 'Matches decision slot';
  if (alignment === 'partial') return 'Partially overlaps decision slot';
  if (alignment === 'misaligned') return 'Outside decision slot';
  return 'Slot alignment unknown';
};

export const formatPerNightCost = (totalCost: number, nights: number, currency = 'USD'): string | null => {
  if (!Number.isFinite(totalCost) || nights <= 0) return null;
  return `${formatCurrency(totalCost / nights, currency)}/night`;
};
