import React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { Event, Trip } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import {
  EventVoteAction,
  getUserVoteStatus,
  getVoterDisplayNames,
} from '@/components/TripDetails/hooks/useEventVotes';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EventVoteControlsProps {
  event: Event;
  trip: Trip;
  currentUserId?: string;
  onVote: (eventId: string, voteType: EventVoteAction) => void;
  readOnly?: boolean;
  className?: string;
  variant?: 'default' | 'timeline';
  size?: 'default' | 'compact';
}

const EventVoteControls: React.FC<EventVoteControlsProps> = ({
  event,
  trip,
  currentUserId,
  onVote,
  readOnly = false,
  className,
  variant = 'default',
  size = 'default',
}) => {
  const isCompact = size === 'compact' || variant === 'timeline';
  const voteStatus = getUserVoteStatus(event, currentUserId);
  const voterNames = getVoterDisplayNames(event, trip, currentUserId);
  const likeCount = event.likes?.length ?? 0;
  const dislikeCount = event.dislikes?.length ?? 0;

  const handleVoteClick = (voteType: 'like' | 'dislike') => {
    const activeVote = voteType === 'like' ? 'liked' : 'disliked';
    if (voteStatus === activeVote) {
      onVote(event.id, 'remove');
      return;
    }
    onVote(event.id, voteType);
  };

  const tooltipBody = [
    likeCount > 0 ? `Likes: ${voterNames.likes.join(', ')}` : null,
    dislikeCount > 0 ? `Dislikes: ${voterNames.dislikes.join(', ')}` : null,
  ].filter(Boolean).join(' · ');

  const shellClass = variant === 'timeline'
    ? 'border-stone-300/80 bg-[#EDE4D3]/90 shadow-sm'
    : 'border-amber-200/80 bg-amber-50/80';

  const buttonClass = isCompact
    ? 'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors'
    : 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors';

  const iconClass = isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (readOnly) {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-full border',
          isCompact ? 'gap-1 px-1.5 py-0.5 text-[10px]' : 'gap-2 px-2 py-0.5 text-xs',
          variant === 'timeline'
            ? 'border-stone-300/80 bg-[#EDE4D3]/90 text-stone-700'
            : 'border-slate-200 bg-slate-50 text-slate-600',
          className,
        )}
        title={tooltipBody || undefined}
      >
        <span className="inline-flex items-center gap-0.5">
          <ThumbsUp className={iconClass} />
          {likeCount}
        </span>
        <span className="inline-flex items-center gap-0.5">
          <ThumbsDown className={iconClass} />
          {dislikeCount}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'flex items-center rounded-full border',
          isCompact ? 'gap-0 px-0.5 py-0' : 'gap-1 px-1 py-0.5',
          shellClass,
          className,
        )}
        onClick={(eventClick) => eventClick.stopPropagation()}
        onMouseDown={(eventClick) => eventClick.preventDefault()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                buttonClass,
                voteStatus === 'liked'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-white hover:text-emerald-700',
              )}
              onClick={() => handleVoteClick('like')}
              onMouseDown={(eventClick) => eventClick.preventDefault()}
              aria-pressed={voteStatus === 'liked'}
            >
              <ThumbsUp className={iconClass} />
              <span>{likeCount}</span>
            </button>
          </TooltipTrigger>
          {tooltipBody && (
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltipBody}
            </TooltipContent>
          )}
        </Tooltip>

        <button
          type="button"
          className={cn(
            buttonClass,
            voteStatus === 'disliked'
              ? 'bg-rose-100 text-rose-700'
              : 'text-slate-600 hover:bg-white hover:text-rose-700',
          )}
          onClick={() => handleVoteClick('dislike')}
          onMouseDown={(eventClick) => eventClick.preventDefault()}
          aria-pressed={voteStatus === 'disliked'}
        >
          <ThumbsDown className={iconClass} />
          <span>{dislikeCount}</span>
        </button>
      </div>
    </TooltipProvider>
  );
};

export default EventVoteControls;
