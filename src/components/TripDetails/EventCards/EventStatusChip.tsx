import React from 'react';
import { CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Event } from '@/types/eventTypes';
import { eventHasLocationAttention } from '@/utils/eventLocation';
import { EXPLORING_EVENT_UI_LABEL } from '@/utils/eventStatusLabels';

export type EventStatusChipVariant = 'confirmed' | 'exploring' | 'booked' | 'needs_location';

export interface EventStatusChipInfo {
  variant: EventStatusChipVariant;
  label: string;
}

const getBookingReference = (event: Event): string | undefined => {
  const reference = (event as { bookingReference?: unknown }).bookingReference;
  return typeof reference === 'string' && reference.trim() ? reference.trim() : undefined;
};

export const getEventStatusChipInfo = (event: Event): EventStatusChipInfo => {
  if (event.status === 'exploring') {
    return { variant: 'exploring', label: EXPLORING_EVENT_UI_LABEL };
  }

  if (eventHasLocationAttention(event)) {
    return { variant: 'needs_location', label: 'Needs location' };
  }

  if (getBookingReference(event)) {
    return { variant: 'booked', label: 'Booked' };
  }

  return { variant: 'confirmed', label: 'Confirmed' };
};

export const EVENT_STATUS_CHIP_STYLES: Record<EventStatusChipVariant, string> = {
  confirmed: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  exploring: 'border-stone-400 bg-[#F7F2E8] text-stone-800 ring-1 ring-inset ring-stone-300/50 font-semibold',
  booked: 'border-violet-100 bg-violet-50 text-violet-800',
  needs_location: 'border-teal-100 bg-teal-50 text-teal-800',
};

interface EventStatusChipProps {
  event: Event;
  className?: string;
  prominent?: boolean;
}

const EventStatusChip: React.FC<EventStatusChipProps> = ({ event, className, prominent = false }) => {
  const info = getEventStatusChipInfo(event);
  const isDraft = info.variant === 'exploring';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
        isDraft ? 'border-dashed' : '',
        prominent && isDraft ? 'text-xs uppercase tracking-wide' : 'text-[11px]',
        EVENT_STATUS_CHIP_STYLES[info.variant],
        className,
      )}
    >
      {isDraft && <CircleDashed className="h-3 w-3 shrink-0" aria-hidden />}
      {info.label}
    </span>
  );
};

export default EventStatusChip;
