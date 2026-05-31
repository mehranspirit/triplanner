import React, { useMemo } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Event, Trip } from '@/types/eventTypes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';
import EventVoteControls from '@/components/TripDetails/EventCards/EventVoteControls';
import EventDetailBody from '@/components/TripDetails/EventCards/EventDetailBody';
import EventDetailContextBlocks from '@/components/TripDetails/EventCards/EventDetailContextBlocks';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';
import {
  buildEventActions,
  filterEventActions,
  type EventActionHandlers,
} from '@/utils/eventActions';
import {
  getEventDisplayName,
  getEventLocationLabel,
} from '@/utils/eventTime';
import { formatEventDetailTimeRange } from '@/utils/eventGlance';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { OutboundTransferContext } from '@/utils/eventDetailContent';

interface EventDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  thumbnail?: string;
  trip?: Trip;
  currentUserId?: string;
  canEdit?: boolean;
  currency?: string;
  weatherLabel?: string | null;
  flightStatus?: FlightStatusSnapshot | null;
  outboundTransfer?: OutboundTransferContext | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
  onVote?: (eventId: string, voteType: EventVoteAction) => void;
  onReviewLocation?: () => void;
}

const EventDetailSheet: React.FC<EventDetailSheetProps> = ({
  open,
  onOpenChange,
  event,
  thumbnail,
  trip,
  currentUserId,
  canEdit = false,
  currency = 'USD',
  weatherLabel,
  flightStatus,
  outboundTransfer,
  onEdit,
  onDelete,
  onStatusChange,
  onVote,
  onReviewLocation,
}) => {
  const handlers: EventActionHandlers = useMemo(() => ({
    onEdit,
    onDelete,
    onStatusChange,
    onReviewLocation,
  }), [onEdit, onDelete, onStatusChange, onReviewLocation]);

  const actions = useMemo(() => (
    event ? buildEventActions(event, handlers, canEdit) : []
  ), [event, handlers, canEdit]);

  const primaryActions = useMemo(
    () => filterEventActions(actions, 'sheet-primary'),
    [actions],
  );

  const overflowActions = useMemo(
    () => filterEventActions(actions, 'sheet-overflow'),
    [actions],
  );

  if (!event) return null;

  const isExploring = event.status === 'exploring';
  const location = getEventLocationLabel(event) || (event as { address?: string }).address;
  const voteable = isExploring
    && (event.type === 'activity' || event.type === 'destination' || event.type === 'stay')
    && trip
    && onVote;

  const handleMarkConfirmed = () => {
    if (canEdit && onStatusChange && isExploring) {
      onStatusChange('confirmed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0',
          'fixed inset-x-0 bottom-0 top-auto max-w-none translate-x-0 translate-y-0',
          'rounded-t-2xl border-b-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg',
          'sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border-b',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />

        <div className="overflow-y-auto px-5 pb-5 pt-3 sm:pt-6">
          {thumbnail && (
            <div className="mb-4 h-32 w-full overflow-hidden rounded-xl sm:h-36">
              <img
                src={thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-left text-xl font-semibold text-slate-950">
                {getEventDisplayName(event)}
              </DialogTitle>
              <EventStatusChip event={event} />
            </div>
            <DialogDescription className="text-left text-sm text-slate-600">
              {formatEventDetailTimeRange(event)}
            </DialogDescription>
            {location && (
              <p className="text-sm text-slate-600">{location}</p>
            )}
          </div>

          {primaryActions.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-2 px-3 py-2.5 text-left text-sm font-medium"
                    onClick={action.handler}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          )}

          <EventDetailBody event={event} currency={currency} />

          <EventDetailContextBlocks
            event={event}
            weatherLabel={weatherLabel}
            flightStatus={flightStatus}
            outboundTransfer={outboundTransfer}
          />

          {voteable && (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Group votes
              </p>
              <EventVoteControls
                event={event}
                trip={trip}
                currentUserId={currentUserId}
                onVote={onVote}
                readOnly={!canEdit}
              />
              {canEdit && onStatusChange && isExploring && (
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleMarkConfirmed}
                >
                  Mark as confirmed
                </Button>
              )}
            </div>
          )}

          {canEdit && onStatusChange && isExploring && !voteable && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <Button
                type="button"
                className="w-full"
                onClick={handleMarkConfirmed}
              >
                Mark as confirmed
              </Button>
            </div>
          )}
        </div>

        {canEdit && (onEdit || overflowActions.length > 0) && (
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onEdit}
              >
                Edit
              </Button>
            )}
            {overflowActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {overflowActions.map((action, index) => {
                    const Icon = action.icon;
                    const isDestructive = action.tier === 'destructive';
                    const showSeparator = isDestructive && index > 0
                      && overflowActions[index - 1]?.tier !== 'destructive';

                    return (
                      <React.Fragment key={action.id}>
                        {showSeparator && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={action.handler}
                          className={cn(isDestructive && 'text-red-600 focus:text-red-600')}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {action.label}
                        </DropdownMenuItem>
                      </React.Fragment>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!onEdit && overflowActions.length === 0 && (
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailSheet;
