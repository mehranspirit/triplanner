import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EventCardShellProps {
  isExploring: boolean;
  className?: string;
  children: React.ReactNode;
}

const EventCardShell: React.FC<EventCardShellProps> = ({
  isExploring,
  className,
  children,
}) => (
  <Card
    className={cn(
      'group relative h-full overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md',
      isExploring && 'border-amber-200 bg-amber-50/70',
      className
    )}
  >
    {children}
  </Card>
);

export default EventCardShell;
