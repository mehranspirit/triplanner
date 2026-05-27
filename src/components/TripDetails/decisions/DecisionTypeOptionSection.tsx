import React from 'react';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/eventTypes';
import {
  DECISION_TYPE_SECTION_LABELS,
  DECISION_TYPE_SINGULAR_LABELS,
  DecisionComparisonType,
} from '@/utils/decisionHelpers';
import { getEventDisplayName, getEventStart } from '@/utils/eventTime';
import ExploringEventPickerList from './ExploringEventPickerList';

interface DecisionTypeOptionSectionProps {
  type: DecisionComparisonType;
  events: Event[];
  selectedIds: string[];
  activeSelectionType: DecisionComparisonType | null;
  onToggle: (eventId: string, type: DecisionComparisonType) => void;
  onExploreAlternative?: (event: Event) => void;
}

const DecisionTypeOptionSection: React.FC<DecisionTypeOptionSectionProps> = ({
  type,
  events,
  selectedIds,
  activeSelectionType,
  onToggle,
  onExploreAlternative,
}) => {
  if (events.length === 0) return null;

  const isLockedOut = activeSelectionType !== null && activeSelectionType !== type;
  const singularLabel = DECISION_TYPE_SINGULAR_LABELS[type];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {DECISION_TYPE_SECTION_LABELS[type]}
        </p>
        <span className="text-xs text-slate-500">
          {events.length} exploring
        </span>
      </div>

      {events.length >= 2 ? (
        <>
          {isLockedOut && (
            <p className="text-xs text-slate-500">
              Select options from one category at a time.
            </p>
          )}
          <ExploringEventPickerList
            events={events}
            selectedIds={selectedIds}
            onToggle={(eventId) => onToggle(eventId, type)}
            disabled={isLockedOut}
          />
        </>
      ) : (
        events.map((event) => {
          const start = getEventStart(event);

          return (
            <div
              key={event.id}
              className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3"
            >
              <p className="text-sm font-medium text-slate-900">
                {getEventDisplayName(event)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {start ? format(start, 'EEE, MMM d') : 'No date set'}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Add another exploring {singularLabel} to compare.
              </p>
              {onExploreAlternative && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onExploreAlternative(event)}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Find alternatives
                </Button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default DecisionTypeOptionSection;
