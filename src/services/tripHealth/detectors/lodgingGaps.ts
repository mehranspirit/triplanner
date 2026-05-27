import { Event, Trip } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { extractDatePart, getEventEnd, getEventStart } from '@/utils/eventTime';
import {
  addDaysToDateKey,
  enumerateTripNightDateKeys,
  formatShortDateRange,
  getDateKey,
  getTripDateKeyBounds,
} from '@/utils/tripHealthDates';
import { buildLodgingGapIssueKey, buildMissingStayIssueKey } from '../issueKeys';
import { lodgingGapResolutionOptions } from '../resolutionOptions';

interface NightCoverage {
  nights: Set<string>;
  stayEventIds: Map<string, string[]>;
}

const TRAVEL_EVENT_TYPES = new Set([
  'arrival',
  'departure',
  'flight',
  'train',
  'bus',
  'rental_car',
]);

const OVERNIGHT_TRANSPORT_TYPES = new Set(['flight', 'train', 'bus']);

const getStayNightKeys = (stay: Event): string[] => {
  const data = stay as Event & { checkIn?: string; checkOut?: string };
  const checkIn = extractDatePart(data.checkIn || stay.startDate);
  const checkOut = extractDatePart(data.checkOut || stay.endDate);
  if (!checkIn || !checkOut || checkOut <= checkIn) return [];

  const nights: string[] = [];
  let cursor = checkIn;
  while (cursor < checkOut) {
    nights.push(cursor);
    const next = addDaysToDateKey(cursor, 1);
    if (!next) break;
    cursor = next;
  }

  return nights;
};

const addOvernightTransportNights = (event: Event, nights: Set<string>): void => {
  if (!OVERNIGHT_TRANSPORT_TYPES.has(event.type)) return;

  const start = getEventStart(event);
  const end = getEventEnd(event);
  if (!start || !end) return;

  const startKey = getDateKey(start);
  const endKey = getDateKey(end);
  if (startKey === endKey) return;

  let cursor = startKey;
  while (cursor < endKey) {
    nights.add(cursor);
    const next = addDaysToDateKey(cursor, 1);
    if (!next) break;
    cursor = next;
  }
};

const buildNightCoverage = (events: Event[]): NightCoverage => {
  const nights = new Set<string>();
  const stayEventIds = new Map<string, string[]>();

  events.forEach((event) => {
    if (event.type === 'stay') {
      getStayNightKeys(event).forEach((nightKey) => {
        nights.add(nightKey);
        stayEventIds.set(nightKey, [...(stayEventIds.get(nightKey) || []), event.id]);
      });
      return;
    }

    addOvernightTransportNights(event, nights);
  });

  return { nights, stayEventIds };
};

const groupConsecutiveNights = (nightKeys: string[]): Array<{ start: string; end: string }> => {
  if (nightKeys.length === 0) return [];

  const sorted = [...nightKeys].sort();
  const groups: Array<{ start: string; end: string }> = [];
  let groupStart = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const expectedNext = addDaysToDateKey(previous, 1);
    if (expectedNext === current) {
      previous = current;
      continue;
    }

    groups.push({ start: groupStart, end: previous });
    groupStart = current;
    previous = current;
  }

  groups.push({ start: groupStart, end: previous });
  return groups;
};

const buildMissingStayIssue = (trip: Trip, events: Event[]): TripHealthIssue | null => {
  const hasTravel = events.some((event) => TRAVEL_EVENT_TYPES.has(event.type));
  const hasStay = events.some((event) => event.type === 'stay');
  if (!hasTravel || hasStay) return null;

  const bounds = getTripDateKeyBounds(trip, events);
  const checkIn = bounds?.startDate;
  const checkOut = bounds?.endDate
    ? addDaysToDateKey(bounds.endDate, 1) || bounds.endDate
    : undefined;
  const issueKey = buildMissingStayIssueKey(trip._id);

  return {
    id: issueKey,
    issueKey,
    type: 'lodging_gap',
    dimension: 'lodging',
    severity: 'warning',
    title: 'No stay added',
    reason: 'This trip has transportation but no lodging yet.',
    affectedDates: bounds ? [bounds.startDate, bounds.endDate].filter(Boolean) as string[] : undefined,
    resolutionOptions: checkIn && checkOut
      ? lodgingGapResolutionOptions(checkIn, checkOut)
      : [{
          id: `lodging-add-${trip._id}`,
          label: 'Add stay',
          action: 'create_event',
          payload: { eventType: 'stay' },
          isPrimary: true,
        }],
  };
};

export const detectLodgingGaps = (trip: Trip, events: Event[]): TripHealthIssue[] => {
  const missingStayIssue = buildMissingStayIssue(trip, events);
  if (missingStayIssue) {
    return [missingStayIssue];
  }

  const tripNights = enumerateTripNightDateKeys(trip, events);
  if (tripNights.length === 0) return [];

  const hasLodgingSignal = events.some((event) => (
    event.type === 'stay' || OVERNIGHT_TRANSPORT_TYPES.has(event.type)
  ));
  if (!hasLodgingSignal) return [];

  const { nights: coveredNights, stayEventIds } = buildNightCoverage(events);
  const uncoveredNights = tripNights.filter((night) => !coveredNights.has(night));
  const gapGroups = groupConsecutiveNights(uncoveredNights);

  return gapGroups.map(({ start, end }) => {
    const checkoutEndDate = addDaysToDateKey(end, 1) || end;
    const adjacentBefore = stayEventIds.get(addDaysToDateKey(start, -1) || '')?.[0];
    const adjacentAfter = stayEventIds.get(addDaysToDateKey(end, 1) || '')?.[0];
    const adjacentStayEventId = adjacentBefore || adjacentAfter;

    return {
      id: buildLodgingGapIssueKey(start, checkoutEndDate),
      issueKey: buildLodgingGapIssueKey(start, checkoutEndDate),
      type: 'lodging_gap',
      dimension: 'lodging',
      severity: 'warning',
      title: `Lodging gap: ${formatShortDateRange(start, end)}`,
      reason: start === end
        ? 'No stay or overnight transport covers this night.'
        : 'These nights are not covered by a stay or overnight transport.',
      affectedDates: uncoveredNights.filter((night) => night >= start && night <= end),
      relatedEventIds: adjacentStayEventId ? [adjacentStayEventId] : undefined,
      resolutionOptions: lodgingGapResolutionOptions(start, checkoutEndDate, adjacentStayEventId),
    };
  });
};
