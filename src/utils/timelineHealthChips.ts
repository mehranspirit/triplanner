import { Event } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { getEventStart } from '@/utils/eventTime';
import { getDateKey } from '@/utils/tripHealthDates';

const TIMELINE_ISSUE_TYPES = new Set<TripHealthIssue['type']>([
  'empty_day',
  'lodging_gap',
  'transport_gap',
]);

export interface TimelineHealthChip {
  issueId: string;
  label: string;
  severity: TripHealthIssue['severity'];
}

export const getTimelineHealthChipLabel = (issue: TripHealthIssue): string => {
  switch (issue.type) {
    case 'empty_day':
      return issue.title.startsWith('Under-planned') ? 'Under-planned' : 'Open day';
    case 'lodging_gap':
      return 'Lodging gap';
    case 'transport_gap':
      return 'Transport gap';
    default:
      return issue.title;
  }
};

const getIssueDateKeys = (issue: TripHealthIssue, events: Event[]): string[] => {
  if (issue.affectedDates?.length) {
    return issue.affectedDates;
  }

  if (issue.type !== 'transport_gap' || !issue.relatedEventIds?.length) {
    return [];
  }

  const dateKeys = new Set<string>();
  issue.relatedEventIds.forEach((eventId) => {
    const event = events.find((candidate) => candidate.id === eventId);
    const start = event ? getEventStart(event) : null;
    if (start) {
      dateKeys.add(getDateKey(start));
    }
  });

  return [...dateKeys];
};

export const indexTimelineHealthIssuesByDate = (
  issues: TripHealthIssue[],
  events: Event[] = [],
): Map<string, TimelineHealthChip[]> => {
  const map = new Map<string, TimelineHealthChip[]>();

  issues
    .filter((issue) => TIMELINE_ISSUE_TYPES.has(issue.type))
    .forEach((issue) => {
      getIssueDateKeys(issue, events).forEach((dateKey) => {
        const chips = map.get(dateKey) ?? [];
        if (chips.some((chip) => chip.issueId === issue.id)) return;

        chips.push({
          issueId: issue.id,
          label: getTimelineHealthChipLabel(issue),
          severity: issue.severity,
        });
        map.set(dateKey, chips);
      });
    });

  return map;
};
