import React, { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import {
  ALL_DAYS_STRIP_ITEM,
  TripDayStripItem,
} from '@/utils/timelineDates';

interface TripDayStripProps {
  days: TripDayStripItem[];
  activeDayKey: string;
  onDaySelect: (dateKey: string) => void;
  variant?: 'default' | 'map';
}

const TripDayStrip = forwardRef<HTMLElement, TripDayStripProps>(function TripDayStrip({
  days,
  activeDayKey,
  onDaySelect,
  variant = 'default',
}, ref) {
  const stripRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const stripDays = [ALL_DAYS_STRIP_ITEM, ...days.filter((day) => !day.isAllDays)];

  useEffect(() => {
    const pill = pillRefs.current.get(activeDayKey);
    if (!pill || !stripRef.current) return;

    pill.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeDayKey]);

  if (stripDays.length <= 1) return null;

  const isMapVariant = variant === 'map';

  return (
    <nav
      ref={ref}
      aria-label="Trip days"
      className={cn(
        isMapVariant
          ? 'px-0 py-0'
          : cn(
            tripSurfaces.float,
            'sticky z-30 top-[var(--trip-details-toolbar-height,0px)] rounded-none border-x-0 bg-white px-3 py-2 shadow-sm lg:static lg:top-auto lg:z-auto lg:rounded-3xl lg:border-x lg:px-2 lg:shadow-none',
          ),
      )}
    >
      <div
        ref={stripRef}
        className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stripDays.map((day) => {
          const isActive = activeDayKey === day.dateKey;

          return (
            <button
              key={day.dateKey}
              ref={(element) => {
                if (element) {
                  pillRefs.current.set(day.dateKey, element);
                } else {
                  pillRefs.current.delete(day.dateKey);
                }
              }}
              type="button"
              aria-current={isActive ? 'date' : undefined}
              className={cn(
                'inline-flex shrink-0 flex-col items-start rounded-2xl border px-3 py-2 text-left transition-all',
                isActive
                  ? isMapVariant
                    ? cn(tripSurfaces.mapSegmentActive, 'border-white/20 shadow-md shadow-black/20')
                    : 'border-blue-200 bg-blue-50 text-blue-950 shadow-md shadow-blue-900/10 ring-1 ring-blue-100'
                  : isMapVariant
                    ? day.isAllDays || day.hasEvents
                      ? 'border-white/15 bg-white/10 text-white hover:border-white/25 hover:bg-white/15'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10 hover:text-white/70'
                    : day.isAllDays || day.hasEvents
                      ? 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      : 'border-slate-200/70 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700',
              )}
              onClick={() => onDaySelect(day.dateKey)}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {day.weekdayLabel}
                </span>
                {day.isToday && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    isMapVariant
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-800',
                  )}
                  >
                    Today
                  </span>
                )}
              </span>
              <span className="mt-0.5 text-sm font-bold">{day.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default TripDayStrip;
