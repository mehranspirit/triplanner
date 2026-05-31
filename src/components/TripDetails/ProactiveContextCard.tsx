import React from 'react';
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ChevronRight, Clock3, CloudSun, HeartPulse, MapPin, Sparkles, X } from 'lucide-react';
import { ProactiveContextCard as ProactiveContextCardData } from './context/tripContextTypes';
import TripHealthScoreRing from './panels/TripHealthScoreRing';
import EventTypeSymbol from './EventCards/EventTypeSymbol';
import { cn } from '@/lib/utils';

const iconByType: Record<ProactiveContextCardData['type'], React.ReactNode> = {
  next_up: <Clock3 className="h-4 w-4" />,
  travel_day: <CalendarDays className="h-4 w-4" />,
  alerts: <Bell className="h-4 w-4" />,
  pending_imports: <Sparkles className="h-4 w-4" />,
  location_issues: <MapPin className="h-4 w-4" />,
  urgent_insights: <AlertTriangle className="h-4 w-4" />,
  trip_health: <HeartPulse className="h-4 w-4" />,
};

const toneByType: Record<ProactiveContextCardData['type'], string> = {
  next_up: 'border-blue-100 bg-blue-50/80 text-blue-900',
  travel_day: 'border-blue-100 bg-blue-50/80 text-blue-900',
  alerts: 'border-amber-100 bg-amber-50/90 text-amber-900',
  pending_imports: 'border-violet-100 bg-violet-50/90 text-violet-900',
  location_issues: 'border-teal-100 bg-teal-50/90 text-teal-900',
  urgent_insights: 'border-orange-100 bg-orange-50/90 text-orange-900',
  trip_health: 'border-rose-100 bg-rose-50/90 text-rose-900',
};

const DISMISSIBLE_CARD_TYPES = new Set<ProactiveContextCardData['type']>([
  'location_issues',
  'urgent_insights',
]);

interface ProactiveContextCardProps {
  card: ProactiveContextCardData;
  onAction: (card: ProactiveContextCardData) => void;
  onDismiss?: (card: ProactiveContextCardData) => void;
  variant?: 'default' | 'compact';
}

const ProactiveContextCard: React.FC<ProactiveContextCardProps> = ({
  card,
  onAction,
  onDismiss,
  variant = 'default',
}) => {
  const dismissible = DISMISSIBLE_CARD_TYPES.has(card.type) && !!onDismiss;
  const isLiveTodayCard = card.type === 'travel_day' && card.hasLiveUpdates;
  const cardIcon = isLiveTodayCard
    ? <CloudSun className="h-4 w-4" />
    : (iconByType[card.type] || <CheckCircle2 className="h-4 w-4" />);
  const cardTone = isLiveTodayCard
    ? 'border-sky-100 bg-sky-50/90 text-sky-900'
    : toneByType[card.type];

  const handleOpen = () => onAction(card);

  if (variant === 'compact') {
    if (card.type === 'trip_health' && typeof card.healthScore === 'number') {
      return (
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
            cardTone,
          )}
          onClick={handleOpen}
        >
          <span className="text-xs font-semibold leading-tight">{card.title}</span>
          <TripHealthScoreRing score={card.healthScore} size="sm" />
        </button>
      );
    }

    if (card.type === 'next_up' && card.event) {
      return (
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
            cardTone,
          )}
          onClick={handleOpen}
        >
          <span className="text-xs font-semibold leading-tight">{card.title}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
              <EventTypeSymbol event={card.event} />
            </span>
            <span className="truncate text-xs font-medium leading-tight">{card.description}</span>
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 items-center rounded-xl border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
          cardTone,
        )}
        onClick={handleOpen}
      >
        <span className="truncate text-xs font-semibold leading-tight">{card.title}</span>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer',
        cardTone,
      )}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
          {cardIcon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{card.title}</p>
            <div className="flex shrink-0 items-center gap-1">
              {card.value !== undefined && (
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {card.value}
                </span>
              )}
              {dismissible && (
                <button
                  type="button"
                  className="rounded-full p-1 opacity-70 transition hover:bg-white/80 hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDismiss?.(card);
                  }}
                  aria-label={`Dismiss ${card.title}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm opacity-80">{card.description}</p>
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-70">
            {card.actionLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProactiveContextCard;
