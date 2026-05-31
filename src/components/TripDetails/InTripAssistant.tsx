import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event, Trip } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripInsight } from '@/types/insightTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { TripReplanBriefing, TripTodayBriefing } from '@/types/assistantBriefingTypes';
import { cn } from '@/lib/utils';
import {
  buildInTripAssistantContent,
  hasReplanBriefingContent,
  hasTodayBriefingContent,
  InTripActionTarget,
  InTripAttentionItem,
  InTripHandyGroup,
  InTripHeroAction,
} from '@/utils/inTripAssistantContent';
import { useTripReferenceNow } from './TripReferenceNowContext';

interface InTripAssistantProps {
  trip: Trip;
  insights: TripInsight[];
  canEdit: boolean;
  weatherSnapshots?: WeatherSnapshot[];
  flightStatusSnapshots?: FlightStatusSnapshot[];
  todayBriefing?: TripTodayBriefing | null;
  todayBriefingGeneratedAt?: string | null;
  todayBriefingError?: string | null;
  isGeneratingTodayBriefing?: boolean;
  replanBriefing?: TripReplanBriefing | null;
  replanBriefingGeneratedAt?: string | null;
  replanBriefingError?: string | null;
  isGeneratingReplanBriefing?: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
  onOpenChecklist: () => void;
  onOpenEventDetail: (event: Event) => void;
  onGenerateTodayBriefing?: () => void;
  onGenerateReplanBriefing?: () => void;
  onDismissInsight?: (insightId: string) => void;
  variant?: 'panel' | 'embedded';
}

const severityStyles = {
  critical: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
} as const;

const heroStyles = {
  ai: 'border-violet-200 bg-violet-50 text-violet-950',
  computed: 'border-blue-200 bg-blue-50 text-blue-950',
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  empty: 'border-slate-200 bg-slate-50 text-slate-800',
} as const;

const copyText = async (text: string) => {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
};

const useActionHandler = (
  onOpenChecklist: () => void,
  onOpenEventDetailById: (eventId: string) => void,
) => (target: InTripActionTarget | undefined, eventId?: string, directionsUrl?: string) => {
  if (target === 'checklist') {
    onOpenChecklist();
    return;
  }
  if (target === 'directions' && directionsUrl) {
    window.open(directionsUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (target === 'event' && eventId) {
    onOpenEventDetailById(eventId);
  }
};

const HeroSection: React.FC<{
  hero: InTripHeroAction;
  onAction: ReturnType<typeof useActionHandler>;
}> = ({ hero, onAction }) => (
  <section className={cn('rounded-xl border p-4', heroStyles[hero.source])}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Do this next</p>
    <p className="mt-1 text-base font-semibold">{hero.title}</p>
    {hero.subtitle && <p className="mt-1 text-sm opacity-90">{hero.subtitle}</p>}
    {hero.actionLabel && hero.actionTarget !== 'none' && (
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-8 bg-white/70"
        onClick={() => onAction(hero.actionTarget, hero.eventId, hero.directionsUrl)}
      >
        {hero.actionLabel}
      </Button>
    )}
  </section>
);

const AttentionSection: React.FC<{
  items: InTripAttentionItem[];
  onAction: ReturnType<typeof useActionHandler>;
  onDismissInsight?: (insightId: string) => void;
}> = ({ items, onAction, onDismissInsight }) => {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Needs attention</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn('rounded-lg border p-3 text-sm', severityStyles[item.severity])}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 opacity-90">{item.reason}</p>
                {item.actionLabel && item.actionTarget && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-8 bg-white/70"
                    onClick={() => onAction(item.actionTarget, item.eventId, item.directionsUrl)}
                  >
                    {item.actionLabel}
                  </Button>
                )}
              </div>
              {onDismissInsight && item.dismissible && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => onDismissInsight(item.id)}
                  aria-label={`Dismiss ${item.title}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const handyRoleStyles = {
  now: 'border-emerald-200 bg-emerald-50/50',
  next: 'border-blue-200 bg-blue-50/40',
} as const;

const HandySection: React.FC<{
  groups: InTripHandyGroup[];
  onOpenEventDetailById: (eventId: string) => void;
}> = ({ groups, onOpenEventDetailById }) => {
  if (groups.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Handy right now</h3>
      <div className="space-y-2">
        {groups.map((group) => (
          <div
            key={group.eventId}
            className={cn('rounded-lg border p-3', handyRoleStyles[group.eventRole])}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onOpenEventDetailById(group.eventId)}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {group.eventRole === 'now' ? 'Now' : 'Next up'}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{group.eventName}</p>
              {group.eventTimeLabel && (
                <p className="mt-0.5 text-xs text-slate-600">{group.eventTimeLabel}</p>
              )}
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.items.map((item) => {
                if (item.href) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.label}
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.copyable) {
                        copyText(item.value);
                        return;
                      }
                      onOpenEventDetailById(group.eventId);
                    }}
                  >
                    <span className="text-slate-500">{item.label}:</span>
                    <span className="max-w-[8rem] truncate">{item.value}</span>
                    {item.copyable && <Copy className="h-3 w-3 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const AssistantSection: React.FC<{
  todayBriefing?: TripTodayBriefing | null;
  todayBriefingGeneratedAt?: string | null;
  todayBriefingError?: string | null;
  isGeneratingTodayBriefing?: boolean;
  replanBriefing?: TripReplanBriefing | null;
  replanBriefingGeneratedAt?: string | null;
  replanBriefingError?: string | null;
  isGeneratingReplanBriefing?: boolean;
  onGenerateTodayBriefing?: () => void;
  onGenerateReplanBriefing?: () => void;
  onOpenChecklist: () => void;
  onOpenEventDetailById: (eventId: string) => void;
}> = ({
  todayBriefing,
  todayBriefingGeneratedAt,
  todayBriefingError,
  isGeneratingTodayBriefing,
  replanBriefing,
  replanBriefingGeneratedAt,
  replanBriefingError,
  isGeneratingReplanBriefing,
  onGenerateTodayBriefing,
  onGenerateReplanBriefing,
  onOpenChecklist,
  onOpenEventDetailById,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'summary' | 'replan'>('summary');
  const hasToday = hasTodayBriefingContent(todayBriefing);
  const hasReplan = hasReplanBriefingContent(replanBriefing);
  const activeError = mode === 'summary' ? todayBriefingError : replanBriefingError;
  const activeGeneratedAt = mode === 'summary' ? todayBriefingGeneratedAt : replanBriefingGeneratedAt;
  const isGenerating = mode === 'summary' ? isGeneratingTodayBriefing : isGeneratingReplanBriefing;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Assistant</p>
            <p className="text-xs text-slate-500">Summaries and replan suggestions on demand</p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'summary' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setMode('summary')}
            >
              Summarize today
            </Button>
            <Button
              type="button"
              variant={mode === 'replan' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setMode('replan')}
            >
              Review changes
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === 'summary' && onGenerateTodayBriefing && (
              <Button variant="outline" size="sm" onClick={onGenerateTodayBriefing} disabled={isGeneratingTodayBriefing}>
                {isGeneratingTodayBriefing ? 'Generating...' : hasToday ? 'Refresh summary' : 'Generate summary'}
              </Button>
            )}
            {mode === 'replan' && onGenerateReplanBriefing && (
              <Button variant="outline" size="sm" onClick={onGenerateReplanBriefing} disabled={isGeneratingReplanBriefing}>
                {isGeneratingReplanBriefing ? 'Reviewing...' : hasReplan ? 'Refresh review' : 'Run review'}
              </Button>
            )}
          </div>

          {activeError && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{activeError}</p>
          )}

          {mode === 'summary' && hasToday && todayBriefing && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-slate-800">{todayBriefing.summary}</p>
              {todayBriefing.watchItems.length > 0 && (
                <div className="space-y-2">
                  {todayBriefing.watchItems.slice(0, 3).map((item, index) => (
                    <div key={`${item.title}-${index}`} className={cn('rounded-md border p-2', severityStyles[item.severity || 'info'])}>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 opacity-90">{item.reason}</p>
                      {item.eventId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-8"
                          onClick={() => onOpenEventDetailById(item.eventId!)}
                        >
                          View event
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {todayBriefing.collaboratorMessage && (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Shareable update:</span> {todayBriefing.collaboratorMessage}
                </p>
              )}
            </div>
          )}

          {mode === 'replan' && hasReplan && replanBriefing && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-slate-800">{replanBriefing.summary}</p>
              {replanBriefing.suggestions.slice(0, 4).map((suggestion, index) => (
                <div key={`${suggestion.title}-${index}`} className={cn('rounded-md border p-2', severityStyles[suggestion.severity || 'info'])}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{suggestion.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{suggestion.suggestionType}</span>
                  </div>
                  <p className="mt-1 opacity-90">{suggestion.reason}</p>
                  {suggestion.actionLabel && suggestion.actionTarget && (
                    <div className="mt-2">
                      {suggestion.actionTarget === 'checklist' ? (
                        <Button variant="outline" size="sm" onClick={onOpenChecklist}>
                          {suggestion.actionLabel}
                        </Button>
                      ) : suggestion.eventId ? (
                        <Button variant="outline" size="sm" onClick={() => onOpenEventDetailById(suggestion.eventId!)}>
                          {suggestion.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {replanBriefing.caveat && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">{replanBriefing.caveat}</p>
              )}
            </div>
          )}

          {!isGenerating && mode === 'summary' && !hasToday && !activeError && (
            <p className="text-sm text-slate-500">Generate a summary when you want a second opinion on today.</p>
          )}
          {!isGenerating && mode === 'replan' && !hasReplan && !activeError && (
            <p className="text-sm text-slate-500">Run a review when conditions change and you want replan ideas.</p>
          )}

          {activeGeneratedAt && (
            <p className="text-xs text-slate-400">Generated {new Date(activeGeneratedAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </section>
  );
};

const InTripAssistant: React.FC<InTripAssistantProps> = ({
  trip,
  insights,
  weatherSnapshots = [],
  flightStatusSnapshots = [],
  todayBriefing,
  todayBriefingGeneratedAt,
  todayBriefingError,
  isGeneratingTodayBriefing,
  replanBriefing,
  replanBriefingGeneratedAt,
  replanBriefingError,
  isGeneratingReplanBriefing,
  onClose,
  showCloseButton = true,
  onOpenChecklist,
  onOpenEventDetail,
  onGenerateTodayBriefing,
  onGenerateReplanBriefing,
  onDismissInsight,
  variant = 'panel',
}) => {
  const { referenceNow } = useTripReferenceNow();
  const content = useMemo(
    () => buildInTripAssistantContent({
      trip,
      insights,
      weatherSnapshots,
      flightStatusSnapshots,
      todayBriefing,
      now: referenceNow,
    }),
    [trip, insights, weatherSnapshots, flightStatusSnapshots, todayBriefing, referenceNow],
  );

  const handleOpenEventDetailById = (eventId: string) => {
    const event = trip.events.find((tripEvent) => tripEvent.id === eventId);
    if (event) onOpenEventDetail(event);
  };

  const handleAction = useActionHandler(onOpenChecklist, handleOpenEventDetailById);

  const isEmbedded = variant === 'embedded';

  return (
    <div className={cn(
      'flex h-full min-h-0 flex-col overflow-hidden bg-white text-gray-900',
    )}>
      <div className={cn(
        'flex shrink-0 items-start justify-between border-b border-gray-200',
        isEmbedded ? 'px-3 py-2' : 'p-4',
      )}>
        <div>
          {!isEmbedded && (
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <CalendarDays className="h-4 w-4" />
              Today
            </div>
          )}
          <h2 className={cn(
            'font-semibold',
            isEmbedded ? 'text-sm text-slate-900' : 'mt-1 text-lg',
          )}>
            Actions & live updates
          </h2>
          {!isEmbedded && (
            <p className="mt-1 text-sm text-gray-600">What to do or watch for in the next few hours.</p>
          )}
        </div>
        {showCloseButton && (
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Close Today">
            <X size={20} />
          </button>
        )}
      </div>

      <div className={cn(
        'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain',
        isEmbedded ? 'p-3' : 'p-4',
      )}>
        <HeroSection hero={content.hero} onAction={handleAction} />

        <AttentionSection
          items={content.attentionItems}
          onAction={handleAction}
          onDismissInsight={onDismissInsight}
        />

        <HandySection
          groups={content.handyGroups}
          onOpenEventDetailById={handleOpenEventDetailById}
        />

        <AssistantSection
          todayBriefing={todayBriefing}
          todayBriefingGeneratedAt={todayBriefingGeneratedAt}
          todayBriefingError={todayBriefingError}
          isGeneratingTodayBriefing={isGeneratingTodayBriefing}
          replanBriefing={replanBriefing}
          replanBriefingGeneratedAt={replanBriefingGeneratedAt}
          replanBriefingError={replanBriefingError}
          isGeneratingReplanBriefing={isGeneratingReplanBriefing}
          onGenerateTodayBriefing={onGenerateTodayBriefing}
          onGenerateReplanBriefing={onGenerateReplanBriefing}
          onOpenChecklist={onOpenChecklist}
          onOpenEventDetailById={handleOpenEventDetailById}
        />

        {content.tomorrowPreview && (
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tomorrow</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{content.tomorrowPreview.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{content.tomorrowPreview.subtitle}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 px-0 text-blue-700 hover:bg-transparent hover:text-blue-800"
              onClick={() => handleOpenEventDetailById(content.tomorrowPreview!.eventId)}
            >
              View details
            </Button>
          </section>
        )}
      </div>
    </div>
  );
};

export default InTripAssistant;
