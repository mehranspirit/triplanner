import { EXPLORING_EVENT_UI_LABEL, EXPLORING_EVENT_UI_LABEL_PLURAL } from '@/utils/eventStatusLabels';
import { ChevronRight, Plus, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDecisionSlot,
  getDecisionParticipation,
  getDecisionVoteStats,
  getOpenDecisions,
  getOrphanExploringEvents,
} from '@/utils/decisionHelpers';
import { Trip } from '@/types/eventTypes';

interface OpenDecisionsSectionProps {
  trip: Trip;
  canEdit: boolean;
  onOpenDecision: (decisionId: string) => void;
  onCreateDecision: () => void;
}

const OpenDecisionsSection: React.FC<OpenDecisionsSectionProps> = ({
  trip,
  canEdit,
  onOpenDecision,
  onCreateDecision,
}) => {
  const openDecisions = getOpenDecisions(trip.decisions);
  const orphanCount = getOrphanExploringEvents(trip).length;
  const collaboratorCount = 1 + (trip.collaborators?.length ?? 0);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <Vote className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Open decisions</h3>
            <p className="text-xs text-slate-500">
              Compare exploring options, collect votes, and confirm a winner.
            </p>
          </div>
        </div>
        {canEdit && orphanCount >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 rounded-full px-3 text-xs"
            onClick={onCreateDecision}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Compare options
          </Button>
        )}
      </div>

      {openDecisions.length > 0 ? (
        <div className="space-y-2">
          {openDecisions.map((decision) => {
            const participation = getDecisionParticipation(decision, trip.events, collaboratorCount);
            const stats = getDecisionVoteStats(decision, trip.events);
            const leadingLikes = stats.length > 0 ? Math.max(...stats.map((entry) => entry.likeCount)) : 0;
            const slotLabel = formatDecisionSlot(decision);

            return (
              <button
                key={decision.id}
                type="button"
                onClick={() => onOpenDecision(decision.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-violet-950">{decision.title}</p>
                  <p className="mt-0.5 text-xs text-violet-800/80">
                    {decision.optionEventIds.length} options
                    {slotLabel ? ` · ${slotLabel}` : ''}
                    {' · '}
                    {participation.votedCount}/{participation.eligibleCount} voted
                    {leadingLikes > 0 ? ` · top ${leadingLikes} like${leadingLikes === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-violet-500" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {orphanCount >= 2 ? (
            <>
              {orphanCount} {EXPLORING_EVENT_UI_LABEL_PLURAL.toLowerCase()} are ready to compare.
              {canEdit && ' Create a decision to group them for voting.'}
            </>
          ) : (
            <>
              Mark activities, destinations, or stays as
              {' '}
              <span className="font-medium text-stone-700">{EXPLORING_EVENT_UI_LABEL}</span>
              , then group at least two into a decision.
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OpenDecisionsSection;
