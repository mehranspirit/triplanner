import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Event } from '@/types/eventTypes';
import { tripSurfaces } from '@/styles/tripSurfaces';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';

interface EventCardShellProps {
  isExploring: boolean;
  event?: Event;
  className?: string;
  children: React.ReactNode;
}

const EventCardShell: React.FC<EventCardShellProps> = ({
  isExploring,
  event,
  className,
  children,
}) => (
  <Card
    className={cn(
      'group relative h-full overflow-hidden',
      tripSurfaces.content,
      tripSurfaces.contentHover,
      isExploring && 'border-amber-200 bg-amber-50/70',
      className
    )}
  >
    {event && (
      <div className="absolute right-3 top-3 z-10">
        <EventStatusChip event={event} />
      </div>
    )}
    {children}
  </Card>
);

export default EventCardShell;
