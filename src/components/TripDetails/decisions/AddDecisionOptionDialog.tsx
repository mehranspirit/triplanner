import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trip } from '@/types/eventTypes';
import { Loader2 } from 'lucide-react';
import { getOrphanExploringEvents } from '@/utils/decisionHelpers';
import ExploringEventPickerList from './ExploringEventPickerList';

interface AddDecisionOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  decisionTitle?: string;
  excludeEventIds?: string[];
  onAdd: (eventId: string) => Promise<void>;
}

const AddDecisionOptionDialog: React.FC<AddDecisionOptionDialogProps> = ({
  open,
  onOpenChange,
  trip,
  decisionTitle,
  excludeEventIds = [],
  onAdd,
}) => {
  const excludeSet = useMemo(() => new Set(excludeEventIds), [excludeEventIds]);
  const availableEvents = useMemo(
    () => getOrphanExploringEvents(trip).filter((event) => !excludeSet.has(event.id)),
    [trip, excludeSet],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError(null);
    setIsSubmitting(false);
  }, [open, availableEvents]);

  const handleAdd = async () => {
    if (!selectedId) {
      setError('Select an exploring option to add.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd(selectedId);
      onOpenChange(false);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add option');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add existing option</DialogTitle>
          <DialogDescription>
            {decisionTitle
              ? `Add another exploring event to "${decisionTitle}".`
              : 'Add another exploring event to this decision.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <ExploringEventPickerList
            events={availableEvents}
            selectedIds={selectedId ? [selectedId] : []}
            selectionMode="single"
            onToggle={(eventId) => setSelectedId(eventId)}
            emptyMessage="No other exploring activities, destinations, or stays are available to add."
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isSubmitting || !selectedId}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to decision'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddDecisionOptionDialog;
