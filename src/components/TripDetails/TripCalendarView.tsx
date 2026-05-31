import React, { useMemo } from 'react';
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Event } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { getEventTimelineDateKeys, isTimelineDateToday } from '@/utils/timelineDates';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';

interface TripCalendarViewProps {
  events: Event[];
  tripStartDate?: string;
  tripEndDate?: string;
  selectedEventId?: string | null;
  onEventSelect: (event: Event) => void;
}

const parseBoundaryDate = (value?: string): Date | null => {
  if (!value?.trim()) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : null;
};

const buildCalendarWeeks = (rangeStart: Date, rangeEnd: Date) => {
  const weeks: Date[][] = [];
  let cursor = startOfWeek(rangeStart, { weekStartsOn: 0 });

  while (cursor <= rangeEnd) {
    weeks.push(
      eachDayOfInterval({
        start: cursor,
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      }),
    );
    cursor = addWeeks(cursor, 1);
  }

  return weeks;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TripCalendarView: React.FC<TripCalendarViewProps> = ({
  events,
  tripStartDate,
  tripEndDate,
  selectedEventId,
  onEventSelect,
}) => {
  const itineraryEvents = useMemo(
    () => sortEventsByStart(events.filter((event) => event.status !== 'alternative')),
    [events],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();

    itineraryEvents.forEach((event) => {
      getEventTimelineDateKeys(event).forEach((dateKey) => {
        const existing = grouped.get(dateKey) ?? [];
        if (!existing.some((candidate) => candidate.id === event.id)) {
          existing.push(event);
          grouped.set(dateKey, existing);
        }
      });
    });

    return grouped;
  }, [itineraryEvents]);

  const { rangeStart, rangeEnd, weeks } = useMemo(() => {
    const datedEvents = itineraryEvents
      .map(getEventStart)
      .filter((start): start is Date => start !== null);

    const tripStart = parseBoundaryDate(tripStartDate);
    const tripEnd = parseBoundaryDate(tripEndDate);

    const start = tripStart && tripEnd && tripStart <= tripEnd
      ? tripStart
      : datedEvents[0] ?? null;
    const end = tripStart && tripEnd && tripStart <= tripEnd
      ? tripEnd
      : datedEvents[datedEvents.length - 1] ?? null;

    if (!start || !end) {
      return { rangeStart: null, rangeEnd: null, weeks: [] as Date[][] };
    }

    return {
      rangeStart: start,
      rangeEnd: end,
      weeks: buildCalendarWeeks(start, end),
    };
  }, [itineraryEvents, tripEndDate, tripStartDate]);

  if (!rangeStart || !rangeEnd || weeks.length === 0) {
    return (
      <section className={cn(tripSurfaces.floatStrong, 'p-6 text-center')}>
        <h2 className="text-lg font-semibold text-slate-950">Calendar</h2>
        <p className="mt-2 text-sm text-slate-600">
          Add dated events to see them on the trip calendar.
        </p>
      </section>
    );
  }

  return (
    <section className={cn(tripSurfaces.floatStrong, 'overflow-hidden p-3 md:p-6')}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-blue-700 sm:block">
            Trip calendar
          </p>
          <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">
            {format(rangeStart, 'MMM d')} – {format(rangeEnd, 'MMM d, yyyy')}
          </h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {itineraryEvents.length} event{itineraryEvents.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-2 border-b border-slate-200 pb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            {weeks.map((week) => {
              const weekKey = format(week[0], 'yyyy-MM-dd');

              return (
                <div key={weekKey} className="grid grid-cols-7 gap-2">
                  {week.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const inRange = day >= rangeStart && day <= rangeEnd;
                    const dayEvents = eventsByDate.get(dateKey) ?? [];
                    const isToday = isTimelineDateToday(dateKey);

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          'min-h-[8.5rem] rounded-2xl border p-2 transition-colors',
                          inRange
                            ? isToday
                              ? 'border-blue-200 bg-blue-50/70'
                              : 'border-slate-200 bg-white'
                            : 'border-transparent bg-slate-50/60 text-slate-400',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <span className={cn(
                            'text-sm font-semibold',
                            inRange ? 'text-slate-950' : 'text-slate-400',
                          )}>
                            {format(day, 'd')}
                          </span>
                          {isToday && inRange && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                              Today
                            </span>
                          )}
                        </div>

                        {inRange && (
                          <div className="space-y-1.5">
                            {dayEvents.slice(0, 3).map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className={cn(
                                  'w-full rounded-xl border px-2 py-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/80',
                                  selectedEventId === event.id
                                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                                    : 'border-slate-200 bg-slate-50/80',
                                )}
                                onClick={() => onEventSelect(event)}
                              >
                                <p className="truncate text-xs font-semibold text-slate-950">
                                  {getEventDisplayName(event)}
                                </p>
                                <div className="mt-1">
                                  <EventStatusChip event={event} />
                                </div>
                              </button>
                            ))}
                            {dayEvents.length > 3 && (
                              <p className="px-1 text-[11px] font-medium text-slate-500">
                                +{dayEvents.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TripCalendarView;
