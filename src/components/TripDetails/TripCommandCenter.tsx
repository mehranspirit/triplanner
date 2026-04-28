import React, { useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Lightbulb, MapPin, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trip, Event, EventType } from '@/types/eventTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  AssistantActionTarget,
  AssistantChecklistItem,
  TripAssistantBriefing,
  TripQuestionAnswerResponse
} from '@/types/assistantBriefingTypes';
import { Textarea } from '@/components/ui/textarea';
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
  assistantBriefing?: TripAssistantBriefing | null;
  assistantBriefingGeneratedAt?: string | null;
  isGeneratingAssistantBriefing?: boolean;
  assistantBriefingError?: string | null;
  onGenerateAssistantBriefing?: () => void;
  onAssistantAction?: (target: AssistantActionTarget, eventId?: string) => void;
  onAcceptAssistantChecklistItem?: (item: AssistantChecklistItem) => void;
  onDismissAssistantChecklistItem?: (item: AssistantChecklistItem) => void;
  getAssistantChecklistItemId?: (item: AssistantChecklistItem) => string;
  handledAssistantChecklistItemIds?: string[];
  tripQuestionAnswer?: TripQuestionAnswerResponse | null;
  isAskingTripQuestion?: boolean;
  tripQuestionError?: string | null;
  onAskTripQuestion?: (question: string) => void;
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

const severityLabelStyles: Record<'info' | 'warning' | 'critical', string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

const CollapsiblePanel: React.FC<{
  title: string;
  description: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, description, badge, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            {badge && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{badge}</span>}
          </div>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <span className="text-sm font-medium text-purple-700">{isOpen ? 'Close' : 'Open'}</span>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 p-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
};

const AssistantBriefingCard: React.FC<{
  briefing?: TripAssistantBriefing | null;
  generatedAt?: string | null;
  isGenerating?: boolean;
  error?: string | null;
  onGenerate?: () => void;
  canEdit: boolean;
  onAssistantAction?: (target: AssistantActionTarget, eventId?: string) => void;
  onAcceptChecklistItem?: (item: AssistantChecklistItem) => void;
  onDismissChecklistItem?: (item: AssistantChecklistItem) => void;
  getChecklistItemId?: (item: AssistantChecklistItem) => string;
  handledChecklistItemIds?: string[];
}> = ({
  briefing,
  generatedAt,
  isGenerating,
  error,
  onGenerate,
  canEdit,
  onAssistantAction,
  onAcceptChecklistItem,
  onDismissChecklistItem,
  getChecklistItemId,
  handledChecklistItemIds = [],
}) => {
  const visibleChecklistItems = briefing?.suggestedChecklistItems.filter((item) => {
    const id = getChecklistItemId?.(item);
    return !id || !handledChecklistItemIds.includes(id);
  }) || [];

  const renderActionButton = (
    label: string | undefined,
    target: AssistantActionTarget | undefined,
    eventId?: string
  ) => {
    if (!canEdit || !label || !target || !onAssistantAction) return null;
    return (
      <Button variant="outline" size="sm" onClick={() => onAssistantAction(target, eventId)}>
        {label}
      </Button>
    );
  };

  return (
    <div className="rounded-lg border border-purple-100 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-purple-800">AI trip briefing</p>
          <p className="mt-1 text-sm text-gray-600">
            Ask the assistant to synthesize itinerary, weather, flight status, and notifications into next steps.
          </p>
        </div>
        {onGenerate && (
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : briefing ? 'Refresh briefing' : 'Generate briefing'}
          </Button>
        )}
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {briefing && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-700">{briefing.summary}</p>
          {briefing.topRisks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top risks</p>
              {briefing.topRisks.slice(0, 3).map((risk, index) => (
                <div key={`${risk.title}-${index}`} className="rounded-md border border-gray-100 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{risk.title}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', severityLabelStyles[risk.severity || 'info'])}>
                      {risk.severity || 'info'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{risk.reason}</p>
                  <div className="mt-2">
                    {renderActionButton(risk.actionLabel, risk.actionTarget, risk.eventId)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {briefing.nextBestActions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next best actions</p>
              <div className="space-y-2">
                {briefing.nextBestActions.slice(0, 3).map((action, index) => (
                  <div key={`${action.title}-${index}`} className="rounded-md border border-gray-100 p-2 text-sm text-gray-700">
                    <p><span className="font-medium">{action.title}:</span> {action.reason}</p>
                    <div className="mt-2">
                      {renderActionButton(action.actionLabel, action.actionTarget, action.eventId)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {visibleChecklistItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested checklist items</p>
              {visibleChecklistItems.slice(0, 3).map((item, index) => (
                <div key={`${item.text}-${index}`} className="rounded-md border border-gray-100 p-2 text-sm">
                  <p className="font-medium text-gray-900">{item.text}</p>
                  <p className="mt-1 text-gray-600">{item.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canEdit && onAcceptChecklistItem && (
                      <Button variant="outline" size="sm" onClick={() => onAcceptChecklistItem(item)}>
                        Add to {item.scope} checklist
                      </Button>
                    )}
                    {onDismissChecklistItem && (
                      <Button variant="ghost" size="sm" onClick={() => onDismissChecklistItem(item)}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {generatedAt && (
            <p className="text-xs text-gray-400">Generated {new Date(generatedAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
};

const AskMyTripCard: React.FC<{
  answer?: TripQuestionAnswerResponse | null;
  isAsking?: boolean;
  error?: string | null;
  onAsk?: (question: string) => void;
}> = ({ answer, isAsking, error, onAsk }) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    const trimmed = question.trim();
    if (!trimmed || !onAsk) return;
    onAsk(trimmed);
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
        <Lightbulb className="h-4 w-4" />
        Ask My Trip
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Ask a grounded question about this itinerary, weather, flights, notifications, or next events.
      </p>
      <div className="mt-3 space-y-2">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: What should I watch out for on arrival day?"
          className="min-h-[72px]"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={isAsking || !question.trim()}>
            <Send className="mr-1 h-4 w-4" />
            {isAsking ? 'Asking...' : 'Ask'}
          </Button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {answer && (
        <div className="mt-3 space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Question</p>
            <p className="mt-1 text-sm text-gray-700">{answer.question}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Answer</p>
            <p className="mt-1 text-sm text-gray-900">{answer.result.answer}</p>
          </div>
          {answer.result.supportingFacts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Supporting facts</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
                {answer.result.supportingFacts.map((fact, index) => (
                  <li key={`${fact}-${index}`}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
          {answer.result.caveat && (
            <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">{answer.result.caveat}</p>
          )}
          <p className="text-xs text-gray-400">Generated {new Date(answer.generatedAt).toLocaleString()}</p>
        </div>
      )}
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
  assistantBriefing,
  assistantBriefingGeneratedAt,
  isGeneratingAssistantBriefing,
  assistantBriefingError,
  onGenerateAssistantBriefing,
  onAssistantAction,
  onAcceptAssistantChecklistItem,
  onDismissAssistantChecklistItem,
  getAssistantChecklistItemId,
  handledAssistantChecklistItemIds,
  tripQuestionAnswer,
  isAskingTripQuestion,
  tripQuestionError,
  onAskTripQuestion,
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

      <div className="mt-4 space-y-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Planning snapshot</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <EventSummary label="Now" event={currentEvent} />
            <EventSummary label="Next" event={nextEvent} />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Needs attention</h3>
            </div>
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
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Assistant</h3>
          </div>
          <CollapsiblePanel
            title="AI trip briefing"
            description="Generate a synthesized readiness view from itinerary, weather, flights, and alerts."
            badge={assistantBriefing ? 'Generated' : 'Optional'}
            defaultOpen={Boolean(assistantBriefing || assistantBriefingError)}
          >
            <AssistantBriefingCard
              briefing={assistantBriefing}
              generatedAt={assistantBriefingGeneratedAt}
              isGenerating={isGeneratingAssistantBriefing}
              error={assistantBriefingError}
              onGenerate={onGenerateAssistantBriefing}
              canEdit={canEdit}
              onAssistantAction={onAssistantAction}
              onAcceptChecklistItem={onAcceptAssistantChecklistItem}
              onDismissChecklistItem={onDismissAssistantChecklistItem}
              getChecklistItemId={getAssistantChecklistItemId}
              handledChecklistItemIds={handledAssistantChecklistItemIds}
            />
          </CollapsiblePanel>
          <div className="mt-2">
            <CollapsiblePanel
              title="Ask My Trip"
              description="Ask a grounded question over the trip's structured context."
              badge={tripQuestionAnswer ? 'Answered' : 'Optional'}
              defaultOpen={Boolean(tripQuestionAnswer || tripQuestionError)}
            >
              <AskMyTripCard
                answer={tripQuestionAnswer}
                isAsking={isAskingTripQuestion}
                error={tripQuestionError}
                onAsk={onAskTripQuestion}
              />
            </CollapsiblePanel>
          </div>
        </section>
      </div>
    </section>
  );
};

export default TripCommandCenter;
