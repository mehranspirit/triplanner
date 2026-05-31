import React from 'react';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import { formatEventGlanceTimeRange, EXPLORING_TITLE_CLASS } from '@/utils/eventGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const ActivityDestinationGlance: React.FC<EventGlanceContentProps> = ({
  event,
  isExploring,
  isActive,
  location,
  showTimeInBody = true,
}) => {
  const timeRange = formatEventGlanceTimeRange(event);
  const metaLine = showTimeInBody
    ? [timeRange, location].filter(Boolean).join(' · ')
    : location;

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className={cn(
            'truncate text-sm font-semibold',
            isExploring ? EXPLORING_TITLE_CLASS : 'text-slate-950',
          )}
        >
          {getEventDisplayName(event)}
        </h3>
        {isActive && !isExploring && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
            Now
          </span>
        )}
      </div>

      {metaLine && (
        <p className="mt-0.5 truncate text-xs text-slate-500">{metaLine}</p>
      )}
    </>
  );
};

export default ActivityDestinationGlance;
