import React from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock3, MapPin, Navigation, X } from 'lucide-react';
import { Event } from '@/types/eventTypes';
import { Button } from '@/components/ui/button';
import {
  getEventDisplayName,
  getEventLocationLabel,
  getEventStart,
} from '@/utils/eventTime';
import { getGoogleMapsSearchUrl } from '@/utils/eventLocation';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';

interface EventMapPreviewProps {
  event: Event;
  stopIndex: number;
  stopCount: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenEvent?: (event: Event) => void;
}

const EventMapPreview: React.FC<EventMapPreviewProps> = ({
  event,
  stopIndex,
  stopCount,
  onPrevious,
  onNext,
  onClose,
  onOpenEvent,
}) => {
  const start = getEventStart(event);
  const mapsUrl = getGoogleMapsSearchUrl(event);
  const location = getEventLocationLabel(event);
  const countdown = start && start > new Date()
    ? `Starts ${formatDistanceToNowStrict(start)}`
    : start
      ? format(start, 'EEE, MMM d · h:mm a')
      : null;

  const hasPrevious = stopIndex > 0;
  const hasNext = stopIndex >= 0 && stopIndex < stopCount - 1;
  const showNavigation = stopCount > 1;

  return (
    <div className={cn('pointer-events-auto flex items-stretch gap-1', tripSurfaces.overlay)}>
      {showNavigation && (
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center rounded-l-2xl px-1.5 text-slate-600 transition-colors',
            hasPrevious ? 'hover:bg-slate-100' : 'cursor-not-allowed opacity-30',
          )}
          aria-label="Previous stop"
          disabled={!hasPrevious}
          onClick={onPrevious}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Selected stop
              {showNavigation && stopIndex >= 0 && (
                <span className="font-normal normal-case text-slate-400">
                  {' '}· {stopIndex + 1} of {stopCount}
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
              {getEventDisplayName(event)}
            </p>
            {countdown && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {countdown}
              </p>
            )}
            {location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close preview"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {onOpenEvent && (
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onOpenEvent(event)}>
              Open details
            </Button>
          )}
          {mapsUrl && (
            <Button type="button" size="sm" className="rounded-full" asChild>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-1.5 h-3.5 w-3.5" />
                Directions
              </a>
            </Button>
          )}
        </div>
      </div>

      {showNavigation && (
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center rounded-r-2xl px-1.5 text-slate-600 transition-colors',
            hasNext ? 'hover:bg-slate-100' : 'cursor-not-allowed opacity-30',
          )}
          aria-label="Next stop"
          disabled={!hasNext}
          onClick={onNext}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default EventMapPreview;
