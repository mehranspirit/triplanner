import React from 'react';
import { Bell, MapPin, Scale } from 'lucide-react';
import { FaPlane } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { EventGlanceAttention } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

interface EventGlanceAttentionChipsProps {
  attention?: EventGlanceAttention;
  className?: string;
  onOpenDecision?: () => void;
  onReviewLocation?: () => void;
}

const AttentionChip: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ icon, children, className, onClick }) => {
  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        onClick && 'cursor-pointer hover:opacity-90',
        className,
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </Component>
  );
};

const EventGlanceAttentionChips: React.FC<EventGlanceAttentionChipsProps> = ({
  attention,
  className,
  onOpenDecision,
  onReviewLocation,
}) => {
  if (!attention) return null;

  const hasContent = Boolean(
    attention.decisionTitle
    || (attention.alertCount && attention.alertCount > 0)
    || attention.hasLocationIssue
    || attention.hasFlightStatus,
  );

  if (!hasContent) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {attention.decisionTitle && onOpenDecision && (
        <AttentionChip
          icon={<Scale className="h-3 w-3" />}
          className="border-violet-100 bg-violet-50 text-violet-800"
          onClick={onOpenDecision}
        >
          {attention.decisionTitle}
        </AttentionChip>
      )}
      {attention.alertCount && attention.alertCount > 0 && (
        <AttentionChip
          icon={<Bell className="h-3 w-3" />}
          className="border-amber-100 bg-amber-50 text-amber-800"
        >
          {attention.alertCount} alert{attention.alertCount === 1 ? '' : 's'}
        </AttentionChip>
      )}
      {attention.hasLocationIssue && (
        <AttentionChip
          icon={<MapPin className="h-3 w-3" />}
          className="border-teal-100 bg-teal-50 text-teal-800"
          onClick={onReviewLocation}
        >
          Location
        </AttentionChip>
      )}
      {attention.hasFlightStatus && (
        <AttentionChip
          icon={<FaPlane className="h-3 w-3" />}
          className="border-violet-100 bg-violet-50 text-violet-800"
        >
          Flight status
        </AttentionChip>
      )}
    </div>
  );
};

export default EventGlanceAttentionChips;
