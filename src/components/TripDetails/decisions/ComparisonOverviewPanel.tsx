import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecisionComparisonOverview } from '@/types/decisionTypes';
import { Event } from '@/types/eventTypes';
import { getGoogleMapsSearchUrl } from '@/utils/eventLocation';
import { getEventDisplayName } from '@/utils/eventTime';
import { cn } from '@/lib/utils';

interface ComparisonOverviewPanelProps {
  overview: DecisionComparisonOverview | null | undefined;
  optionEvents: Event[];
  isLoading?: boolean;
  isStale?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onRegenerate?: () => void;
}

const highlightClassName = (highlight?: 'best' | 'worst' | 'neutral') => {
  if (highlight === 'best') return 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100';
  if (highlight === 'worst') return 'bg-rose-50 text-rose-900 ring-1 ring-rose-100';
  return 'bg-white text-slate-700 ring-1 ring-slate-100';
};

const comparisonTypeLabel = (type?: string) => {
  if (type === 'stay') return 'Stay comparison';
  if (type === 'destination') return 'Destination comparison';
  if (type === 'activity') return 'Activity comparison';
  return null;
};

const ComparisonOverviewPanel: React.FC<ComparisonOverviewPanelProps> = ({
  overview,
  optionEvents,
  isLoading = false,
  isStale = false,
  isCollapsed = false,
  onToggleCollapse,
  onRegenerate,
}) => {
  const optionNames = useMemo(
    () => new Map(optionEvents.map((event) => [event.id, getEventDisplayName(event)])),
    [optionEvents],
  );

  const mapsUrls = useMemo(
    () => new Map(
      optionEvents
        .map((event) => [event.id, getGoogleMapsSearchUrl(event)] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
    [optionEvents],
  );

  if (isLoading && !overview) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-3 text-sm text-violet-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        Building comparison overview...
      </div>
    );
  }

  if (!overview) return null;

  const typeLabel = comparisonTypeLabel(overview.context?.comparisonType);

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Comparison overview
            {overview.generatedBy === 'deterministic' && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Facts only
              </span>
            )}
            {isStale && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Stale
              </span>
            )}
          </div>
          {(typeLabel || overview.context?.slotLabel || overview.context?.referenceLabel) && !isCollapsed && (
            <div className="mt-2 flex flex-wrap gap-2">
              {typeLabel && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                  {typeLabel}
                </span>
              )}
              {overview.context?.slotLabel && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {overview.context.slotLabel}
                </span>
              )}
              {overview.context?.referenceLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                  <MapPin className="h-3 w-3" />
                  {overview.context.referenceLabel}
                </span>
              )}
            </div>
          )}
          {!isCollapsed && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{overview.summary}</p>
          )}
          {!isCollapsed && overview.context?.referenceDescription && (
            <p className="mt-1 text-xs text-slate-500">{overview.context.referenceDescription}</p>
          )}
          {!isCollapsed && overview.context?.staticMapUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img
                src={overview.context.staticMapUrl}
                alt="Map comparing option locations"
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRegenerate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isLoading}
              onClick={onRegenerate}
              title="Regenerate overview"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
          {onToggleCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand overview' : 'Collapse overview'}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 px-4 py-4">
          {overview.dimensions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Compare at a glance
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 font-semibold text-slate-500"> </th>
                      {optionEvents.map((event) => {
                        const mapsUrl = mapsUrls.get(event.id);
                        return (
                          <th key={event.id} className="px-3 py-2 font-semibold text-slate-900">
                            <div className="flex items-start gap-1.5">
                              <span>{optionNames.get(event.id)}</span>
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-blue-600 hover:text-blue-800"
                                  title="Open in Google Maps"
                                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {overview.dimensions.map((dimension) => (
                      <tr key={dimension.key} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-medium text-slate-500">{dimension.label}</td>
                        {optionEvents.map((event) => {
                          const cell = dimension.values.find((value) => value.eventId === event.id);
                          return (
                            <td key={event.id} className="px-3 py-2 align-top">
                              <span
                                className={cn(
                                  'inline-block rounded-lg px-2 py-1',
                                  highlightClassName(cell?.highlight),
                                )}
                              >
                                {cell?.display || '—'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {overview.optionSummaries.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {overview.optionSummaries.map((summary) => {
                const mapsUrl = mapsUrls.get(summary.eventId);
                return (
                  <div key={summary.eventId} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {optionNames.get(summary.eventId) || summary.eventId}
                      </p>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                        >
                          <MapPin className="h-3 w-3" />
                          Maps
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{summary.oneLiner}</p>
                    {summary.bestFor.length > 0 && (
                      <p className="mt-2 text-[11px] text-emerald-700">
                        Best for: {summary.bestFor.join(' · ')}
                      </p>
                    )}
                    {summary.watchOuts.length > 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Watch out: {summary.watchOuts.join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {overview.tradeoffs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tradeoffs</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {overview.tradeoffs.map((tradeoff) => (
                  <li key={tradeoff} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
                    {tradeoff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overview.softRecommendation && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Suggested pick ({overview.softRecommendation.confidence} confidence)
              </p>
              <p className="mt-1 text-sm font-semibold text-violet-950">
                {overview.softRecommendation.label}
              </p>
              <p className="mt-1 text-sm text-violet-900">{overview.softRecommendation.reason}</p>
              {overview.softRecommendation.caveats.length > 0 && (
                <p className="mt-2 text-xs text-violet-800">
                  Caveats: {overview.softRecommendation.caveats.join(' · ')}
                </p>
              )}
            </div>
          )}

          {overview.missingInfo.length > 0 && (
            <p className="text-xs text-slate-500">
              Missing info: {overview.missingInfo.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonOverviewPanel;
