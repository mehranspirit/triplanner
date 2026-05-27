import React from 'react';
import { AlertTriangle, Edit, MapPin, Trash2 } from 'lucide-react';
import { Event, Trip } from '@/types/eventTypes';
import { DecisionSet } from '@/types/decisionTypes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getEventDisplayName, getEventStart } from '@/utils/eventTime';
import { formatCurrency } from '@/utils/format';
import EventVoteControls from '@/components/TripDetails/EventCards/EventVoteControls';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';
import {
  countStayNights,
  DecisionVoteStats,
  formatPerNightCost,
  getOptionSlotAlignment,
  getOptionSlotAlignmentLabel,
  getStayCheckInDateKey,
  getStayCheckOutDateKey,
} from '@/utils/decisionHelpers';
import { format } from 'date-fns';

interface DecisionOptionRowProps {
  event: Event;
  trip: Trip;
  decision: DecisionSet;
  stats: DecisionVoteStats;
  thumbnail?: string;
  currentUserId?: string;
  canEdit: boolean;
  canVote?: boolean;
  isTied?: boolean;
  isLeading?: boolean;
  onVote: (eventId: string, voteType: EventVoteAction) => void;
  onEdit?: (event: Event) => void;
  onRemove?: (eventId: string) => void;
  onConfirmWinner?: (eventId: string) => void;
}

const DecisionOptionRow: React.FC<DecisionOptionRowProps> = ({
  event,
  trip,
  decision,
  stats,
  thumbnail,
  currentUserId,
  canEdit,
  canVote = canEdit,
  isTied = false,
  isLeading = false,
  onVote,
  onEdit,
  onRemove,
  onConfirmWinner,
}) => {
  const start = getEventStart(event);
  const cost = 'cost' in event && typeof event.cost === 'number' ? event.cost : undefined;
  const slotAlignment = getOptionSlotAlignment(decision, event);
  const showSlotWarning = slotAlignment === 'misaligned' || slotAlignment === 'partial';
  const stayNights = event.type === 'stay'
    ? countStayNights(getStayCheckInDateKey(event), getStayCheckOutDateKey(event))
    : undefined;
  const perNightLabel = event.type === 'stay' && typeof cost === 'number' && stayNights
    ? formatPerNightCost(cost, stayNights)
    : null;

  return (
    <div
      id={`decision-option-${event.id}`}
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-shadow',
        isLeading && 'border-violet-300 ring-1 ring-violet-100',
        isTied && 'border-amber-300 bg-amber-50/40',
      )}
    >
      <div className="flex gap-3">
        {thumbnail && (
          <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:block">
            <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{getEventDisplayName(event)}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-500">{event.type}</p>
            </div>
            {isLeading && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                Leading
              </span>
            )}
            {showSlotWarning && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  slotAlignment === 'misaligned'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800',
                )}
                title={getOptionSlotAlignmentLabel(slotAlignment)}
              >
                <AlertTriangle className="h-3 w-3" />
                {slotAlignment === 'misaligned' ? 'Outside slot' : 'Partial slot fit'}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {start && (
              <p>{format(start, 'EEE, MMM d · h:mm a')}</p>
            )}
            {'address' in event && typeof event.address === 'string' && event.address && (
              <p className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {event.address}
              </p>
            )}
            {typeof cost === 'number' && (
              <p className="font-medium text-slate-700">
                {formatCurrency(cost, 'USD')}
                {perNightLabel && (
                  <span className="ml-1.5 font-normal text-slate-500">({perNightLabel})</span>
                )}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EventVoteControls
              event={event}
              trip={trip}
              currentUserId={currentUserId}
              onVote={onVote}
              readOnly={!canVote}
            />
            <span className="text-xs text-slate-500">
              {stats.likeCount} like{stats.likeCount === 1 ? '' : 's'}
              {stats.dislikeCount > 0 ? ` · ${stats.dislikeCount} dislike${stats.dislikeCount === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </div>
      </div>

      {canEdit && decision.status === 'open' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {onConfirmWinner && (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onConfirmWinner(event.id)}
            >
              Confirm this one
            </Button>
          )}
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => onEdit(event)}
            >
              <Edit className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {onRemove && decision.optionEventIds.length > 2 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs text-rose-600 hover:text-rose-700"
              onClick={() => onRemove(event.id)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionOptionRow;
