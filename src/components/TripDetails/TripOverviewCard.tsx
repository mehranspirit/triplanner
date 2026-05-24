import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarDays, CreditCard, Plus, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trip } from '@/types/eventTypes';
import { TripInsight } from '@/types/insightTypes';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { TripPanel } from './hooks/useTripPanelManager';

interface TripOverviewCardProps {
  trip: Trip;
  insights: TripInsight[];
  canEdit: boolean;
  unreadNotificationCount: number;
  pendingImportCount: number;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenAIImport: () => void;
  onAddEvent: () => void;
}

const TripOverviewCard: React.FC<TripOverviewCardProps> = ({
  trip,
  insights,
  canEdit,
  unreadNotificationCount,
  pendingImportCount,
  onOpenPanel,
  onOpenAIImport,
  onAddEvent,
}) => {
  const navigate = useNavigate();
  const now = new Date();
  const nextEvent = sortEventsByStart(trip.events).find((event) => {
    const start = getEventStart(event);
    return start && start >= now;
  });
  const needsAttentionCount = insights.filter(insight => insight.severity !== 'info').length;

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Trip overview</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">What needs attention</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => onOpenPanel('today')}
          >
            <Wand2 className="mr-2 h-4 w-4 text-blue-600" />
            Tools
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Next up
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {nextEvent ? getEventDisplayName(nextEvent) : 'No upcoming events yet.'}
          </p>
          {canEdit && !nextEvent && (
            <Button variant="ghost" size="sm" className="mt-2 h-8 px-2 text-blue-700" onClick={onAddEvent}>
              <Plus className="mr-1 h-4 w-4" />
              Add first event
            </Button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            onClick={() => onOpenPanel('notifications')}
          >
            <Bell className="h-4 w-4 text-amber-500" />
            <p className="mt-2 text-xl font-bold text-slate-950">{unreadNotificationCount}</p>
            <p className="text-xs text-slate-500">Unread alerts</p>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            onClick={onOpenAIImport}
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <p className="mt-2 text-xl font-bold text-slate-950">{pendingImportCount}</p>
            <p className="text-xs text-slate-500">Pending imports</p>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            onClick={() => needsAttentionCount > 0 ? onOpenPanel('today') : onOpenAIImport()}
          >
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <p className="mt-2 text-xl font-bold text-slate-950">{needsAttentionCount}</p>
            <p className="text-xs text-slate-500">Attention items</p>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            onClick={() => navigate(`/trips/${trip._id}/expenses`)}
          >
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-slate-950">Expenses</p>
            <p className="text-xs text-slate-500">Balances</p>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <Button className="w-full rounded-full" onClick={() => onOpenPanel('today')}>
            <Wand2 className="mr-2 h-4 w-4" />
            Open Trip Tools
          </Button>
          {canEdit && (
            <Button variant="outline" className="w-full rounded-full" onClick={onOpenAIImport}>
              <Sparkles className="mr-2 h-4 w-4 text-blue-600" />
              Import booking
            </Button>
          )}
        </div>
      </section>
    </aside>
  );
};

export default TripOverviewCard;
