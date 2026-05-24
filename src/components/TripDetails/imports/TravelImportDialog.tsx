import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Event } from '@/types/eventTypes';
import { TravelImport, TravelImportStatus } from '@/types/travelImportTypes';
import { buildParsedEventCandidates, ParsedEventCandidate } from '@/services/travelImportValidation';
import { formatEventDateTime, getEventDisplayName, getEventStart } from '@/utils/eventTime';

export type ImportInboxFilter = 'open' | 'needs_review' | 'missing_info' | 'duplicate' | 'done' | 'failed';

const importInboxFilters: Array<{ id: ImportInboxFilter; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'missing_info', label: 'Missing info' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'done', label: 'Done' },
  { id: 'failed', label: 'Failed' },
];

const matchesImportInboxFilter = (travelImport: TravelImport, filter: ImportInboxFilter) => {
  if (filter === 'open') {
    return ['parsed', 'needs_review', 'missing_info', 'duplicate', 'unsupported'].includes(travelImport.status);
  }
  if (filter === 'done') {
    return ['accepted', 'partially_accepted', 'dismissed'].includes(travelImport.status);
  }
  return travelImport.status === filter;
};

const getImportStatusLabel = (status: TravelImportStatus) => {
  const labels: Record<TravelImportStatus, string> = {
    parsed: 'Needs review',
    needs_review: 'Needs review',
    missing_info: 'Missing info',
    duplicate: 'Possible duplicate',
    failed: 'Failed',
    accepted: 'Accepted',
    partially_accepted: 'Partially accepted',
    dismissed: 'Dismissed',
    unsupported: 'Unsupported',
  };
  return labels[status] || status;
};

const getImportStatusClassName = (status: TravelImportStatus) => {
  if (status === 'failed' || status === 'unsupported') return 'bg-red-100 text-red-700';
  if (status === 'missing_info' || status === 'duplicate' || status === 'partially_accepted') return 'bg-amber-100 text-amber-700';
  if (status === 'accepted') return 'bg-green-100 text-green-700';
  if (status === 'dismissed') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-700';
};

const getImportFallbackTitle = (travelImport: TravelImport) => {
  const firstEvent = travelImport.parsedEvents?.[0];
  if (firstEvent) return getEventDisplayName(firstEvent);
  if (travelImport.status === 'failed') return 'Failed import';
  return 'Pasted import';
};

const formatImportIssue = (issue: string) => (
  issue
    .replace(/^Missing required field:\s*/i, 'Missing ')
    .replace(/^Missing or invalid start time$/i, 'Missing or invalid start time')
    .replace(/^Missing or invalid end time$/i, 'Missing or invalid end time')
);

const getImportIssueSummaries = (travelImport: TravelImport, existingEvents: Event[]) => {
  const issueSet = new Set<string>();

  (travelImport.validationErrors || []).forEach((issue) => {
    if (issue.trim()) issueSet.add(formatImportIssue(issue));
  });

  if (travelImport.duplicateOfImportId) {
    issueSet.add('Same source as an earlier inbox item');
  }

  if (!['accepted', 'dismissed'].includes(travelImport.status) && travelImport.parsedEvents?.length > 0) {
    buildParsedEventCandidates(travelImport.parsedEvents, existingEvents).forEach((candidate) => {
      candidate.validation.errors.forEach((issue) => issueSet.add(formatImportIssue(issue)));
      candidate.validation.warnings.forEach((issue) => issueSet.add(formatImportIssue(issue)));
      candidate.validation.duplicateEventIds.forEach((eventId) => {
        const eventName = existingEvents.find((event) => event.id === eventId);
        issueSet.add(eventName ? `Possible duplicate of ${getEventDisplayName(eventName)}` : 'Possible duplicate of an existing event');
      });
    });
  }

  return Array.from(issueSet).slice(0, 4);
};

interface TravelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseText: string;
  onParseTextChange: (text: string) => void;
  isParsing: boolean;
  parseError: string | null;
  parseWarning: string | null;
  parsedCandidates: ParsedEventCandidate[];
  onParsedCandidatesChange: (candidates: ParsedEventCandidate[]) => void;
  isAddingParsedEvents: boolean;
  travelImports: TravelImport[];
  importInboxFilter: ImportInboxFilter;
  onImportInboxFilterChange: (filter: ImportInboxFilter) => void;
  showAllTravelImports: boolean;
  onShowAllTravelImportsChange: (showAll: boolean | ((current: boolean) => boolean)) => void;
  isLoadingTravelImports: boolean;
  travelImportError: string | null;
  existingEvents: Event[];
  onRefreshTravelImports: () => void;
  onReviewTravelImport: (travelImport: TravelImport) => void;
  onDismissTravelImport: (travelImport: TravelImport) => void;
  onCancel: () => void;
  onParse: () => void;
  onAddParsedCandidates: () => void;
}

const TravelImportDialog: React.FC<TravelImportDialogProps> = ({
  open,
  onOpenChange,
  parseText,
  onParseTextChange,
  isParsing,
  parseError,
  parseWarning,
  parsedCandidates,
  onParsedCandidatesChange,
  isAddingParsedEvents,
  travelImports,
  importInboxFilter,
  onImportInboxFilterChange,
  showAllTravelImports,
  onShowAllTravelImportsChange,
  isLoadingTravelImports,
  travelImportError,
  existingEvents,
  onRefreshTravelImports,
  onReviewTravelImport,
  onDismissTravelImport,
  onCancel,
  onParse,
  onAddParsedCandidates,
}) => {
  const filteredTravelImports = travelImports.filter(travelImport => matchesImportInboxFilter(travelImport, importInboxFilter));
  const visibleTravelImports = showAllTravelImports ? filteredTravelImports : filteredTravelImports.slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import booking details</DialogTitle>
          <DialogDescription>
            Paste your event details, reservation email, or natural language description.
            The AI will extract event candidates for you to review before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Import Inbox</h3>
                <p className="text-sm text-gray-500">
                  Recent parsed inputs stay here until accepted, dismissed, or reviewed again.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onRefreshTravelImports} disabled={isLoadingTravelImports}>
                {isLoadingTravelImports ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            {travelImportError && (
              <p className="mt-2 text-sm text-red-600">{travelImportError}</p>
            )}
            {travelImports.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {importInboxFilters.map((filter) => {
                  const count = travelImports.filter(travelImport => matchesImportInboxFilter(travelImport, filter.id)).length;
                  return (
                    <Button
                      key={filter.id}
                      type="button"
                      variant={importInboxFilter === filter.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        onImportInboxFilterChange(filter.id);
                        onShowAllTravelImportsChange(false);
                      }}
                    >
                      {filter.label}
                      <span className="ml-1 opacity-75">{count}</span>
                    </Button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {travelImports.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                  No imports yet. Paste booking text below to create the first inbox item.
                </p>
              ) : filteredTravelImports.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                  No imports match this filter.
                </p>
              ) : (
                visibleTravelImports.map((travelImport) => {
                  const parsedCount = travelImport.parsedEvents?.length || 0;
                  const canReview = parsedCount > 0 && !['accepted', 'dismissed', 'failed', 'unsupported'].includes(travelImport.status);
                  const sourceTitle = travelImport.sourceTitle || getImportFallbackTitle(travelImport);
                  const issueSummaries = getImportIssueSummaries(travelImport, existingEvents);
                  return (
                    <div key={travelImport._id} className="rounded-md border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getImportStatusClassName(travelImport.status)}`}>
                              {getImportStatusLabel(travelImport.status)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(travelImport.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm font-medium text-gray-900">
                            {sourceTitle}
                          </p>
                          {travelImport.sourceExcerpt && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                              {travelImport.sourceExcerpt}
                            </p>
                          )}
                          <p className="mt-2 text-sm text-gray-700">
                            {parsedCount > 0
                              ? `${parsedCount} extracted event${parsedCount === 1 ? '' : 's'}`
                              : travelImport.status === 'failed'
                                ? 'Could not parse this input'
                                : 'No event candidates extracted'}
                          </p>
                          {issueSummaries.length > 0 && (
                            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                              <p className="text-xs font-medium text-amber-800">Needs attention</p>
                              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                                {issueSummaries.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canReview && (
                            <Button variant="outline" size="sm" onClick={() => onReviewTravelImport(travelImport)}>
                              Review
                            </Button>
                          )}
                          {!['accepted', 'dismissed'].includes(travelImport.status) && (
                            <Button variant="ghost" size="sm" onClick={() => onDismissTravelImport(travelImport)}>
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {filteredTravelImports.length > 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs"
                onClick={() => onShowAllTravelImportsChange(prev => !prev)}
              >
                {showAllTravelImports
                  ? 'Show less'
                  : `Show all ${filteredTravelImports.length} imports`}
              </Button>
            )}
          </div>

          <Textarea
            placeholder="Paste your text here..."
            value={parseText}
            onChange={(event) => onParseTextChange(event.target.value)}
            className="min-h-[200px]"
            disabled={isParsing || isAddingParsedEvents}
          />
          {parseError && (
            <p className="mt-2 text-sm text-red-500">{parseError}</p>
          )}
          {parseWarning && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {parseWarning}
            </p>
          )}

          {parsedCandidates.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Review extracted events</h3>
                <p className="text-sm text-gray-500">
                  Select the valid events you want to add. Candidates with errors must be fixed manually before they can be saved.
                </p>
              </div>
              {parsedCandidates.map((candidate, index) => {
                const start = getEventStart(candidate.event);
                const hasIssues = candidate.validation.errors.length > 0 || candidate.validation.warnings.length > 0;

                return (
                  <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={candidate.selected}
                        disabled={!candidate.validation.valid || isAddingParsedEvents}
                        onChange={(event) => {
                          const nextCandidates = [...parsedCandidates];
                          nextCandidates[index] = {
                            ...candidate,
                            selected: event.target.checked,
                          };
                          onParsedCandidatesChange(nextCandidates);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium text-gray-900">{getEventDisplayName(candidate.event)}</h4>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {candidate.event.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{formatEventDateTime(start)}</p>

                        {hasIssues && (
                          <div className="mt-3 space-y-1 text-sm">
                            {candidate.validation.errors.map((error) => (
                              <p key={error} className="text-red-600">Error: {error}</p>
                            ))}
                            {candidate.validation.warnings.map((warning) => (
                              <p key={warning} className="text-amber-600">Warning: {warning}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isParsing || isAddingParsedEvents}
          >
            Cancel
          </Button>
          {parsedCandidates.length === 0 ? (
            <Button
              onClick={onParse}
              disabled={!parseText.trim() || isParsing}
            >
              {isParsing ? 'Parsing...' : 'Parse Text'}
            </Button>
          ) : (
            <Button
              onClick={onAddParsedCandidates}
              disabled={
                isAddingParsedEvents ||
                !parsedCandidates.some(candidate => candidate.selected && candidate.validation.valid)
              }
            >
              {isAddingParsedEvents ? 'Adding...' : 'Add Selected Events'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TravelImportDialog;
