import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { DecisionSet } from '@/types/decisionTypes';

interface DeleteDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: DecisionSet | null;
  isSubmitting?: boolean;
  onConfirm: () => Promise<void>;
}

const DeleteDecisionDialog: React.FC<DeleteDecisionDialogProps> = ({
  open,
  onOpenChange,
  decision,
  isSubmitting = false,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
    <DialogContent className="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Delete decision?</DialogTitle>
        <DialogDescription>
          {decision
            ? `Remove "${decision.title}" and ungroup its ${decision.optionEventIds.length} options. Events stay on the trip as exploring — votes are kept.`
            : 'Remove this decision comparison.'}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting || !decision}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete decision'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default DeleteDecisionDialog;
