import React from 'react';
import { cn } from '@/lib/utils';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';
import { Event } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import {
  getEventCostGlanceLabel,
  getEventVoteGlanceLabel,
  getWeatherGlanceLabelForEvent,
} from '@/utils/eventGlance';

interface MetaChipProps {
  children: React.ReactNode;
  className?: string;
}

const MetaChip: React.FC<MetaChipProps> = ({ children, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600',
      className,
    )}
  >
    {children}
  </span>
);

interface EventGlanceMetaChipsProps {
  event: Event;
  weatherSnapshots?: WeatherSnapshot[];
  className?: string;
  hideStatusChip?: boolean;
  hideVoteChip?: boolean;
}

const EventGlanceMetaChips: React.FC<EventGlanceMetaChipsProps> = ({
  event,
  weatherSnapshots = [],
  className,
  hideStatusChip = false,
  hideVoteChip = false,
}) => {
  const costLabel = getEventCostGlanceLabel(event);
  const weatherLabel = getWeatherGlanceLabelForEvent(event, weatherSnapshots);
  const voteLabel = hideVoteChip ? null : getEventVoteGlanceLabel(event);

  const hasExtraChips = Boolean(costLabel || weatherLabel || voteLabel);

  if (!hasExtraChips && hideStatusChip) {
    return null;
  }

  if (!hasExtraChips) {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {!hideStatusChip && <EventStatusChip event={event} />}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {!hideStatusChip && <EventStatusChip event={event} />}
      {costLabel && <MetaChip>{costLabel}</MetaChip>}
      {weatherLabel && <MetaChip>{weatherLabel}</MetaChip>}
      {voteLabel && (
        <MetaChip className="border-stone-300/80 bg-[#EDE4D3]/90 text-stone-800">
          {voteLabel}
        </MetaChip>
      )}
    </div>
  );
};

export default EventGlanceMetaChips;
