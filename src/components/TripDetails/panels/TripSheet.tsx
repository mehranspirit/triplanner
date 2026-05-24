import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TripSheetProps {
  open: boolean;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
}

const TripSheet: React.FC<TripSheetProps> = ({
  open,
  title,
  description,
  className,
  children,
  onOpenChange,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={cn(
        'bottom-0 left-0 top-auto h-[88vh] max-h-[88vh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-3xl border-slate-200 bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:rounded-t-3xl',
        'md:bottom-6 md:left-auto md:right-6 md:top-auto md:h-[min(720px,calc(100vh-3rem))] md:w-[460px] md:translate-x-0 md:translate-y-0 md:rounded-3xl',
        className
      )}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="h-full overflow-hidden">{children}</div>
    </DialogContent>
  </Dialog>
);

export default TripSheet;
