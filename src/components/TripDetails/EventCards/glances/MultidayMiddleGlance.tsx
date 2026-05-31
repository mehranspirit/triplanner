import React from 'react';
import { cn } from '@/lib/utils';
import { getMultidaySpanLabel } from '@/utils/timelineDates';
import { EXPLORING_TITLE_CLASS } from '@/utils/eventGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const MultidayMiddleGlance: React.FC<EventGlanceContentProps> = ({
  event,
  isExploring,
  isActive,
  viewDateKey,
}) => {
  if (!viewDateKey) return null;

  const labels = getMultidaySpanLabel(event, viewDateKey);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className={cn(
            'truncate text-sm font-semibold',
            isExploring ? EXPLORING_TITLE_CLASS : 'text-slate-950',
          )}
        >
          {labels.name}
        </h3>
        <span className="shrink-0 rounded-full border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {labels.progress}
        </span>
        {isActive && !isExploring && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
            Now
          </span>
        )}
      </div>

      <p className="mt-0.5 truncate text-xs text-slate-500">{labels.hint}</p>
    </>
  );
};

export default MultidayMiddleGlance;
