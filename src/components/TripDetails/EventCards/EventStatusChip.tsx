import React from 'react';
import { cn } from '@/lib/utils';
import { Event } from '@/types/eventTypes';
import { eventHasLocationAttention } from '@/utils/eventLocation';

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
    return { variant: 'exploring', label: 'Exploring' };
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
  exploring: 'border-amber-100 bg-amber-50 text-amber-800',
  booked: 'border-violet-100 bg-violet-50 text-violet-800',
  needs_location: 'border-teal-100 bg-teal-50 text-teal-800',
};

interface EventStatusChipProps {
  event: Event;
  className?: string;
}

const EventStatusChip: React.FC<EventStatusChipProps> = ({ event, className }) => {
  const info = getEventStatusChipInfo(event);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        EVENT_STATUS_CHIP_STYLES[info.variant],
        className,
      )}
    >
      {info.label}
    </span>
  );
};

export default EventStatusChip;
