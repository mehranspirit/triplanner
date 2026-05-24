import React from 'react';
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, Clock3, CloudSun, MapPin, Sparkles } from 'lucide-react';
import { ProactiveContextCard as ProactiveContextCardData } from './context/tripContextTypes';
import { cn } from '@/lib/utils';

const iconByType: Record<ProactiveContextCardData['type'], React.ReactNode> = {
  next_up: <Clock3 className="h-4 w-4" />,
  travel_day: <CalendarDays className="h-4 w-4" />,
  alerts: <Bell className="h-4 w-4" />,
  pending_imports: <Sparkles className="h-4 w-4" />,
  location_issues: <MapPin className="h-4 w-4" />,
  urgent_insights: <AlertTriangle className="h-4 w-4" />,
  travel_status: <CloudSun className="h-4 w-4" />,
};

const toneByType: Record<ProactiveContextCardData['type'], string> = {
  next_up: 'border-blue-100 bg-blue-50/80 text-blue-900',
  travel_day: 'border-blue-100 bg-blue-50/80 text-blue-900',
  alerts: 'border-amber-100 bg-amber-50/90 text-amber-900',
  pending_imports: 'border-violet-100 bg-violet-50/90 text-violet-900',
  location_issues: 'border-teal-100 bg-teal-50/90 text-teal-900',
  urgent_insights: 'border-orange-100 bg-orange-50/90 text-orange-900',
  travel_status: 'border-sky-100 bg-sky-50/90 text-sky-900',
};

interface ProactiveContextCardProps {
  card: ProactiveContextCardData;
  onAction: (card: ProactiveContextCardData) => void;
}

const ProactiveContextCard: React.FC<ProactiveContextCardProps> = ({ card, onAction }) => (
  <button
    type="button"
    className={cn(
      'w-full rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
      toneByType[card.type]
    )}
    onClick={() => onAction(card)}
  >
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
        {iconByType[card.type] || <CheckCircle2 className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{card.title}</span>
          {card.value !== undefined && (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
              {card.value}
            </span>
          )}
        </span>
        <span className="mt-1 block text-sm opacity-80">{card.description}</span>
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide opacity-70">
          {card.actionLabel}
        </span>
      </span>
    </div>
  </button>
);

export default ProactiveContextCard;
