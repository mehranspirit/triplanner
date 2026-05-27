import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Trip } from '@/types/eventTypes';
import { TripHealthIssue, TripHealthSummary } from '@/types/tripHealthTypes';
import TripHealthSummaryCard from './TripHealthSummaryCard';
import TripHealthIssueList from './TripHealthIssueList';
import OpenDecisionsSection from '../decisions/OpenDecisionsSection';

interface PlanningPanelProps {
  trip: Trip;
  summary: TripHealthSummary;
  issues: TripHealthIssue[];
  isLoading?: boolean;
  canEdit: boolean;
  highlightIssueId?: string;
  onExecuteResolution: (action: TripHealthIssue['resolutionOptions'][number]['action'], payload?: Record<string, unknown>) => void;
  onOpenDecision: (decisionId: string) => void;
  onCreateDecision: () => void;
}

const PlanningPanel: React.FC<PlanningPanelProps> = ({
  trip,
  summary,
  issues,
  isLoading = false,
  canEdit,
  highlightIssueId,
  onExecuteResolution,
  onOpenDecision,
  onCreateDecision,
}) => {
  const highlightedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightIssueId || highlightedRef.current === highlightIssueId) return;

    const element = document.getElementById(`health-issue-${highlightIssueId}`);
    if (!element) return;

    highlightedRef.current = highlightIssueId;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');

    const timeout = window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [highlightIssueId, issues]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!canEdit && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            View-only access — you can review health issues, votes, and open decisions, but cannot resolve issues or confirm winners.
          </div>
        )}

        <TripHealthSummaryCard summary={summary} isLoading={isLoading} />

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Trip health</h3>
              <p className="text-xs text-slate-500">
                Issues grouped by schedule, lodging, transport, and more.
              </p>
            </div>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
            )}
          </div>

          <TripHealthIssueList
            issues={issues}
            canEdit={canEdit}
            isLoading={isLoading}
            onExecuteResolution={onExecuteResolution}
          />
        </div>

        <OpenDecisionsSection
          trip={trip}
          canEdit={canEdit}
          onOpenDecision={onOpenDecision}
          onCreateDecision={onCreateDecision}
        />
      </div>
    </div>
  );
};

export default PlanningPanel;
