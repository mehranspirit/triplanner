import React from 'react';
import ProactiveContextCard from './ProactiveContextCard';
import InTripAssistant from './InTripAssistant';
import { ProactiveContextCard as ProactiveContextCardData, TripContextSignals } from './context/tripContextTypes';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { cn } from '@/lib/utils';

const EMBEDDED_SUMMARY_CARD_TYPES = new Set<ProactiveContextCardData['type']>([
  'next_up',
  'trip_health',
]);

interface ProactiveTripContextProps {
  signals: TripContextSignals;
  onCardAction: (card: ProactiveContextCardData) => void;
  onDismissCard?: (card: ProactiveContextCardData) => void;
  todayAssistant?: React.ComponentProps<typeof InTripAssistant> | null;
}

const getPhaseLabel = (phase: TripContextSignals['phase']) => {
  if (phase === 'before') return 'Planning ahead';
  if (phase === 'during') return 'Travel day';
  if (phase === 'after') return 'Trip wrap-up';
  return 'Trip workspace';
};

const ProactiveTripContext: React.FC<ProactiveTripContextProps> = ({
  signals,
  onCardAction,
  onDismissCard,
  todayAssistant,
}) => {
  const phaseLabel = getPhaseLabel(signals.phase);
  const summaryCards = signals.cards.filter((card) => EMBEDDED_SUMMARY_CARD_TYPES.has(card.type));
  const listCards = signals.showEmbeddedToday
    ? signals.cards.filter((card) => (
        !EMBEDDED_SUMMARY_CARD_TYPES.has(card.type) && card.type !== 'travel_day'
      ))
    : signals.cards;

  if (signals.showEmbeddedToday && todayAssistant) {
    return (
      <aside>
        <section
          className={cn(
            tripSurfaces.floatStrong,
            'flex max-h-[calc(100vh-var(--trip-details-toolbar-height,7rem)-1.5rem)] flex-col overflow-hidden p-4',
          )}
        >
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {phaseLabel}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Today</h2>
          </div>

          {summaryCards.length > 0 && (
            <div className="mt-3 flex shrink-0 gap-2">
              {summaryCards.map((card) => (
                <ProactiveContextCard
                  key={`${card.type}-${card.event?.id || card.value || card.title}`}
                  card={card}
                  variant="compact"
                  onAction={onCardAction}
                  onDismiss={onDismissCard}
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <InTripAssistant
              {...todayAssistant}
              variant="embedded"
              showCloseButton={false}
              onClose={() => undefined}
            />
          </div>
        </section>
      </aside>
    );
  }

  if (listCards.length === 0) {
    return (
      <aside>
        <section className={cn(tripSurfaces.content, 'rounded-[2rem] bg-white/80 p-4')}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {phaseLabel}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Nothing needs attention right now. The itinerary stays front and center.
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Use Trip Menu above for notes, checklist, map, expenses, and assistant tools.
          </p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <section className={cn(tripSurfaces.floatStrong, 'p-4')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {phaseLabel}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Relevant now</h2>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {listCards.slice(0, 5).map((card) => (
            <ProactiveContextCard
              key={`${card.type}-${card.event?.id || card.value || card.title}`}
              card={card}
              onAction={onCardAction}
              onDismiss={onDismissCard}
            />
          ))}
        </div>
      </section>
    </aside>
  );
};

export default ProactiveTripContext;
