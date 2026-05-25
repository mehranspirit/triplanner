import React from 'react';
import ProactiveContextCard from './ProactiveContextCard';
import { ProactiveContextCard as ProactiveContextCardData, TripContextSignals } from './context/tripContextTypes';

interface ProactiveTripContextProps {
  signals: TripContextSignals;
  onCardAction: (card: ProactiveContextCardData) => void;
  onDismissCard?: (card: ProactiveContextCardData) => void;
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
}) => {
  if (signals.cards.length === 0) {
    return (
      <aside className="hidden lg:block lg:sticky lg:top-24">
        <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {getPhaseLabel(signals.phase)}
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
    <aside className="space-y-3 lg:sticky lg:top-24">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {getPhaseLabel(signals.phase)}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Relevant now</h2>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {signals.cards.slice(0, 5).map(card => (
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
