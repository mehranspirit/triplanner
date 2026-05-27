import React from 'react';
import { format } from 'date-fns';
import { Event } from '@/types/eventTypes';
import { getEventDisplayName, getEventStart } from '@/utils/eventTime';
import { cn } from '@/lib/utils';

interface ExploringEventPickerListProps {
  events: Event[];
  selectedIds: string[];
  onToggle: (eventId: string) => void;
  selectionMode?: 'multi' | 'single';
  emptyMessage?: string;
  disabled?: boolean;
}

const ExploringEventPickerList: React.FC<ExploringEventPickerListProps> = ({
  events,
  selectedIds,
  onToggle,
  selectionMode = 'multi',
  emptyMessage = 'No exploring options are available to add.',
  disabled = false,
}) => {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const start = getEventStart(event);
        const checked = selectedIds.includes(event.id);
        const inputType = selectionMode === 'single' ? 'radio' : 'checkbox';

        return (
          <label
            key={event.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 transition-colors',
              disabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50/80 opacity-60'
                : 'cursor-pointer',
              !disabled && checked ? 'border-violet-300 bg-violet-50/60' : '',
              !disabled && !checked ? 'border-slate-200 hover:border-violet-200' : '',
              disabled ? 'border-slate-100' : '',
            )}
          >
            <input
              type={inputType}
              name={selectionMode === 'single' ? 'exploring-event-picker' : undefined}
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onToggle(event.id)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {getEventDisplayName(event)}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {event.type}
                {start ? ` · ${format(start, 'EEE, MMM d')}` : ''}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
};

export default ExploringEventPickerList;
