import React from 'react';
import { CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EXPLORING_EVENT_UI_DESCRIPTION,
  EXPLORING_EVENT_UI_LABEL,
} from '@/utils/eventStatusLabels';

interface EventDraftBannerProps {
  className?: string;
}

const EventDraftBanner: React.FC<EventDraftBannerProps> = ({ className }) => (
  <div
    className={cn(
      'flex shrink-0 items-center gap-1.5 border-b border-dashed border-stone-300/90',
      'bg-[#EDE4D3] px-3 py-1.5',
      className,
    )}
  >
    <CircleDashed className="h-3.5 w-3.5 shrink-0 text-stone-600" aria-hidden />
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-800">
      {EXPLORING_EVENT_UI_LABEL}
    </span>
    <span className="text-[10px] font-medium text-stone-600">
      · {EXPLORING_EVENT_UI_DESCRIPTION}
    </span>
  </div>
);

export default EventDraftBanner;
