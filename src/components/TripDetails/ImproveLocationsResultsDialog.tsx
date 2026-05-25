import React, { useMemo } from 'react';
import { CheckCircle2, CircleAlert, CircleMinus, MapPin, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/eventTypes';
import { GeocodeEventResult } from '@/types/geocodingTypes';
import { getEventDisplayName, sortEventsByStart } from '@/utils/eventTime';
import { cn } from '@/lib/utils';

type ResultStatus = 'success' | 'approximate' | 'failed' | 'skipped' | 'no_improvement' | 'missing';

interface ImproveLocationsResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updatedCount: number;
  results: GeocodeEventResult[];
  events: Event[];
}

const getResultStatus = (result: GeocodeEventResult, event?: Event): ResultStatus => {
  if (result.skipped) {
    if (result.reason === 'no_query') {
      return 'missing';
    }
    if (result.reason === 'no_improvement') {
      const quality = result.location?.quality || event?.location?.quality;
      return quality === 'inferred' ? 'approximate' : 'no_improvement';
    }
    return 'skipped';
  }
  if (result.success) {
    return result.location?.quality === 'inferred' ? 'approximate' : 'success';
  }
  return 'failed';
};

const statusConfig: Record<ResultStatus, {
  label: string;
  icon: React.ReactNode;
  rowClassName: string;
  badgeClassName: string;
}> = {
  success: {
    label: 'Geocoded',
    icon: <CheckCircle2 className="h-4 w-4" />,
    rowClassName: 'border-emerald-100 bg-emerald-50/70',
    badgeClassName: 'bg-emerald-100 text-emerald-800',
  },
  approximate: {
    label: 'Approximate',
    icon: <CircleAlert className="h-4 w-4" />,
    rowClassName: 'border-amber-100 bg-amber-50/70',
    badgeClassName: 'bg-amber-100 text-amber-800',
  },
  failed: {
    label: 'Unresolved',
    icon: <XCircle className="h-4 w-4" />,
    rowClassName: 'border-rose-100 bg-rose-50/70',
    badgeClassName: 'bg-rose-100 text-rose-800',
  },
  skipped: {
    label: 'Already mapped',
    icon: <CircleMinus className="h-4 w-4" />,
    rowClassName: 'border-slate-200 bg-slate-50/80',
    badgeClassName: 'bg-slate-100 text-slate-700',
  },
  no_improvement: {
    label: 'No better match',
    icon: <CircleMinus className="h-4 w-4" />,
    rowClassName: 'border-slate-200 bg-slate-50/80',
    badgeClassName: 'bg-slate-100 text-slate-700',
  },
  missing: {
    label: 'No location text',
    icon: <CircleAlert className="h-4 w-4" />,
    rowClassName: 'border-amber-100 bg-amber-50/70',
    badgeClassName: 'bg-amber-100 text-amber-800',
  },
};

const getResultDetail = (result: GeocodeEventResult, event?: Event): string | undefined => {
  const status = getResultStatus(result, event);

  if (status === 'success') {
    const parts = [
      result.query ? `Matched "${result.query}"` : undefined,
      result.location?.address,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  if (status === 'approximate') {
    const parts = [
      result.query ? `Best match for "${result.query}"` : 'Low-confidence match',
      result.location?.address,
      'Add a clearer address if this looks wrong.',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  if (status === 'failed') {
    return result.query ? `No match for "${result.query}"` : 'Geocoding failed';
  }

  if (status === 'missing') {
    return 'Add an address or location name, then try again.';
  }

  if (status === 'no_improvement') {
    const queriesTried = result.queriesTried ? `Tried ${result.queriesTried} location queries. ` : '';
    return `${queriesTried}No fallback query produced a better match than the current location.`;
  }

  return event?.location?.address
    ? `Exact location stored: ${event.location.address}`
    : 'Exact coordinates are already stored.';
};

const ImproveLocationsResultsDialog: React.FC<ImproveLocationsResultsDialogProps> = ({
  open,
  onOpenChange,
  updatedCount,
  results,
  events,
}) => {
  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const sortedResults = useMemo(() => {
    const order = new Map(sortEventsByStart(events).map((event, index) => [event.id, index]));
    return [...results].sort((left, right) => (
      (order.get(left.eventId) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.eventId) ?? Number.MAX_SAFE_INTEGER)
    ));
  }, [events, results]);

  const summary = useMemo(() => ({
    success: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'success').length,
    approximate: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'approximate').length,
    failed: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'failed').length,
    skipped: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'skipped').length,
    noImprovement: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'no_improvement').length,
    missing: results.filter((result) => getResultStatus(result, eventsById.get(result.eventId)) === 'missing').length,
  }), [results, eventsById]);

  const summaryText = updatedCount > 0
    ? `${updatedCount} event location${updatedCount === 1 ? '' : 's'} updated.`
    : 'No event locations needed updates.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b px-6 py-5 pr-14 text-left">
          <div className="flex items-center gap-2 text-teal-700">
            <MapPin className="h-5 w-5" />
            <DialogTitle>Improve locations</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {summaryText}
          </DialogDescription>
          <div className="flex flex-wrap gap-2 text-xs">
            {summary.success > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                {summary.success} geocoded
              </span>
            )}
            {summary.approximate > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                {summary.approximate} approximate
              </span>
            )}
            {summary.failed > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800">
                {summary.failed} unresolved
              </span>
            )}
            {summary.missing > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                {summary.missing} missing text
              </span>
            )}
            {summary.skipped > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {summary.skipped} already mapped
              </span>
            )}
            {summary.noImprovement > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {summary.noImprovement} unchanged
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {sortedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events were checked.</p>
          ) : (
            <ul className="space-y-3">
              {sortedResults.map((result) => {
                const event = eventsById.get(result.eventId);
                const status = getResultStatus(result, event);
                const config = statusConfig[status];
                const detail = getResultDetail(result, event);

                return (
                  <li
                    key={result.eventId}
                    className={cn('rounded-xl border px-4 py-3', config.rowClassName)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {event ? getEventDisplayName(event) : `Event ${result.eventId}`}
                        </p>
                        {event && (
                          <p className="mt-0.5 text-xs capitalize text-slate-500">{event.type.replace('_', ' ')}</p>
                        )}
                      </div>
                      <span className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium',
                        config.badgeClassName
                      )}>
                        {config.icon}
                        {config.label}
                      </span>
                    </div>
                    {detail && (
                      <p className="mt-2 text-sm text-slate-600">{detail}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImproveLocationsResultsDialog;
