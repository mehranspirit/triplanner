import React from 'react';
import { cn } from '@/lib/utils';
import { getEventGlanceRailTime } from '@/utils/eventGlance';
import { MultidayEventDayRole } from '@/utils/timelineDates';
import { Event } from '@/types/eventTypes';

interface EventTimelineRailTimeProps {
  event: Event;
  multidayRole?: MultidayEventDayRole | null;
  className?: string;
  variant?: 'rail' | 'inline';
}

const EventTimelineRailTime: React.FC<EventTimelineRailTimeProps> = ({
  event,
  multidayRole,
  className,
  variant = 'rail',
}) => {
  const railTime = getEventGlanceRailTime(event, multidayRole);

  return (
    <div className={cn(
      variant === 'rail'
        ? 'w-14 shrink-0 pt-3.5 text-right'
        : 'shrink-0 text-left',
      className,
    )}>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums',
          railTime === '—' ? 'text-slate-300' : 'text-slate-600',
        )}
      >
        {railTime ?? '—'}
      </span>
    </div>
  );
};

export default EventTimelineRailTime;
