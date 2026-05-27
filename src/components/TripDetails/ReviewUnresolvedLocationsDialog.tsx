import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
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
import { getEventDisplayName, sortEventsByStart } from '@/utils/eventTime';
import {
  eventHasMapCoordinates,
  eventNeedsGeocodeRetry,
  getEventLocationQuery,
} from '@/utils/eventLocation';
import { cn } from '@/lib/utils';

type UnresolvedStatus = 'missing_coords' | 'unresolved' | 'approximate';

interface ReviewUnresolvedLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
  onReviewAll: (events: Event[]) => void;
  onReviewSelected: (events: Event[]) => void;
}

const getUnresolvedStatus = (event: Event): UnresolvedStatus => {
  if (!eventHasMapCoordinates(event)) {
    return 'missing_coords';
  }

  if (event.location?.quality === 'inferred') {
    return 'approximate';
  }

  return 'unresolved';
};

const statusConfig: Record<UnresolvedStatus, {
  label: string;
  badgeClassName: string;
}> = {
  missing_coords: {
    label: 'No coordinates',
    badgeClassName: 'bg-rose-100 text-rose-800',
  },
  unresolved: {
    label: 'Unresolved',
    badgeClassName: 'bg-amber-100 text-amber-800',
  },
  approximate: {
    label: 'Approximate',
    badgeClassName: 'bg-slate-100 text-slate-700',
  },
};

const getUnresolvedDetail = (event: Event): string => {
  const query = getEventLocationQuery(event);
  const address = event.location?.address?.trim();

  if (address) {
    return address;
  }

  if (query) {
    return `Location text: ${query}`;
  }

  return 'Add location text or search manually from the event card.';
};

const ReviewUnresolvedLocationsDialog: React.FC<ReviewUnresolvedLocationsDialogProps> = ({
  open,
  onOpenChange,
  events,
  onReviewAll,
  onReviewSelected,
}) => {
  const unresolvedEvents = useMemo(
    () => sortEventsByStart(events.filter(eventNeedsGeocodeRetry)),
    [events],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = (eventId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectedEvents = unresolvedEvents.filter((event) => selectedIds.has(event.id));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set());
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b px-6 py-5 pr-14 text-left">
          <div className="flex items-center gap-2 text-teal-700">
            <MapPin className="h-5 w-5" />
            <DialogTitle>Review unresolved locations</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {unresolvedEvents.length > 0
              ? `${unresolvedEvents.length} event${unresolvedEvents.length === 1 ? '' : 's'} still need a confirmed map location.`
              : 'All events with location text already have confirmed coordinates.'}
          </DialogDescription>
          {unresolvedEvents.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800">
                {unresolvedEvents.filter((event) => getUnresolvedStatus(event) === 'missing_coords').length} without coordinates
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                {unresolvedEvents.filter((event) => getUnresolvedStatus(event) === 'unresolved').length} unresolved
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {unresolvedEvents.filter((event) => getUnresolvedStatus(event) === 'approximate').length} approximate
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {unresolvedEvents.length === 0 ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
              Nothing to review right now. New or edited events will prompt for location confirmation when saved.
            </div>
          ) : (
            <ul className="space-y-3">
              {unresolvedEvents.map((event) => {
                const status = getUnresolvedStatus(event);
                const config = statusConfig[status];
                const isSelected = selectedIds.has(event.id);

                return (
                  <li
                    key={event.id}
                    className={cn(
                      'rounded-xl border px-4 py-3 transition-colors',
                      isSelected ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(event.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        aria-label={`Select ${getEventDisplayName(event)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {getEventDisplayName(event)}
                            </p>
                            <p className="mt-0.5 text-xs capitalize text-slate-500">
                              {event.type.replace('_', ' ')}
                            </p>
                          </div>
                          <span className={cn(
                            'inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-medium',
                            config.badgeClassName,
                          )}>
                            {config.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{getUnresolvedDetail(event)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onReviewSelected([event])}
                      >
                        Review this event
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {selectedEvents.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onReviewSelected(selectedEvents)}
              >
                Review selected ({selectedEvents.length})
              </Button>
            )}
            <Button
              type="button"
              disabled={unresolvedEvents.length === 0}
              onClick={() => onReviewAll(unresolvedEvents)}
            >
              Review all ({unresolvedEvents.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewUnresolvedLocationsDialog;
