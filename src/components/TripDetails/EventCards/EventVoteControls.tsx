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
}

const EventVoteControls: React.FC<EventVoteControlsProps> = ({
  event,
  trip,
  currentUserId,
  onVote,
  readOnly = false,
  className,
}) => {
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

  if (readOnly) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600',
          className,
        )}
        title={tooltipBody || undefined}
      >
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" />
          {likeCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <ThumbsDown className="h-3 w-3" />
          {dislikeCount}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/80 px-1 py-0.5',
          className,
        )}
        onClick={(eventClick) => eventClick.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
                voteStatus === 'liked'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-white hover:text-emerald-700',
              )}
              onClick={() => handleVoteClick('like')}
              aria-pressed={voteStatus === 'liked'}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
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
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
            voteStatus === 'disliked'
              ? 'bg-rose-100 text-rose-700'
              : 'text-slate-600 hover:bg-white hover:text-rose-700',
          )}
          onClick={() => handleVoteClick('dislike')}
          aria-pressed={voteStatus === 'disliked'}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span>{dislikeCount}</span>
        </button>
      </div>
    </TooltipProvider>
  );
};

export default EventVoteControls;
