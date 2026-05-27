import {
  HealthDismissal,
  TripHealthIssue,
  TripHealthResult,
  TripHealthSeverity,
  TripHealthSummary,
} from '@/types/tripHealthTypes';
import { DecisionSet } from '@/types/decisionTypes';
import { Trip } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { detectEmptyDays } from './tripHealth/detectors/emptyDays';
import { detectLodgingGaps } from './tripHealth/detectors/lodgingGaps';
import { detectTransportGaps } from './tripHealth/detectors/transportGaps';
import {
  detectBookingRefIssues,
  detectLocationIssues,
  detectScheduleConflicts,
} from './tripHealth/detectors/migratedInsights';
import { detectOpenDecisions, detectOrphanExploringEvents } from './tripHealth/detectors/decisions';

export {
  buildEmptyDayIssueKey,
  buildLodgingGapIssueKey,
  buildTransportGapIssueKey,
  buildLocationIssueKey,
  buildBookingRefIssueKey,
  buildExploringEventIssueKey,
  buildOpenDecisionIssueKey,
  parseOpenDecisionIssueKey,
} from './tripHealth/issueKeys';

export interface ComputeTripHealthInput {
  trip: Trip;
  dismissals?: HealthDismissal[];
  decisions?: DecisionSet[];
  weatherSnapshots?: WeatherSnapshot[];
  now?: Date;
}

const SEVERITY_WEIGHT: Record<TripHealthSeverity, number> = {
  critical: 10,
  warning: 5,
  info: 2,
};

const LOGISTICS_DIMENSIONS = new Set([
  'lodging',
  'transport',
  'location',
  'booking',
]);

const CONTENT_DIMENSIONS = new Set([
  'schedule',
  'decisions',
]);

export function filterDismissedIssues(
  issues: TripHealthIssue[],
  dismissals: HealthDismissal[] = [],
  now: Date = new Date(),
  tripStartDate?: string,
): TripHealthIssue[] {
  if (dismissals.length === 0) {
    return issues;
  }

  const dismissedKeys = new Set(
    dismissals
      .filter((dismissal) => !shouldReopenDismissal(dismissal, now, tripStartDate))
      .map((dismissal) => dismissal.issueKey),
  );

  return issues.filter((issue) => !dismissedKeys.has(issue.issueKey));
}

export function isIssueDismissed(
  issueKey: string,
  dismissals: HealthDismissal[] = [],
  now: Date = new Date(),
  tripStartDate?: string,
): boolean {
  return dismissals.some(
    (dismissal) =>
      dismissal.issueKey === issueKey &&
      !shouldReopenDismissal(dismissal, now, tripStartDate),
  );
}

function shouldReopenDismissal(
  dismissal: HealthDismissal,
  now: Date,
  tripStartDate?: string,
): boolean {
  if (
    dismissal.reason !== 'planning_deferred' ||
    typeof dismissal.reopenBeforeTripDays !== 'number' ||
    !tripStartDate
  ) {
    return false;
  }

  const tripStart = new Date(`${tripStartDate}T00:00:00`);
  if (Number.isNaN(tripStart.getTime())) {
    return false;
  }

  const reopenAt = new Date(tripStart);
  reopenAt.setDate(reopenAt.getDate() - dismissal.reopenBeforeTripDays);

  return now >= reopenAt;
}

function computeSubScore(issues: TripHealthIssue[], dimensions: Set<string>): number {
  const penalty = issues
    .filter((issue) => dimensions.has(issue.dimension))
    .reduce((total, issue) => total + SEVERITY_WEIGHT[issue.severity], 0);

  return Math.max(0, 100 - penalty);
}

function buildSummary(issues: TripHealthIssue[]): TripHealthSummary {
  const logisticsScore = computeSubScore(issues, LOGISTICS_DIMENSIONS);
  const contentScore = computeSubScore(issues, CONTENT_DIMENSIONS);

  // Headline score uses the weaker sub-score so one neglected track stays visible.
  const headlineScore = Math.min(logisticsScore, contentScore);

  return {
    headlineScore,
    logisticsScore,
    contentScore,
    openIssueCount: issues.length,
    criticalCount: issues.filter((issue) => issue.severity === 'critical').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
  };
}

const sortIssues = (issues: TripHealthIssue[]): TripHealthIssue[] => {
  const severityRank: Record<TripHealthSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...issues].sort((left, right) => {
    const severityDiff = severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) return severityDiff;

    const leftDate = left.affectedDates?.[0] ?? '';
    const rightDate = right.affectedDates?.[0] ?? '';
    return leftDate.localeCompare(rightDate);
  });
};

function detectIssues(input: ComputeTripHealthInput): TripHealthIssue[] {
  const events = input.trip.events || [];
  const weatherSnapshots = input.weatherSnapshots ?? [];
  const decisions = input.decisions ?? input.trip.decisions ?? [];
  const collaboratorCount = 1 + (input.trip.collaborators?.length ?? 0);

  const issues = [
    ...detectEmptyDays(input.trip, events),
    ...detectLodgingGaps(input.trip, events),
    ...detectTransportGaps(events, weatherSnapshots),
    ...detectLocationIssues(events),
    ...detectBookingRefIssues(events),
    ...detectScheduleConflicts(input.trip, events),
    ...detectOpenDecisions(decisions, events, collaboratorCount),
    ...detectOrphanExploringEvents(events, decisions),
  ];

  return sortIssues(issues);
}

export function computeTripHealth(input: ComputeTripHealthInput): TripHealthResult {
  const dismissals = input.dismissals ?? input.trip.healthDismissals ?? [];
  const now = input.now ?? new Date();
  const rawIssues = detectIssues(input);
  const issues = filterDismissedIssues(
    rawIssues,
    dismissals,
    now,
    input.trip.startDate,
  );

  return {
    summary: buildSummary(issues),
    issues,
  };
}
