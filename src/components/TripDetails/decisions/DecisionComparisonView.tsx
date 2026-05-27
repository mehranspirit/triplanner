import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Loader2, Plus, Scale, Sparkles, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Event, Trip } from '@/types/eventTypes';
import { DecisionSet } from '@/types/decisionTypes';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';
import DecisionOptionRow from './DecisionOptionRow';
import ConfirmDecisionDialog from './ConfirmDecisionDialog';
import DeleteDecisionDialog from './DeleteDecisionDialog';
import ComparisonOverviewPanel from './ComparisonOverviewPanel';
import {
  formatDecisionSlot,
  getDecisionParticipation,
  getDecisionTieEventIds,
  getDecisionVoteStats,
  sortDecisionOptionEvents,
} from '@/utils/decisionHelpers';

interface DecisionComparisonViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  decision: DecisionSet | null;
  eventThumbnails: Record<string, string>;
  currentUserId?: string;
  canEdit: boolean;
  onVote: (eventId: string, voteType: EventVoteAction) => void;
  onEditEvent: (event: Event) => void;
  onRemoveOption: (decisionId: string, eventId: string) => Promise<void>;
  onDeferDecision: (decisionId: string) => Promise<void>;
  onDeleteDecision?: (decisionId: string) => Promise<void>;
  onConfirmDecision: (decisionId: string, winnerEventId: string, loserAction: 'archive' | 'delete' | 'keep_exploring') => Promise<void>;
  onAddExistingOption?: () => void;
  onExploreNewOption?: () => void;
  onGenerateComparisonOverview?: (decisionId: string, options?: { refresh?: boolean }) => Promise<void>;
}

const OVERVIEW_COLLAPSE_KEY = 'triplanner.decisionOverviewCollapsed';

const DecisionComparisonView: React.FC<DecisionComparisonViewProps> = ({
  open,
  onOpenChange,
  trip,
  decision,
  eventThumbnails,
  currentUserId,
  canEdit,
  onVote,
  onEditEvent,
  onRemoveOption,
  onDeferDecision,
  onDeleteDecision,
  onConfirmDecision,
  onAddExistingOption,
  onExploreNewOption,
  onGenerateComparisonOverview,
}) => {
  const [confirmWinnerId, setConfirmWinnerId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeferring, setIsDeferring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(() => {
    try {
      return localStorage.getItem(OVERVIEW_COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const optionEvents = useMemo(
    () => (decision ? sortDecisionOptionEvents(decision, trip.events) : []),
    [decision, trip.events],
  );

  const voteStats = useMemo(
    () => (decision ? getDecisionVoteStats(decision, trip.events) : []),
    [decision, trip.events],
  );

  const tieEventIds = useMemo(
    () => (decision ? getDecisionTieEventIds(decision, trip.events) : []),
    [decision, trip.events],
  );

  const participation = useMemo(() => {
    if (!decision) return { votedCount: 0, eligibleCount: 1 };
    const collaboratorCount = 1 + (trip.collaborators?.length ?? 0);
    return getDecisionParticipation(decision, trip.events, collaboratorCount);
  }, [decision, trip.events, trip.collaborators]);

  const statsByEventId = useMemo(
    () => new Map(voteStats.map((entry) => [entry.eventId, entry])),
    [voteStats],
  );

  const maxLikes = voteStats.length > 0 ? Math.max(...voteStats.map((entry) => entry.likeCount)) : 0;
  const winnerEvent = confirmWinnerId
    ? trip.events.find((event) => event.id === confirmWinnerId) ?? null
    : null;
  const loserEvents = confirmWinnerId
    ? optionEvents.filter((event) => event.id !== confirmWinnerId)
    : [];

  const hasFreshOverview = Boolean(
    decision?.comparisonOverview && !decision.comparisonOverview.stale,
  );

  useEffect(() => {
    if (!open || !decision || !onGenerateComparisonOverview) return;

    if (hasFreshOverview) {
      setIsOverviewLoading(false);
      setOverviewError(null);
      return;
    }

    let cancelled = false;
    setIsOverviewLoading(true);
    setOverviewError(null);

    onGenerateComparisonOverview(decision.id)
      .catch((error) => {
        if (!cancelled) {
          setOverviewError(error instanceof Error ? error.message : 'Failed to load comparison overview');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsOverviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, decision?.id, hasFreshOverview, onGenerateComparisonOverview]);

  const handleToggleOverviewCollapse = () => {
    setIsOverviewCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(OVERVIEW_COLLAPSE_KEY, String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  const handleRegenerateOverview = async () => {
    if (!decision || !onGenerateComparisonOverview) return;
    setIsOverviewLoading(true);
    setOverviewError(null);
    try {
      await onGenerateComparisonOverview(decision.id, { refresh: true });
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Failed to regenerate overview');
    } finally {
      setIsOverviewLoading(false);
    }
  };

  const handleConfirm = async (loserAction: 'archive' | 'delete' | 'keep_exploring') => {
    if (!decision || !confirmWinnerId) return;

    setIsConfirming(true);
    setActionError(null);
    try {
      await onConfirmDecision(decision.id, confirmWinnerId, loserAction);
      setConfirmWinnerId(null);
      onOpenChange(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to confirm decision');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDefer = async () => {
    if (!decision) return;
    setIsDeferring(true);
    setActionError(null);
    try {
      await onDeferDecision(decision.id);
      onOpenChange(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to defer decision');
    } finally {
      setIsDeferring(false);
    }
  };

  const handleDelete = async () => {
    if (!decision || !onDeleteDecision) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await onDeleteDecision(decision.id);
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete decision');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!decision) return null;

  const slotLabel = formatDecisionSlot(decision);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[680px]">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 pr-12 text-left">
            <div>
              <DialogTitle className="text-lg">{decision.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {decision.optionEventIds.length} options
                {slotLabel ? ` · ${slotLabel}` : ''}
                {' · '}
                {participation.votedCount} of {participation.eligibleCount} voted
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {!canEdit && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                View-only — vote counts are visible, but only editors can vote or confirm a winner.
              </div>
            )}

            {tieEventIds.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  It&apos;s a tie between {tieEventIds.length} options with {maxLikes} like{maxLikes === 1 ? '' : 's'} each.
                  Ask collaborators to revote, or confirm a winner when ready.
                </span>
              </div>
            )}

            <ComparisonOverviewPanel
              overview={decision.comparisonOverview}
              optionEvents={optionEvents}
              isLoading={isOverviewLoading || (!hasFreshOverview && !overviewError)}
              isStale={Boolean(decision.comparisonOverview?.stale)}
              isCollapsed={isOverviewCollapsed}
              onToggleCollapse={handleToggleOverviewCollapse}
              onRegenerate={canEdit && onGenerateComparisonOverview ? handleRegenerateOverview : undefined}
            />

            {overviewError && (
              <p className="mb-4 text-sm text-red-600">{overviewError}</p>
            )}

            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-violet-900">
              <div className="flex items-center gap-2 font-medium">
                <Scale className="h-3.5 w-3.5" />
                Vote on each option, then confirm the winner when the group is ready.
              </div>
            </div>

            <div className="space-y-3">
              {optionEvents.map((event) => {
                const stats = statsByEventId.get(event.id) ?? {
                  eventId: event.id,
                  likeCount: 0,
                  dislikeCount: 0,
                  voterCount: 0,
                };
                const isTied = tieEventIds.includes(event.id);
                const isLeading = maxLikes > 0 && stats.likeCount === maxLikes && !isTied;

                return (
                  <DecisionOptionRow
                    key={event.id}
                    event={event}
                    trip={trip}
                    decision={decision}
                    stats={stats}
                    thumbnail={eventThumbnails[event.id]}
                    currentUserId={currentUserId}
                    canEdit={canEdit}
                    canVote={canEdit}
                    isTied={isTied}
                    isLeading={isLeading}
                    onVote={onVote}
                    onEdit={canEdit ? onEditEvent : undefined}
                    onRemove={canEdit ? (eventId) => onRemoveOption(decision.id, eventId) : undefined}
                    onConfirmWinner={canEdit ? setConfirmWinnerId : undefined}
                  />
                );
              })}
            </div>

            {canEdit && decision.status === 'open' && (onAddExistingOption || onExploreNewOption) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {onAddExistingOption && (
                  <Button type="button" variant="outline" size="sm" onClick={onAddExistingOption}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add existing option
                  </Button>
                )}
                {onExploreNewOption && (
                  <Button type="button" variant="outline" size="sm" onClick={onExploreNewOption}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Explore new option
                  </Button>
                )}
              </div>
            )}

            {actionError && (
              <p className="mt-4 text-sm text-red-600">{actionError}</p>
            )}
          </div>

          {canEdit && (decision.status === 'open' || decision.status === 'deferred') && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {decision.status === 'open' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDeferring || isConfirming || isDeleting}
                    onClick={handleDefer}
                  >
                    {isDeferring ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deferring...
                      </>
                    ) : (
                      <>
                        <Clock3 className="mr-2 h-4 w-4" />
                        Decide later
                      </>
                    )}
                  </Button>
                )}
                {onDeleteDecision && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-rose-700 hover:text-rose-800"
                    disabled={isDeferring || isConfirming || isDeleting}
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete decision
                  </Button>
                )}
              </div>
              {decision.status === 'open' && (
                <p className="text-xs text-slate-500">
                  Use &quot;Confirm this one&quot; on an option to close the decision.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDecisionDialog
        open={Boolean(confirmWinnerId)}
        onOpenChange={(nextOpen) => !nextOpen && setConfirmWinnerId(null)}
        winnerEvent={winnerEvent}
        loserEvents={loserEvents}
        isTied={Boolean(confirmWinnerId && tieEventIds.includes(confirmWinnerId))}
        isSubmitting={isConfirming}
        onConfirm={handleConfirm}
      />

      <DeleteDecisionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        decision={decision}
        isSubmitting={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default DecisionComparisonView;
