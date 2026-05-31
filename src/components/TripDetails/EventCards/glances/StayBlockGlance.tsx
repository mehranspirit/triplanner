import React from 'react';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import { getMultidayEndpointDetails } from '@/utils/timelineDates';
import {
  formatStayGlanceMeta,
  formatStayGlanceSchedule,
  EXPLORING_TITLE_CLASS,
} from '@/utils/eventGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const StayBlockGlance: React.FC<EventGlanceContentProps> = ({
  event,
  isExploring,
  isActive,
  location,
  showTimeInBody = true,
  multidayRole,
}) => {
  const startDetails = multidayRole === 'start'
    ? getMultidayEndpointDetails(event, 'start')
    : null;
  const scheduleLine = showTimeInBody ? formatStayGlanceSchedule(event) : null;
  const metaLine = [
    startDetails?.heading,
    formatStayGlanceMeta(event),
    location,
  ].filter(Boolean).join(' · ');

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

      {scheduleLine && (
        <p className="mt-0.5 truncate text-xs font-medium text-amber-800/80">
          {scheduleLine}
        </p>
      )}
    </>
  );
};

export default StayBlockGlance;
