import React from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImproveLocationsProgressDialogProps {
  open: boolean;
  current: number;
  total: number;
  eventLabel?: string;
}

const ImproveLocationsProgressDialog: React.FC<ImproveLocationsProgressDialogProps> = ({
  open,
  current,
  total,
  eventLabel,
}) => (
  <Dialog open={open}>
    <DialogContent
      className="sm:max-w-md [&>button]:hidden"
      onInteractOutside={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <div className="flex items-center gap-2 text-teal-700">
          <MapPin className="h-5 w-5" />
          <DialogTitle>Improving locations</DialogTitle>
        </div>
        <DialogDescription className="text-left">
          Geocoding {current} of {total} event{total === 1 ? '' : 's'}…
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-teal-600" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {eventLabel || 'Working…'}
            </p>
            <p className="text-xs text-slate-500">Trying location fallbacks when needed</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300"
            style={{ width: `${total > 0 ? Math.round((current / total) * 100) : 0}%` }}
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default ImproveLocationsProgressDialog;
