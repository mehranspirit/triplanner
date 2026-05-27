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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Event, Trip } from '@/types/eventTypes';
import { DecisionSlot } from '@/types/decisionTypes';
import { Loader2 } from 'lucide-react';
import {
  buildDecisionSlotLabel,
  DECISION_COMPARISON_TYPES,
  eventsAreComparableTogether,
  getOrphanExploringEvents,
  getSharedDecisionComparisonType,
  groupOrphanEventsByType,
  hasComparableDecisionPair,
  inferDecisionSlotFromEvents,
  isStayDecisionComparison,
  normalizePreselectedDecisionIds,
  suggestDecisionTitle,
} from '@/utils/decisionHelpers';
import DecisionTypeOptionSection from './DecisionTypeOptionSection';

interface CreateDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  preselectedEventIds?: string[];
  onCreate: (payload: { title: string; optionEventIds: string[]; slot?: DecisionSlot }) => Promise<void>;
  onExploreAlternative?: (event: Event) => void;
}

const CreateDecisionDialog: React.FC<CreateDecisionDialogProps> = ({
  open,
  onOpenChange,
  trip,
  preselectedEventIds = [],
  onCreate,
  onExploreAlternative,
}) => {
  const orphanEvents = useMemo(() => getOrphanExploringEvents(trip), [trip]);
  const groupedEvents = useMemo(() => groupOrphanEventsByType(orphanEvents), [orphanEvents]);
  const canCompareAny = useMemo(() => hasComparableDecisionPair(orphanEvents), [orphanEvents]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [hasEditedTitle, setHasEditedTitle] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [slotEndDate, setSlotEndDate] = useState('');
  const [hasEditedSlot, setHasEditedSlot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEvents = useMemo(
    () => orphanEvents.filter((event) => selectedIds.includes(event.id)),
    [orphanEvents, selectedIds],
  );
  const activeSelectionType = useMemo(
    () => getSharedDecisionComparisonType(selectedEvents),
    [selectedEvents],
  );
  const isStayComparison = useMemo(
    () => isStayDecisionComparison(selectedEvents),
    [selectedEvents],
  );
  const hasEnoughSelected = selectedIds.length >= 2;

  useEffect(() => {
    if (!open) return;

    const initialSelection = normalizePreselectedDecisionIds(orphanEvents, preselectedEventIds);
    setSelectedIds(initialSelection);
    setTitle('');
    setHasEditedTitle(false);
    setSlotDate('');
    setSlotEndDate('');
    setHasEditedSlot(false);
    setError(null);
    setIsSubmitting(false);
  }, [open, orphanEvents, preselectedEventIds]);

  useEffect(() => {
    if (!open || hasEditedSlot || selectedEvents.length < 2) return;

    const inferred = inferDecisionSlotFromEvents(selectedEvents);
    setSlotDate(inferred?.date ?? '');
    setSlotEndDate(inferred?.endDate ?? '');
  }, [open, selectedEvents, hasEditedSlot]);

  useEffect(() => {
    if (!open || hasEditedTitle) return;

    if (selectedEvents.length >= 2) {
      setTitle(suggestDecisionTitle(selectedEvents));
      return;
    }

    setTitle('');
  }, [open, selectedEvents, hasEditedTitle]);

  const toggleEvent = (eventId: string, type: typeof DECISION_COMPARISON_TYPES[number]) => {
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(eventId)) {
        return current.filter((id) => id !== eventId);
      }

      if (current.length === 0) {
        return [eventId];
      }

      const currentType = getSharedDecisionComparisonType(
        orphanEvents.filter((event) => current.includes(event.id)),
      );

      if (currentType && currentType !== type) {
        return [eventId];
      }

      return [...current, eventId];
    });
  };

  const handleCreate = async () => {
    if (selectedIds.length < 2) {
      setError('Select at least two exploring options from the same category.');
      return;
    }
    if (!eventsAreComparableTogether(selectedEvents)) {
      setError('All selected options must be the same type.');
      return;
    }
    if (!title.trim()) {
      setError('Add a decision title.');
      return;
    }
    if (isStayComparison && slotDate && slotEndDate && slotEndDate < slotDate) {
      setError('Check-out must be on or after check-in.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedDate = slotDate.trim();
      const trimmedEndDate = isStayComparison ? slotEndDate.trim() : '';
      const slot = trimmedDate
        ? {
            date: trimmedDate,
            ...(trimmedEndDate && trimmedEndDate !== trimmedDate ? { endDate: trimmedEndDate } : {}),
            label: buildDecisionSlotLabel(trimmedDate, trimmedEndDate || undefined),
          }
        : undefined;

      await onCreate({
        title: title.trim(),
        optionEventIds: selectedIds,
        slot,
      });
      onOpenChange(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Compare as alternatives</DialogTitle>
          <DialogDescription>
            Pick two or more exploring options from the same category so collaborators can vote and you can confirm a winner.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
          {orphanEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No exploring activities, destinations, or stays are available outside an existing decision.
            </div>
          ) : !canCompareAny ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                You need at least two exploring options in the same category before you can start a comparison.
              </div>
              {DECISION_COMPARISON_TYPES.map((type) => (
                <DecisionTypeOptionSection
                  key={type}
                  type={type}
                  events={groupedEvents[type]}
                  selectedIds={selectedIds}
                  activeSelectionType={activeSelectionType}
                  onToggle={toggleEvent}
                  onExploreAlternative={onExploreAlternative}
                />
              ))}
            </div>
          ) : (
            <>
              {hasEnoughSelected && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="decision-title">Decision title</Label>
                    <Input
                      id="decision-title"
                      value={title}
                      onChange={(event) => {
                        setHasEditedTitle(true);
                        setTitle(event.target.value);
                      }}
                      placeholder={isStayComparison ? 'Monteverde lodging options' : 'Saturday dinner options'}
                    />
                  </div>

                  {isStayComparison ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="decision-check-in">Check-in</Label>
                        <Input
                          id="decision-check-in"
                          type="date"
                          value={slotDate}
                          onChange={(event) => {
                            setHasEditedSlot(true);
                            setSlotDate(event.target.value);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="decision-check-out">Check-out</Label>
                        <Input
                          id="decision-check-out"
                          type="date"
                          value={slotEndDate}
                          min={slotDate || undefined}
                          onChange={(event) => {
                            setHasEditedSlot(true);
                            setSlotEndDate(event.target.value);
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 sm:col-span-2">
                        Optional. Defines the stay window for comparison context and trip health.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="decision-date">Decision date</Label>
                      <Input
                        id="decision-date"
                        type="date"
                        value={slotDate}
                        onChange={(event) => {
                          setHasEditedSlot(true);
                          setSlotDate(event.target.value);
                        }}
                      />
                      <p className="text-xs text-slate-500">
                        Optional. Used for weather and distance context in the comparison overview.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-5">
                {DECISION_COMPARISON_TYPES.map((type) => (
                  <DecisionTypeOptionSection
                    key={type}
                    type={type}
                    events={groupedEvents[type]}
                    selectedIds={selectedIds}
                    activeSelectionType={activeSelectionType}
                    onToggle={toggleEvent}
                    onExploreAlternative={onExploreAlternative}
                  />
                ))}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || !canCompareAny || !hasEnoughSelected}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building comparison...
              </>
            ) : (
              'Create comparison'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDecisionDialog;
