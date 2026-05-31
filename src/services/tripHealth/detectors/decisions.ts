import { Event } from '@/types/eventTypes';
import { DecisionSet } from '@/types/decisionTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { getEventDisplayName, getEventStart } from '@/utils/eventTime';
import {
  getActiveDecisionEventIds,
  getDecisionAffectedDates,
  getDecisionParticipation,
  getDecisionTieEventIds,
  getDecisionVoteStats,
  isVoteableEvent,
} from '@/utils/decisionHelpers';
import { buildExploringEventIssueKey, buildOpenDecisionIssueKey } from '../issueKeys';
import { EXPLORING_EVENT_UI_LABEL } from '@/utils/eventStatusLabels';
import {
  openDecisionResolutionOptions,
  orphanExploringResolutionOptions,
} from '../resolutionOptions';

const getTimelineDateKey = (event: Event): string | undefined => {
  const start = getEventStart(event);
  if (!start) return undefined;
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
};

export const detectOpenDecisions = (
  decisions: DecisionSet[] = [],
  events: Event[],
  collaboratorCount = 1,
): TripHealthIssue[] => (
  decisions
    .filter((decision) => decision.status === 'open' || decision.status === 'deferred')
    .map((decision) => {
      const issueKey = buildOpenDecisionIssueKey(decision.id);
      const voteStats = getDecisionVoteStats(decision, events);
      const participation = getDecisionParticipation(decision, events, collaboratorCount);
      const tieEventIds = getDecisionTieEventIds(decision, events);
      const leadingLikes = voteStats.length > 0
        ? Math.max(...voteStats.map((entry) => entry.likeCount))
        : 0;

      const reasonParts = [
        `${decision.optionEventIds.length} options in "${decision.title}"`,
        `${participation.votedCount}/${participation.eligibleCount} collaborators voted`,
      ];
      if (leadingLikes > 0) {
        reasonParts.push(`top option has ${leadingLikes} like${leadingLikes === 1 ? '' : 's'}`);
      }
      if (tieEventIds.length > 1) {
        reasonParts.push('currently tied on likes');
      }

      return {
        id: issueKey,
        issueKey,
        type: 'open_decision',
        dimension: 'decisions',
        severity: decision.status === 'open' ? 'warning' : 'info',
        title: decision.status === 'open'
          ? 'Open group decision'
          : 'Deferred group decision',
        reason: reasonParts.join(' · '),
        relatedEventIds: decision.optionEventIds,
        affectedDates: getDecisionAffectedDates(decision),
        resolutionOptions: openDecisionResolutionOptions(
          decision.id,
          decision.status === 'deferred' ? 'deferred' : 'open',
          decision.slot?.date,
          decision.slot?.endDate,
        ),
      };
    })
);

export const detectOrphanExploringEvents = (
  events: Event[],
  decisions: DecisionSet[] = [],
): TripHealthIssue[] => {
  const reservedEventIds = getActiveDecisionEventIds(decisions);
  const orphans = events.filter((event) => (
    event.status === 'exploring'
    && isVoteableEvent(event)
    && !reservedEventIds.has(event.id)
  ));

  const orphansByDate = orphans.reduce((groups, event) => {
    const dateKey = getTimelineDateKey(event);
    if (!dateKey) return groups;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event.id);
    return groups;
  }, {} as Record<string, string[]>);

  return orphans.map((event) => {
    const issueKey = buildExploringEventIssueKey(event.id);
    const dateKey = getTimelineDateKey(event);
    const sameDayOrphanIds = dateKey ? orphansByDate[dateKey] ?? [event.id] : [event.id];

    return {
      id: issueKey,
      issueKey,
      type: 'exploring_event',
      dimension: 'decisions',
      severity: 'info',
      title: 'Option needs a decision',
      reason: sameDayOrphanIds.length >= 2
        ? `${getEventDisplayName(event)} is a draft and not grouped with ${sameDayOrphanIds.length - 1} other option${sameDayOrphanIds.length - 1 === 1 ? '' : 's'} that day.`
        : `${getEventDisplayName(event)} is still marked as ${EXPLORING_EVENT_UI_LABEL.toLowerCase()}.`,
      relatedEventIds: [event.id],
      affectedDates: dateKey ? [dateKey] : undefined,
      resolutionOptions: orphanExploringResolutionOptions(event.id, sameDayOrphanIds),
    };
  });
};

/** @deprecated Use detectOrphanExploringEvents — kept for tests importing the old name. */
export const detectExploringEvents = detectOrphanExploringEvents;
