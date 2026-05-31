import React, { useMemo } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { Trip } from '@/types/eventTypes';
import {
  getCurrentEvent,
  getEventDisplayName,
  getEventStart,
  getNextEvent,
  sortEventsByStart,
} from '@/utils/eventTime';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { useTripReferenceNow } from '@/components/TripDetails/TripReferenceNowContext';

interface TodayPeekProps {
  trip: Trip;
}

const TodayPeek: React.FC<TodayPeekProps> = ({ trip }) => {
  const { referenceNow } = useTripReferenceNow();
  const { current, next } = useMemo(() => {
    const sorted = sortEventsByStart(trip.events.filter(event => event.status !== 'alternative'));
    return {
      current: getCurrentEvent(sorted, referenceNow) ?? sorted.find(event => isEventCurrentlyActive(event, referenceNow)) ?? null,
      next: getNextEvent(sorted, referenceNow),
    };
  }, [trip.events, referenceNow]);

  const primary = current ?? next;
  const hasEvents = trip.events.filter((event) => event.status !== 'alternative').length > 0;

  if (!hasEvents) {
    return <p className="text-sm text-slate-600">No stops yet</p>;
  }

  if (!primary) {
    return <p className="text-sm text-slate-600">Nothing scheduled today</p>;
  }

  const start = getEventStart(primary);
  const timing = current
    ? 'Happening now'
    : start && start > referenceNow
      ? `Starts in ${formatDistanceStrict(referenceNow, start)}`
      : 'Up next';

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {current ? 'Now' : 'Next'}
      </p>
      <p className="truncate text-sm font-semibold text-slate-950">{getEventDisplayName(primary)}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
        <Clock3 className="h-3 w-3 shrink-0" />
        {timing}
      </p>
    </div>
  );
};

export default TodayPeek;
