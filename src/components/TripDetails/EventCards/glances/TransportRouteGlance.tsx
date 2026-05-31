import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatTransportGlanceTime,
  getTransportGlanceTitle,
  getTransportRouteEndpoints,
  truncateGlanceLabel,
} from '@/utils/eventGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const TransportRouteGlance: React.FC<EventGlanceContentProps> = ({
  event,
  isExploring,
  isActive,
  showTimeInBody = true,
}) => {
  const endpoints = getTransportRouteEndpoints(event);
  const timeLabel = formatTransportGlanceTime(event);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className={cn(
            'truncate text-sm font-semibold',
            isExploring ? 'text-slate-700' : 'text-slate-950',
          )}
        >
          {getTransportGlanceTitle(event)}
        </h3>
        {isActive && !isExploring && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
            Now
          </span>
        )}
      </div>

      {endpoints && (
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-medium text-slate-700">
          <span className="truncate">{truncateGlanceLabel(endpoints.from)}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{truncateGlanceLabel(endpoints.to)}</span>
          {showTimeInBody && timeLabel && (
            <>
              <span className="shrink-0 text-slate-400">·</span>
              <span className="shrink-0 text-slate-500">{timeLabel}</span>
            </>
          )}
        </div>
      )}

      {!endpoints && showTimeInBody && timeLabel && (
        <p className="mt-0.5 truncate text-xs text-slate-500">{timeLabel}</p>
      )}
    </>
  );
};

export default TransportRouteGlance;
