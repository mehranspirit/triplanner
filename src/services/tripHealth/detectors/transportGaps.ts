import { Event } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { GROUND_TRANSPORT_LOOKUP_HOURS } from '@/constants/tripHealthThresholds';
import {
  buildFlightRoleMap,
  getArrivalGroundTransportReason,
  getDepartureGroundTransportReason,
  getFlightRole,
  shouldCheckArrivalGroundTransport,
  shouldCheckDepartureGroundTransport,
} from '@/utils/flightTripRoles';
import {
  getEventDisplayName,
  getEventEnd,
  getEventStart,
  sortEventsByStart,
} from '@/utils/eventTime';
import {
  getConnectionTightThresholdMinutes,
  getNextScheduledEvent,
  getTransferSummary,
  hasNearbyGroundTransport,
  isGroundTransportEvent,
  isTransportArrivalEvent,
} from '@/utils/transferAnalysis';
import { buildTransportGapIssueKey } from '../issueKeys';
import {
  transportMissingResolutionOptions,
  transportTightResolutionOptions,
} from '../resolutionOptions';

const hasNearbyGroundTransportBefore = (
  events: Event[],
  departureEvent: Event,
  lookupHours = GROUND_TRANSPORT_LOOKUP_HOURS,
): boolean => {
  const departureTime = getEventStart(departureEvent);
  if (!departureTime) return false;

  return events.some((event) => {
    if (!isGroundTransportEvent(event) || event.id === departureEvent.id) return false;

    const transportEnd = getEventEnd(event) ?? getEventStart(event);
    if (!transportEnd) return false;

    const hoursBeforeDeparture = (departureTime.getTime() - transportEnd.getTime()) / (60 * 60 * 1000);
    return hoursBeforeDeparture >= -1 && hoursBeforeDeparture <= lookupHours;
  });
};

const buildMissingArrivalIssue = (
  event: Event,
  nextEvent: Event | null,
  roleMap: ReturnType<typeof buildFlightRoleMap>,
): TripHealthIssue => {
  const role = roleMap.get(event.id) ?? null;
  const issueKey = buildTransportGapIssueKey('missing', event.id);
  const legLabel = role?.label ? `${role.label}: ` : '';

  return {
    id: issueKey,
    issueKey,
    type: 'transport_gap',
    dimension: 'transport',
    severity: 'warning',
    title: `${legLabel}Ground transport needed after landing`,
    reason: getArrivalGroundTransportReason(event, role),
    relatedEventIds: [event.id, ...(nextEvent ? [nextEvent.id] : [])],
    resolutionOptions: transportMissingResolutionOptions(event.id),
  };
};

const buildMissingDepartureIssue = (
  event: Event,
  roleMap: ReturnType<typeof buildFlightRoleMap>,
): TripHealthIssue => {
  const role = roleMap.get(event.id) ?? null;
  const issueKey = buildTransportGapIssueKey('missing_departure', event.id);
  const legLabel = role?.label ? `${role.label}: ` : '';

  return {
    id: issueKey,
    issueKey,
    type: 'transport_gap',
    dimension: 'transport',
    severity: 'warning',
    title: `${legLabel}Transport to airport needed`,
    reason: getDepartureGroundTransportReason(event, role),
    relatedEventIds: [event.id],
    resolutionOptions: transportMissingResolutionOptions(event.id),
  };
};

export const detectTransportGaps = (
  events: Event[],
  weatherSnapshots: WeatherSnapshot[] = [],
): TripHealthIssue[] => {
  const issues: TripHealthIssue[] = [];
  const sortedEvents = sortEventsByStart(events);
  const flightRoleMap = buildFlightRoleMap(events);

  sortedEvents.forEach((event) => {
    if (shouldCheckDepartureGroundTransport(event, flightRoleMap)) {
      const lacksAirportTransport = !hasNearbyGroundTransportBefore(events, event);
      if (lacksAirportTransport) {
        issues.push(buildMissingDepartureIssue(event, flightRoleMap));
      }
    }
  });

  sortedEvents.forEach((event) => {
    if (!isTransportArrivalEvent(event)) return;

    const nextEvent = getNextScheduledEvent(events, event);
    const checkArrivalGroundTransport = shouldCheckArrivalGroundTransport(event, events, flightRoleMap);

    if (checkArrivalGroundTransport) {
      const missingGroundTransport = !hasNearbyGroundTransport(
        events,
        event,
        GROUND_TRANSPORT_LOOKUP_HOURS,
      );

      if (missingGroundTransport) {
        issues.push(buildMissingArrivalIssue(event, nextEvent, flightRoleMap));
      }
    }

    if (!nextEvent) return;

    const fromEnd = getEventEnd(event);
    const toStart = getEventStart(nextEvent);
    const gapMinutes = fromEnd && toStart
      ? Math.round((toStart.getTime() - fromEnd.getTime()) / (60 * 1000))
      : null;
    const tightThreshold = getConnectionTightThresholdMinutes(event);
    const role = getFlightRole(event, events, flightRoleMap);
    const connectionLabel = role?.leg === 'connection' ? 'Connecting flight: ' : '';

    if (gapMinutes !== null && gapMinutes >= 0 && gapMinutes < tightThreshold) {
      const issueKey = buildTransportGapIssueKey('tight', event.id);
      issues.push({
        id: issueKey,
        issueKey,
        type: 'transport_gap',
        dimension: 'transport',
        severity: gapMinutes < tightThreshold / 2 ? 'critical' : 'warning',
        title: `${connectionLabel}Tight connection`,
        reason: `Only ${gapMinutes} minutes between ${getEventDisplayName(event)} and ${getEventDisplayName(nextEvent)} — below the ${tightThreshold}-minute buffer.`,
        relatedEventIds: [event.id, nextEvent.id],
        resolutionOptions: transportTightResolutionOptions(event.id, nextEvent.id),
      });
      return;
    }

    const transfer = getTransferSummary(event, nextEvent, weatherSnapshots);
    if (transfer?.severity === 'tight') {
      const issueKey = buildTransportGapIssueKey('tight', event.id);
      issues.push({
        id: issueKey,
        issueKey,
        type: 'transport_gap',
        dimension: 'transport',
        severity: transfer.gapMinutes < transfer.estimatedTravelMinutes / 2 ? 'critical' : 'warning',
        title: `${connectionLabel}Tight travel buffer`,
        reason: `${transfer.gapMinutes} minutes available but roughly ${transfer.estimatedTravelMinutes} minutes estimated between ${getEventDisplayName(event)} and ${getEventDisplayName(nextEvent)} (${transfer.distanceMiles} mi).`,
        relatedEventIds: [event.id, nextEvent.id],
        resolutionOptions: transportTightResolutionOptions(event.id, nextEvent.id),
      });
    }
  });

  return dedupeTransportIssues(issues);
};

const dedupeTransportIssues = (issues: TripHealthIssue[]): TripHealthIssue[] => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.issueKey)) return false;
    seen.add(issue.issueKey);
    return true;
  });
};
