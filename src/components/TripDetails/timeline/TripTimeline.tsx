import React, { useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { Bell, CalendarPlus, CheckSquare, CloudSun, Info, Scale, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { Event, EventType, Trip } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import TripAddEventMenuItems from '@/components/TripDetails/TripAddEventMenuItems';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripNotification } from '@/types/notificationTypes';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { getEventGlanceRailTime } from '@/utils/eventGlance';
import { eventHasLocationAttention } from '@/utils/eventLocation';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import EventGlanceCard from '@/components/TripDetails/EventCards/EventGlanceCard';
import EventTimelineRailTime from '@/components/TripDetails/timeline/EventTimelineRailTime';
import { getDecisionForEvent, getSharedDecisionComparisonType, isEventSelectableForDecision } from '@/utils/decisionHelpers';
import { indexTimelineHealthIssuesByDate } from '@/utils/timelineHealthChips';
import {
  ALL_DAYS_FILTER_KEY,
  filterEventsByDayKey,
  formatTimelineDate,
  getMultidayEventDayRole,
  getTimelineDateKey,
  groupEventsByTimelineDateKeys,
  isTimelineDateToday,
  parseTimelineDateKey,
  UNSCHEDULED_FILTER_KEY,
} from '@/utils/timelineDates';
import TimelineLegConnector from '@/components/TripDetails/timeline/TimelineLegConnector';
import { buildTimelineLegKey, TimelineTransferLeg } from '@/types/timelineTransferLegTypes';
import { resolveTimelineTransferLeg } from '@/utils/transferAnalysis';
import { useTripReferenceNow } from '@/components/TripDetails/TripReferenceNowContext';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';

export interface TripTimelineHandle {
  scrollToEvent: (eventId: string) => void;
  scrollToDay: (dateKey: string) => void;
}

interface TripTimelineProps {
  events: Event[];
  trip?: Trip;
  tripStartDate?: string;
  tripEndDate?: string;
  eventThumbnails: Record<string, string>;
  canEdit: boolean;
  deletingEvents: Set<string>;
  weatherSnapshots: WeatherSnapshot[];
  flightStatusSnapshots: FlightStatusSnapshot[];
  notifications?: TripNotification[];
  onOpenEventDetail: (event: Event) => void;
  onOpenDecision?: (decisionId: string) => void;
  onCompareSelectedEvents?: (eventIds: string[]) => void;
  healthIssues?: TripHealthIssue[];
  onOpenHealthIssue?: (issueId: string) => void;
  onReviewEventLocation?: (event: Event) => void;
  addableEventTypes?: EventType[];
  onAddEvent?: (eventType: EventType) => void;
  onOpenAIImport?: () => void;
  onOpenExploreSuggestions?: () => void;
  onOpenPlaceSearch?: () => void;
  dayFilterKey?: string;
  selectedEventId?: string | null;
  timelineTransferLegs?: TimelineTransferLeg[];
  variant?: 'default' | 'map-sheet';
  currentUserId?: string;
  onVote?: (eventId: string, voteType: EventVoteAction) => void;
}

const formatWeatherForecast = (forecast: WeatherDay) => {
  const parts = [
    forecast.condition,
    typeof forecast.temperatureMax === 'number' && typeof forecast.temperatureMin === 'number'
      ? `${Math.round(forecast.temperatureMax)}/${Math.round(forecast.temperatureMin)} deg F`
      : null,
    typeof forecast.precipitationProbabilityMax === 'number'
      ? `${forecast.precipitationProbabilityMax}% rain`
      : null,
    typeof forecast.windSpeedMax === 'number' && forecast.windSpeedMax >= 15
      ? `${Math.round(forecast.windSpeedMax)} mph wind`
      : null,
  ].filter(Boolean);

  return parts.join(', ');
};

const ContextChip = ({
  icon,
  children,
  className,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-md shadow-slate-900/12 ring-1 ring-white/80',
        onClick && 'cursor-pointer transition-colors hover:opacity-90',
        className,
      )}
    >
      {icon}
      {children}
    </Component>
  );
};

const getDateFromKey = (dateKey: string) => parseTimelineDateKey(dateKey) ?? new Date(dateKey);

const getEventNotifications = (event: Event, notifications: TripNotification[]) => (
  notifications.filter(notification => !notification.readAt && !notification.dismissedAt && notification.eventId === event.id)
);

const getDayNotificationCount = (dateKey: string, notifications: TripNotification[]) => (
  notifications.filter((notification) => {
    if (notification.readAt || notification.dismissedAt || notification.eventId || !notification.scheduledFor) return false;
    return getTimelineDateKey({ startDate: notification.scheduledFor } as Event) === dateKey;
  }).length
);

const getDayWeatherSummary = (dateKey: string, weatherSnapshots: WeatherSnapshot[]) => {
  const date = getDateFromKey(dateKey);
  const forecast = weatherSnapshots
    .flatMap(snapshot => snapshot.daily || [])
    .find(day => day.date && getTimelineDateKey({ startDate: day.date } as Event) === getTimelineDateKey({ startDate: date.toISOString() } as Event));

  return forecast ? formatWeatherForecast(forecast) : null;
};

const getDayHeaderParts = (dateKey: string) => {
  if (dateKey === UNSCHEDULED_FILTER_KEY) {
    return { weekday: 'Unscheduled', date: 'Events without dates' };
  }
  return formatTimelineDate(dateKey);
};

const TripTimeline = forwardRef<TripTimelineHandle, TripTimelineProps>(function TripTimeline({
  events,
  trip,
  tripStartDate,
  tripEndDate,
  eventThumbnails,
  canEdit,
  deletingEvents,
  weatherSnapshots,
  flightStatusSnapshots,
  notifications = [],
  onOpenEventDetail,
  onOpenDecision,
  onCompareSelectedEvents,
  healthIssues = [],
  onOpenHealthIssue,
  onReviewEventLocation,
  addableEventTypes = [],
  onAddEvent,
  onOpenAIImport,
  onOpenExploreSuggestions,
  onOpenPlaceSearch,
  dayFilterKey = ALL_DAYS_FILTER_KEY,
  selectedEventId,
  timelineTransferLegs = [],
  variant = 'default',
  currentUserId,
  onVote,
}, ref) {
  const { referenceNow } = useTripReferenceNow();
  const isMapSheet = variant === 'map-sheet';
  const showAddEventMenu = canEdit
    && Boolean(onAddEvent && onOpenAIImport && onOpenExploreSuggestions && addableEventTypes.length > 0);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const eventSectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const daySectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const timelineSectionRef = useRef<HTMLElement>(null);

  const timelineTransferLegsByKey = useMemo(() => (
    new Map(
      timelineTransferLegs.map((leg) => [
        buildTimelineLegKey(leg.fromEventId, leg.toEventId, leg.dayKey),
        leg,
      ]),
    )
  ), [timelineTransferLegs]);

  const selectableEventIds = useMemo(() => {
    if (!trip) return new Set<string>();
    return new Set(
      events
        .filter((event) => isEventSelectableForDecision(event, trip))
        .map((event) => event.id),
    );
  }, [events, trip]);

  const selectedEvents = useMemo(
    () => events.filter((event) => selectedEventIds.has(event.id)),
    [events, selectedEventIds],
  );

  const activeSelectionType = useMemo(
    () => getSharedDecisionComparisonType(selectedEvents),
    [selectedEvents],
  );

  const healthChipsByDate = useMemo(
    () => indexTimelineHealthIssuesByDate(healthIssues, events),
    [healthIssues, events],
  );

  const toggleSelectedEvent = (eventId: string) => {
    const event = events.find((candidate) => candidate.id === eventId);
    if (!event || !selectableEventIds.has(eventId)) return;

    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
        return next;
      }

      if (next.size === 0) {
        next.add(eventId);
        return next;
      }

      const currentType = getSharedDecisionComparisonType(
        events.filter((candidate) => next.has(candidate.id)),
      );

      if (currentType && currentType !== event.type) {
        return new Set([eventId]);
      }

      next.add(eventId);
      return next;
    });
  };

  const isEventSelectionEligible = (event: Event) => (
    selectableEventIds.has(event.id)
    && (!activeSelectionType || event.type === activeSelectionType)
  );

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEventIds(new Set());
  };

  const handleCompareSelected = () => {
    if (selectedEventIds.size < 2) return;
    if (!getSharedDecisionComparisonType(selectedEvents)) return;
    onCompareSelectedEvents?.([...selectedEventIds]);
    exitSelectionMode();
  };

  const sortedEvents = sortEventsByStart(events).filter((event) => event.status !== 'alternative');
  const isDayFiltered = dayFilterKey !== ALL_DAYS_FILTER_KEY;

  const visibleEvents = useMemo(() => {
    if (!isDayFiltered) return sortedEvents;
    return filterEventsByDayKey(sortedEvents, dayFilterKey);
  }, [dayFilterKey, isDayFiltered, sortedEvents]);

  const tripDateRange = (() => {
    const start = tripStartDate ? new Date(tripStartDate) : null;
    const end = tripEndDate ? new Date(tripEndDate) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  })();
  const outOfRangeEvents = tripDateRange
    ? sortedEvents.filter((event) => {
        const start = getEventStart(event);
        return !!start && (start < tripDateRange.start || start > tripDateRange.end);
      })
    : [];
  const groupedEvents = useMemo(() => {
    if (isDayFiltered) {
      if (dayFilterKey === UNSCHEDULED_FILTER_KEY) {
        return { [UNSCHEDULED_FILTER_KEY]: visibleEvents };
      }
      return { [dayFilterKey]: visibleEvents };
    }

    return groupEventsByTimelineDateKeys(visibleEvents);
  }, [dayFilterKey, isDayFiltered, visibleEvents]);

  useImperativeHandle(ref, () => ({
    scrollToEvent: (eventId: string) => {
      const section = eventSectionRefs.current.get(eventId);
      if (!section) return;

      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    scrollToDay: (dateKey: string) => {
      const section = daySectionRefs.current.get(dateKey);
      if (!section) return;

      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }), []);

  return (
    <section
      ref={timelineSectionRef}
      className={cn(
        isMapSheet
          ? 'px-3 pb-3 pt-1'
          : 'bg-white pb-4 pt-3 md:rounded-[2rem] md:border md:border-slate-200/80 md:p-6 md:shadow-xl md:shadow-slate-900/[0.08]',
      )}
    >
      {isMapSheet ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Itinerary</p>
          <p className="text-[11px] font-medium text-slate-400">
            {visibleEvents.length} stop{visibleEvents.length === 1 ? '' : 's'}
          </p>
        </div>
      ) : (
      <div className="mb-4 flex items-center justify-between gap-3 px-3 md:mb-6 md:px-0">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-blue-700 sm:block">Main itinerary</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">Timeline</h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && onCompareSelectedEvents && selectableEventIds.size >= 2 && (
            <Button
              type="button"
              variant={isSelectionMode ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => {
                if (isSelectionMode) {
                  exitSelectionMode();
                } else {
                  setIsSelectionMode(true);
                }
              }}
            >
              {isSelectionMode ? (
                <>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="mr-1 h-3.5 w-3.5" />
                  Select
                </>
              )}
            </Button>
          )}
          <p className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 md:px-3 md:py-1 md:text-sm">
            {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}
            {isDayFiltered && sortedEvents.length !== visibleEvents.length && (
              <span className="text-slate-400"> / {sortedEvents.length}</span>
            )}
          </p>
        </div>
      </div>
      )}

      {isSelectionMode && !isMapSheet && (
        <div className="mx-3 mb-4 rounded-xl border border-dashed border-stone-300 bg-[#F7F2E8] px-3 py-2 text-xs text-stone-800 md:mx-0">
          Select two or more draft options of the same type — activity, destination, or stay — then compare them as alternatives.
          {activeSelectionType && (
            <span className="mt-1 block font-medium">
              Currently selecting {activeSelectionType === 'stay' ? 'stays' : `${activeSelectionType}s`}.
            </span>
          )}
        </div>
      )}

      {outOfRangeEvents.length > 0 && (
        <div className="mx-3 mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 md:mx-0">
          <p className="font-semibold">Some events are outside this trip&apos;s dates</p>
          <p className="mt-1">
            {outOfRangeEvents.map(getEventDisplayName).join(', ')} {outOfRangeEvents.length === 1 ? 'has' : 'have'} dates that do not match the trip range. Edit the event date to fix the timeline order.
          </p>
        </div>
      )}

      {sortedEvents.length === 0 ? (
        <div className="mx-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center md:mx-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <CalendarPlus className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-950">Start building the itinerary</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Add flights, stays, reservations, or activities to turn this trip into a timeline.
          </p>
          {showAddEventMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                  Add first event
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-64">
                <TripAddEventMenuItems
                  addableEventTypes={addableEventTypes}
                  onOpenAIImport={onOpenAIImport!}
                  onOpenExploreSuggestions={onOpenExploreSuggestions!}
                  onOpenPlaceSearch={onOpenPlaceSearch}
                  onAddEvent={onAddEvent!}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : visibleEvents.length === 0 && isDayFiltered ? (
        <div className="mx-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center md:mx-0">
          <h3 className="text-lg font-semibold text-slate-950">No events this day</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {dayFilterKey === UNSCHEDULED_FILTER_KEY
              ? 'All events have dates assigned.'
              : 'Nothing is scheduled for this day yet.'}
          </p>
        </div>
      ) : (
        <div className={cn('relative', isMapSheet ? 'pl-5 pr-0.5' : 'pl-7 pr-3 md:pr-0')}>
          <div className={cn(
            'pointer-events-none absolute bottom-0 top-0 z-0 w-px',
            isMapSheet ? 'left-2' : 'left-3',
            tripSurfaces.timelineSpine,
          )} />
          <div className={cn('relative', isMapSheet ? 'space-y-4' : 'space-y-6 md:space-y-8')}>
          {Object.entries(groupedEvents)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([dateKey, dateEvents]) => {
            const dateParts = getDayHeaderParts(dateKey);
            const isToday = dateKey !== UNSCHEDULED_FILTER_KEY && isTimelineDateToday(dateKey, referenceNow);
            const dayAlertCount = getDayNotificationCount(dateKey, notifications);
            const dayWeatherSummary = getDayWeatherSummary(dateKey, weatherSnapshots);
            const dayHealthChips = healthChipsByDate.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                ref={(element) => {
                  if (element) {
                    daySectionRefs.current.set(dateKey, element);
                  } else {
                    daySectionRefs.current.delete(dateKey);
                  }
                }}
                data-timeline-day={dateKey}
                className="relative scroll-mt-[calc(var(--trip-timeline-sticky-top,var(--trip-details-toolbar-height,7rem))+0.5rem)]"
              >
                <div className={cn(
                  'sticky z-20 mb-1.5 py-0.5',
                  isMapSheet
                    ? 'top-0'
                    : 'top-[var(--trip-timeline-sticky-top,var(--trip-details-toolbar-height,7rem))] mb-2 md:mb-3',
                )}>
                  <div>
                    <div className={cn(
                      'inline-flex w-full max-w-full items-center gap-2 rounded-lg border sm:w-auto',
                      isMapSheet ? 'px-2 py-0.5' : 'px-2.5 py-1',
                      isToday
                        ? tripSurfaces.dayHeaderToday
                        : tripSurfaces.dayHeaderDefault,
                      isMapSheet
                        ? 'shadow-md shadow-slate-900/10 ring-1 ring-white/50'
                        : 'shadow-lg shadow-slate-900/20 ring-1 ring-white/60',
                    )}>
                      <span className={cn(
                        'h-2 w-2 shrink-0 rounded-full ring-1 ring-white/30',
                        isToday ? 'animate-pulse bg-white' : 'bg-slate-300',
                      )} />
                      <p className="min-w-0 truncate text-xs font-semibold leading-none text-white">
                        <span className="uppercase tracking-wide opacity-90">{dateParts.weekday}</span>
                        {dateParts.date && (
                          <>
                            <span className="mx-1.5 opacity-50">·</span>
                            <span>{dateParts.date}</span>
                          </>
                        )}
                      </p>
                      {isToday && (
                        <span className="ml-1 shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25">
                          Today
                        </span>
                      )}
                    </div>
                    {(dayWeatherSummary || dayAlertCount > 0 || dayHealthChips.length > 0) && (
                      <div className={cn('flex flex-wrap gap-1.5', isMapSheet ? 'mt-1.5' : 'mt-2 gap-2')}>
                        {dayHealthChips.map((chip) => (
                          <ContextChip
                            key={chip.issueId}
                            icon={<Info className="h-3 w-3" />}
                            className={cn(
                              'cursor-pointer',
                              chip.severity === 'critical' && 'border-rose-100 bg-rose-50 text-rose-800',
                              chip.severity === 'warning' && 'border-amber-100 bg-amber-50 text-amber-800',
                              chip.severity === 'info' && 'border-blue-100 bg-blue-50 text-blue-800',
                            )}
                            onClick={onOpenHealthIssue ? () => onOpenHealthIssue(chip.issueId) : undefined}
                          >
                            {chip.label}
                          </ContextChip>
                        ))}
                        {dayWeatherSummary && (
                          <ContextChip icon={<CloudSun className="h-3 w-3" />} className="border-sky-100 bg-sky-50 text-sky-800">
                            {dayWeatherSummary}
                          </ContextChip>
                        )}
                        {dayAlertCount > 0 && (
                          <ContextChip icon={<Bell className="h-3 w-3" />} className="border-amber-100 bg-amber-50 text-amber-800">
                            {dayAlertCount} alert{dayAlertCount === 1 ? '' : 's'}
                          </ContextChip>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className={cn(isMapSheet ? 'space-y-3' : 'space-y-4')}>
                  {sortEventsByStart(dateEvents).map((event, eventIndex, dayEvents) => {
                    const resolvedLeg = resolveTimelineTransferLeg(
                      sortedEvents,
                      dayEvents,
                      eventIndex,
                      event,
                      dateKey,
                      weatherSnapshots,
                    );
                    const previousEvent = resolvedLeg?.previousEvent ?? null;
                    const transferLeg = resolvedLeg?.transfer ?? null;
                    const cachedDrivingLeg = previousEvent && transferLeg
                      ? timelineTransferLegsByKey.get(
                        buildTimelineLegKey(previousEvent.id, event.id, dateKey),
                      )
                      : undefined;
                    const registryItem = EVENT_TYPES[event.type];
                    if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
                    const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail;
                    const isDeleting = deletingEvents.has(event.id);
                    const eventAlerts = getEventNotifications(event, notifications);
                    const hasLocationIssue = eventHasLocationAttention(event);
                    const hasFlightStatus = event.type === 'flight' && flightStatusSnapshots.some(status => status.eventId === event.id);
                    const activeDecision = trip
                      ? getDecisionForEvent(trip.decisions, event.id)
                      : undefined;
                    const isEventActive = isEventCurrentlyActive(event, referenceNow);
                    const multidayRole = getMultidayEventDayRole(event, dateKey);
                    const glanceAttention = {
                      alertCount: eventAlerts.length > 0 ? eventAlerts.length : undefined,
                      hasLocationIssue,
                      hasFlightStatus,
                      decisionTitle: activeDecision
                        ? activeDecision.title
                        : undefined,
                    };
                    const openEventDetails = () => onOpenEventDetail(event);
                    const railTime = getEventGlanceRailTime(event, multidayRole);
                    const hasRailTime = railTime != null && railTime !== '—';
                    const showMobileMetaRow = Boolean(transferLeg) || hasRailTime;

                    return (
                        <div
                          ref={(element) => {
                            if (element) {
                              eventSectionRefs.current.set(event.id, element);
                            } else {
                              eventSectionRefs.current.delete(event.id);
                            }
                          }}
                          key={event.id}
                          data-timeline-event={event.id}
                          className={cn(
                            'relative min-w-0 transition-all duration-300',
                            isDeleting && 'animate-fade-out opacity-0',
                            selectedEventId === event.id
                              && 'rounded-2xl ring-2 ring-blue-400 ring-offset-2 ring-offset-white max-md:ring-inset max-md:ring-offset-0',
                          )}
                        >
                        <div className={cn(
                          'absolute h-3 w-3 rounded-full',
                          isMapSheet ? '-left-[0.85rem]' : '-left-[1.45rem]',
                          showMobileMetaRow ? 'top-2.5 md:top-6' : 'top-6',
                          isEventActive
                            ? tripSurfaces.timelineDotActive
                            : isToday
                              ? tripSurfaces.timelineDotToday
                              : tripSurfaces.timelineDot,
                        )} />
                        {showMobileMetaRow && (
                          <div className="mb-1.5 flex min-w-0 items-center gap-2 md:hidden">
                            {hasRailTime && (
                              <EventTimelineRailTime
                                variant="inline"
                                event={event}
                                multidayRole={multidayRole}
                              />
                            )}
                            {transferLeg && (
                              <TimelineLegConnector
                                variant="inline"
                                transfer={transferLeg}
                                drivingLeg={cachedDrivingLeg}
                              />
                            )}
                          </div>
                        )}
                        {transferLeg && (
                          <TimelineLegConnector
                            variant="rail"
                            className="hidden md:flex"
                            transfer={transferLeg}
                            drivingLeg={cachedDrivingLeg}
                          />
                        )}
                        <div className="flex min-w-0 gap-3">
                          <EventTimelineRailTime
                            variant="rail"
                            className="hidden md:block"
                            event={event}
                            multidayRole={multidayRole}
                          />
                          <div className="min-w-0 flex-1">
                            <EventGlanceCard
                              event={event}
                              thumbnail={thumbnail}
                              weatherSnapshots={weatherSnapshots}
                              onOpenDetail={openEventDetails}
                              isSelectionMode={isSelectionMode}
                              isSelected={selectedEventIds.has(event.id)}
                              isSelectable={isEventSelectionEligible(event)}
                              onToggleSelected={() => toggleSelectedEvent(event.id)}
                              showTimeInBody={false}
                              multidayRole={multidayRole}
                              viewDateKey={dateKey}
                              attention={glanceAttention}
                              onOpenDecision={
                                activeDecision && onOpenDecision
                                  ? () => onOpenDecision(activeDecision.id)
                                  : undefined
                              }
                              onReviewLocation={
                                canEdit && hasLocationIssue && onReviewEventLocation
                                  ? () => onReviewEventLocation(event)
                                  : undefined
                              }
                              trip={trip}
                              currentUserId={currentUserId}
                              onVote={onVote}
                              canVote={canEdit}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {isSelectionMode && !isMapSheet && selectedEventIds.size >= 2 && (
        <div className="sticky bottom-3 z-20 mt-4 flex justify-center md:bottom-4">
          <Button
            type="button"
            className="rounded-full shadow-lg"
            onClick={handleCompareSelected}
          >
            <Scale className="mr-2 h-4 w-4" />
            Compare {selectedEventIds.size} as alternatives
          </Button>
        </div>
      )}
    </section>
  );
});

export default TripTimeline;
