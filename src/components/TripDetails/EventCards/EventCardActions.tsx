import React from 'react';
import { Calendar, CheckCircle2, Edit, MoreVertical, Search, Share, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EventCardActionsProps {
  isExploring: boolean;
  className?: string;
  onAddToCalendar: (event: React.MouseEvent) => void;
  onShare: (event: React.MouseEvent) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
  children?: React.ReactNode;
}

const actionButtonClass = 'h-8 w-8 rounded-lg transition-colors duration-200 hover:bg-slate-50';

const EventCardActions: React.FC<EventCardActionsProps> = ({
  isExploring,
  className,
  onAddToCalendar,
  onShare,
  onEdit,
  onDelete,
  onStatusChange,
  children,
}) => (
  <div className={cn('absolute right-3 top-3 z-10 opacity-100 transition-all duration-200 md:opacity-0 md:group-hover:opacity-100', className)}>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full border border-slate-100/70 bg-white/85 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white data-[state=open]:bg-slate-100/80"
        >
          <MoreVertical className="h-4 w-4 text-slate-500 transition-transform duration-200 ease-in-out data-[state=open]:rotate-90" />
          <span className="sr-only">Open event actions</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-10 rounded-xl border border-slate-100/70 bg-white/95 p-1 shadow-lg backdrop-blur-sm"
        align="center"
        side="bottom"
        alignOffset={-28}
        sideOffset={5}
      >
        <div className="relative flex flex-col gap-1 before:absolute before:left-1/2 before:top-0 before:h-[6px] before:w-[2px] before:-translate-x-1/2 before:-translate-y-[6px] before:bg-slate-200">
          {children}
          <Button variant="ghost" size="icon" className={actionButtonClass} onClick={onAddToCalendar} title="Add to Calendar">
            <Calendar className="h-4 w-4 text-slate-500" />
          </Button>
          <Button variant="ghost" size="icon" className={actionButtonClass} onClick={onShare} title="Share">
            <Share className="h-4 w-4 text-slate-500" />
          </Button>
          {onStatusChange && (
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClass}
              onClick={() => onStatusChange(isExploring ? 'confirmed' : 'exploring')}
              title={isExploring ? 'Mark as Confirmed' : 'Change to Exploring'}
            >
              {isExploring ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Search className="h-4 w-4 text-slate-500" />
              )}
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className={actionButtonClass} onClick={onEdit} title="Edit">
              <Edit className="h-4 w-4 text-slate-500" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-red-500 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  </div>
);

export default EventCardActions;
