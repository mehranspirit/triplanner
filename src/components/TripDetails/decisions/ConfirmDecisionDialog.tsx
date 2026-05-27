import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/eventTypes';
import { DecisionLoserAction } from '@/types/decisionTypes';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import { Loader2 } from 'lucide-react';

interface ConfirmDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerEvent: Event | null;
  loserEvents: Event[];
  isTied?: boolean;
  isSubmitting?: boolean;
  onConfirm: (loserAction: DecisionLoserAction) => Promise<void>;
}

const loserActionOptions: Array<{ value: DecisionLoserAction; label: string; description: string }> = [
  {
    value: 'archive',
    label: 'Archive as alternatives',
    description: 'Keep other options on the trip but hide them from the main timeline.',
  },
  {
    value: 'delete',
    label: 'Delete other options',
    description: 'Remove the non-winning options from the trip entirely.',
  },
  {
    value: 'keep_exploring',
    label: 'Keep exploring',
    description: 'Confirm the winner but leave other options as exploring candidates.',
  },
];

const ConfirmDecisionDialog: React.FC<ConfirmDecisionDialogProps> = ({
  open,
  onOpenChange,
  winnerEvent,
  loserEvents,
  isTied = false,
  isSubmitting = false,
  onConfirm,
}) => {
  const [loserAction, setLoserAction] = useState<DecisionLoserAction>('archive');

  useEffect(() => {
    if (open) {
      setLoserAction('archive');
    }
  }, [open, winnerEvent?.id]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Confirm winner</DialogTitle>
          <DialogDescription>
            {winnerEvent
              ? `Choose what happens to the other ${loserEvents.length} option${loserEvents.length === 1 ? '' : 's'}.`
              : 'Select a winning option first.'}
          </DialogDescription>
        </DialogHeader>

        {winnerEvent && (
          <div className="space-y-4">
            {isTied && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                It&apos;s a tie on likes. You can still confirm a winner, or ask the group to revote.
              </div>
            )}

            <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
              Winner: <span className="font-semibold">{getEventDisplayName(winnerEvent)}</span>
            </div>

            {loserEvents.length > 0 && (
              <div className="text-xs text-slate-500">
                Others: {loserEvents.map(getEventDisplayName).join(', ')}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">What should happen to the other options?</p>
              {loserActionOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                    loserAction === option.value
                      ? 'border-violet-300 bg-violet-50/60'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="loserAction"
                    value={option.value}
                    checked={loserAction === option.value}
                    onChange={() => setLoserAction(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(loserAction)}
            disabled={!winnerEvent || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              'Confirm winner'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDecisionDialog;
