import React from 'react';
import { FaCar, FaHotel } from 'react-icons/fa';
import { ChevronRight } from 'lucide-react';
import { Event } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';
import {
  getMultidayDayPosition,
  getMultidayEndpointDetails,
  getMultidaySpanLabel,
  MultidayEventDayRole,
} from '@/utils/timelineDates';
import { getEventDisplayName } from '@/utils/eventTime';

const ENDPOINT_ACCENT: Record<MultidayEventDayRole, string> = {
  start: 'border-emerald-200 bg-emerald-50/80',
  end: 'border-orange-200 bg-orange-50/80',
  single: 'border-slate-200 bg-white',
  middle: '',
};

const ENDPOINT_BADGE: Record<'start' | 'end' | 'single', string> = {
  start: 'bg-emerald-100 text-emerald-800',
  end: 'bg-orange-100 text-orange-800',
  single: 'bg-slate-100 text-slate-700',
};

interface MultidaySpanChipProps {
  event: Event;
  viewDateKey: string;
  onOpen?: () => void;
}

export const MultidaySpanChip: React.FC<MultidaySpanChipProps> = ({
  event,
  viewDateKey,
  onOpen,
}) => {
  const labels = getMultidaySpanLabel(event, viewDateKey);
  const Icon = event.type === 'stay' ? FaHotel : FaCar;

  return (
    <button
      type="button"
      className={cn(
        tripSurfaces.content,
        'flex w-full items-center gap-3 border-dashed px-3 py-2.5 text-left transition-colors',
        'bg-slate-50/90 hover:border-slate-300 hover:bg-slate-100/90',
      )}
      onClick={onOpen}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        <Icon className={cn('h-4 w-4', event.type === 'stay' ? 'text-yellow-600' : 'text-red-500')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-800">{labels.name}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm">
            {labels.progress}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{labels.hint}</span>
      </span>
      {onOpen && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
    </button>
  );
};

interface MultidayEndpointCardProps {
  event: Event;
  role: MultidayEventDayRole;
  viewDateKey: string;
  thumbnail: string;
  onOpen?: () => void;
}

export const MultidayEndpointCard: React.FC<MultidayEndpointCardProps> = ({
  event,
  role,
  viewDateKey,
  thumbnail,
  onOpen,
}) => {
  const details = getMultidayEndpointDetails(event, role);
  const total = getMultidayDayPosition(event, viewDateKey).total;
  const badgeRole = role === 'middle' ? 'single' : role;
  const Icon = event.type === 'stay' ? FaHotel : FaCar;

  if (!details) return null;

  const cardClassName = cn(
    tripSurfaces.content,
    tripSurfaces.contentHover,
    'w-full overflow-hidden text-left',
    ENDPOINT_ACCENT[badgeRole],
  );

  const cardContent = (
    <>
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <span className={cn(
          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
          ENDPOINT_BADGE[badgeRole],
        )}>
          {details.heading}
        </span>
        {details.time && (
          <span className="text-sm font-semibold text-slate-900">{details.time}</span>
        )}
        {role !== 'single' && total > 1 && (
          <span className="ml-auto text-xs text-slate-500">
            {event.type === 'stay' ? `${total} nights` : `${total} days`}
          </span>
        )}
      </div>

      <div className="flex items-start gap-3 p-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-950/30" />
          <div className="absolute bottom-1 right-1 rounded-full bg-white p-1 shadow">
            <Icon className={cn('h-3.5 w-3.5', event.type === 'stay' ? 'text-yellow-600' : 'text-red-500')} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {getEventDisplayName(event)}
            </h3>
            <EventStatusChip event={event} />
          </div>

          {details.location && (
            <p className="mt-1 truncate text-xs text-slate-600">{details.location}</p>
          )}

          {role === 'single' && details.secondaryHeading && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{details.secondaryHeading}</span>
              {details.secondaryTime ? ` · ${details.secondaryTime}` : ''}
            </p>
          )}
        </div>

        {onOpen && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" className={cardClassName} onClick={onOpen}>
        {cardContent}
      </button>
    );
  }

  return <div className={cardClassName}>{cardContent}</div>;
};
