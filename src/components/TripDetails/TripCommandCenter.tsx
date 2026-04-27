import React from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Lightbulb, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trip, Event, EventType } from '@/types/eventTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  formatEventDateTime,
  getCurrentEvent,
  getEventDisplayName,
  getEventLocationLabel,
  getEventStart,
  getNextEvent,
} from '@/utils/eventTime';
import { cn } from '@/lib/utils';

interface TripCommandCenterProps {
  trip: Trip;
  insights: TripInsight[];
  canEdit: boolean;
  onOpenAIImport: () => void;
  onOpenChecklist: () => void;
  onOpenExpenses: () => void;
  onAddEvent: (eventType?: EventType) => void;
  onEditEvent: (eventId: string) => void;
  onDismissInsight: (insightId: string) => void;
  dismissedInsightCount: number;
  onRestoreDismissedInsights: () => void;
}

const severityStyles: Record<TripInsight['severity'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const severityIconStyles: Record<TripInsight['severity'], string> = {
  critical: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

const getActionHandler = (
  insight: TripInsight,
  handlers: Pick<TripCommandCenterProps, 'onOpenAIImport' | 'onOpenChecklist' | 'onOpenExpenses' | 'onAddEvent' | 'onEditEvent'>
) => {
  switch (insight.actionTarget) {
    case 'ai_import':
      return handlers.onOpenAIImport;
    case 'checklist':
      return handlers.onOpenChecklist;
    case 'expenses':
      return handlers.onOpenExpenses;
    case 'add_event':
      return () => handlers.onAddEvent(insight.actionEventType);
    case 'event':
      return insight.source.id ? () => handlers.onEditEvent(insight.source.id!) : undefined;
    default:
      return undefined;
  }
};

const EventSummary: React.FC<{ label: string; event: Event | null }> = ({ label, event }) => {
  if (!event) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <CalendarClock className="h-4 w-4" />
          {label}
        </div>
        <p className="mt-2 text-sm text-gray-500">Nothing scheduled.</p>
      </div>
    );
  }

  const start = getEventStart(event);
  const location = getEventLocationLabel(event);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <CalendarClock className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 font-semibold text-gray-900">{getEventDisplayName(event)}</p>
      <div className="mt-2 space-y-1 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{formatEventDateTime(start)}</span>
        </div>
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{location}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const InsightRow: React.FC<{
  insight: TripInsight;
  canEdit: boolean;
  onAction?: () => void;
  onDismiss: () => void;
}> = ({ insight, canEdit, onAction, onDismiss }) => {
  return (
    <div className={cn('rounded-lg border p-3', severityStyles[insight.severity])}>
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('mt-0.5 h-4 w-4 flex-shrink-0', severityIconStyles[insight.severity])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{insight.title}</p>
          <p className="mt-1 text-sm opacity-90">{insight.message}</p>
        </div>
        {canEdit && insight.actionLabel && onAction && (
          <Button variant="outline" size="sm" onClick={onAction}>
            {insight.actionLabel}
          </Button>
        )}
        {insight.dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={onDismiss}
            aria-label={`Dismiss ${insight.title}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const TripCommandCenter: React.FC<TripCommandCenterProps> = ({
  trip,
  insights,
  canEdit,
  onOpenAIImport,
  onOpenChecklist,
  onOpenExpenses,
  onAddEvent,
  onEditEvent,
  onDismissInsight,
  dismissedInsightCount,
  onRestoreDismissedInsights,
}) => {
  const now = new Date();
  const currentEvent = getCurrentEvent(trip.events, now);
  const nextEvent = getNextEvent(trip.events, now);
  const priorityInsights = [...insights]
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 4);

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
            <Lightbulb className="h-4 w-4" />
            Trip Command Center
          </div>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">What needs attention next</h2>
          <p className="mt-1 text-sm text-gray-600">
            A first pass at proactive trip guidance from your itinerary data.
            {trip.timezone && <span> Trip timezone: {trip.timezone.replace(/_/g, ' ')}.</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onOpenAIImport}>Import booking</Button>
            <Button variant="outline" size="sm" onClick={onOpenChecklist}>Checklist</Button>
            <Button variant="outline" size="sm" onClick={onOpenExpenses}>Expenses</Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <EventSummary label="Now" event={currentEvent} />
        <EventSummary label="Next" event={nextEvent} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Needs attention</h3>
          <div className="flex items-center gap-2">
            {dismissedInsightCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onRestoreDismissedInsights}>
                Show dismissed ({dismissedInsightCount})
              </Button>
            )}
            <span className="text-xs text-gray-500">{insights.length} insight{insights.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        {priorityInsights.length > 0 ? (
          <div className="space-y-2">
            {priorityInsights.map((insight) => (
              <InsightRow
                key={insight.id}
                insight={insight}
                canEdit={canEdit}
                onAction={getActionHandler(insight, { onOpenAIImport, onOpenChecklist, onOpenExpenses, onAddEvent, onEditEvent })}
                onDismiss={() => onDismissInsight(insight.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            No obvious issues found in the current itinerary.
          </div>
        )}
      </div>
    </section>
  );
};

export default TripCommandCenter;
