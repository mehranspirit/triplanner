import React from 'react';
import { FaCar, FaHotel } from 'react-icons/fa';
import { Event } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import {
  getMultidayEndpointDetails,
  getMultidayEventDayRole,
  getMultidaySpanLabel,
  MultidayEventDayRole,
} from '@/utils/timelineDates';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';

const ENDPOINT_ACCENT: Record<'start' | 'end' | 'single', string> = {
  start: 'border-emerald-300 bg-emerald-50/90 hover:border-emerald-400 hover:bg-emerald-50',
  end: 'border-orange-300 bg-orange-50/90 hover:border-orange-400 hover:bg-orange-50',
  single: 'border-slate-200 bg-slate-50/90 hover:border-blue-200 hover:bg-blue-50/80',
};

const ENDPOINT_BADGE: Record<'start' | 'end' | 'single', string> = {
  start: 'bg-emerald-100 text-emerald-800',
  end: 'bg-orange-100 text-orange-800',
  single: 'bg-slate-100 text-slate-700',
};

const multidayIcon = (event: Event, className?: string) => (
  event.type === 'stay'
    ? <FaHotel className={cn('h-3 w-3 text-yellow-600', className)} aria-hidden />
    : <FaCar className={cn('h-3 w-3 text-red-500', className)} aria-hidden />
);

const getMultidayMarkerLabel = (event: Event, dateKey: string, role: MultidayEventDayRole) => {
  if (role === 'middle') {
    const labels = getMultidaySpanLabel(event, dateKey);
    return `${labels.name} · ${labels.progress}`;
  }

  const details = getMultidayEndpointDetails(event, role);
  const name = getEventDisplayName(event);
  if (!details) return name;

  if (role === 'single') {
    const parts = [
      details.heading,
      details.time,
      details.secondaryHeading,
      details.secondaryTime,
      name,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  const parts = [details.heading, details.time, name].filter(Boolean);
  return parts.join(' · ');
};

const multidayRolePriority = (role: MultidayEventDayRole) => {
  if (role === 'start' || role === 'end') return 0;
  if (role === 'single') return 1;
  return 2;
};

export const isCalendarMultidayEvent = (event: Event, dateKey: string) => (
  getMultidayEventDayRole(event, dateKey) !== null
);

/** One multiday event carries the header icon per calendar day. */
export const pickCalendarHeaderMultidayEvent = (
  events: Event[],
  dateKey: string,
): Event | null => {
  if (events.length === 0) return null;

  return [...events].sort((left, right) => {
    const leftRole = getMultidayEventDayRole(left, dateKey);
    const rightRole = getMultidayEventDayRole(right, dateKey);
    if (!leftRole || !rightRole) return 0;

    const priorityDiff = multidayRolePriority(leftRole) - multidayRolePriority(rightRole);
    if (priorityDiff !== 0) return priorityDiff;

    if (left.type !== right.type) {
      if (left.type === 'stay') return -1;
      if (right.type === 'stay') return 1;
    }

    return left.id.localeCompare(right.id);
  })[0];
};

export const partitionCalendarDayEvents = (dayEvents: Event[], dateKey: string) => {
  const multidayEvents = dayEvents.filter((event) => isCalendarMultidayEvent(event, dateKey));
  const headerEvent = pickCalendarHeaderMultidayEvent(multidayEvents, dateKey);

  const listEvents = dayEvents.filter((event) => {
    const role = getMultidayEventDayRole(event, dateKey);
    if (!role) return true;
    if (role === 'start' || role === 'end') return true;
    return headerEvent?.id !== event.id;
  });

  return { headerEvent, headerMultidayEvents: multidayEvents, listEvents };
};

interface CalendarDayMultidayMarkersProps {
  headerEvent: Event;
  allMultidayEvents: Event[];
  dateKey: string;
  selectedEventId?: string | null;
  onSelect: (event: Event) => void;
}

/** Single stay/car icon beside the day number (at most one per day). */
export const CalendarDayMultidayMarkers: React.FC<CalendarDayMultidayMarkersProps> = ({
  headerEvent,
  allMultidayEvents,
  dateKey,
  selectedEventId,
  onSelect,
}) => {
  const headerRole = getMultidayEventDayRole(headerEvent, dateKey);
  if (!headerRole) return null;

  const label = allMultidayEvents.length === 1
    ? getMultidayMarkerLabel(headerEvent, dateKey, headerRole)
    : allMultidayEvents
      .map((event) => {
        const role = getMultidayEventDayRole(event, dateKey);
        return role ? getMultidayMarkerLabel(event, dateKey, role) : null;
      })
      .filter(Boolean)
      .join('\n');

  const isSelected = allMultidayEvents.some((event) => event.id === selectedEventId);

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'rounded p-0.5 transition-colors hover:bg-slate-100',
        isSelected && 'bg-blue-100 ring-1 ring-blue-200',
      )}
      onClick={() => onSelect(headerEvent)}
    >
      {multidayIcon(headerEvent)}
    </button>
  );
};

/** Multiday days that only show an icon beside the date (no body chip). */
export const isCalendarIconOnlyMultidayEvent = (event: Event, dateKey: string) => {
  const role = getMultidayEventDayRole(event, dateKey);
  return role === 'middle' || role === 'single';
};

interface CalendarEventCellProps {
  event: Event;
  dateKey: string;
  selected: boolean;
  onSelect: () => void;
}

interface CalendarMultidayEndpointChipProps {
  event: Event;
  role: MultidayEventDayRole;
  selected: boolean;
  onSelect: () => void;
}

const CalendarMultidayEndpointChip: React.FC<CalendarMultidayEndpointChipProps> = ({
  event,
  role,
  selected,
  onSelect,
}) => {
  const details = getMultidayEndpointDetails(event, role);
  const badgeRole = role === 'middle' ? 'single' : role;

  if (!details) return null;

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-xl border px-2 py-1.5 text-left transition-colors',
        ENDPOINT_ACCENT[badgeRole],
        selected && 'ring-1 ring-blue-200',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
          ENDPOINT_BADGE[badgeRole],
        )}>
          {details.heading}
        </span>
        {details.time && (
          <span className="truncate text-[10px] font-semibold text-slate-800">{details.time}</span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-slate-950">
        {getEventDisplayName(event)}
      </p>
      {role === 'single' && details.secondaryHeading && (
        <p className="mt-0.5 truncate text-[10px] text-slate-600">
          {details.secondaryHeading}
          {details.secondaryTime ? ` · ${details.secondaryTime}` : ''}
        </p>
      )}
    </button>
  );
};

const CalendarDefaultEventChip: React.FC<{
  event: Event;
  selected: boolean;
  onSelect: () => void;
}> = ({ event, selected, onSelect }) => (
  <button
    type="button"
    className={cn(
      'w-full rounded-xl border px-2 py-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/80',
      selected
        ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
        : 'border-slate-200 bg-slate-50/80',
    )}
    onClick={onSelect}
  >
    <p className="truncate text-xs font-semibold text-slate-950">
      {getEventDisplayName(event)}
    </p>
    <div className="mt-1">
      <EventStatusChip event={event} />
    </div>
  </button>
);

export const CalendarEventCell: React.FC<CalendarEventCellProps> = ({
  event,
  dateKey,
  selected,
  onSelect,
}) => {
  const role = getMultidayEventDayRole(event, dateKey);

  if (role === 'start' || role === 'end' || role === 'single') {
    return (
      <CalendarMultidayEndpointChip
        event={event}
        role={role}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }

  return (
    <CalendarDefaultEventChip
      event={event}
      selected={selected}
      onSelect={onSelect}
    />
  );
};
