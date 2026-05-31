import React from 'react';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import { getMultidayDayPosition, getMultidayEndpointDetails } from '@/utils/timelineDates';
import { EXPLORING_TITLE_CLASS } from '@/utils/eventGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const MultidayEndGlance: React.FC<EventGlanceContentProps> = ({
  event,
  isExploring,
  isActive,
  location,
  viewDateKey,
}) => {
  const details = getMultidayEndpointDetails(event, 'end');
  if (!details) return null;

  const total = viewDateKey
    ? getMultidayDayPosition(event, viewDateKey).total
    : null;
  const metaParts = [
    details.heading,
    details.time,
    location || details.location,
  ].filter(Boolean);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800">
          {details.heading}
        </span>
        {total && total > 1 && (
          <span className="shrink-0 text-[10px] font-medium text-slate-500">
            {event.type === 'stay' ? `${total} nights` : `${total} days`}
          </span>
        )}
        {isActive && !isExploring && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
            Now
          </span>
        )}
      </div>

      <h3
        className={cn(
          'mt-1 truncate text-sm font-semibold',
          isExploring ? EXPLORING_TITLE_CLASS : 'text-slate-950',
        )}
      >
        {getEventDisplayName(event)}
      </h3>

      {metaParts.length > 0 && (
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {metaParts.slice(1).join(' · ')}
        </p>
      )}
    </>
  );
};

export default MultidayEndGlance;
