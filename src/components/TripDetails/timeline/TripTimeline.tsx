import React, { useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { format } from 'date-fns';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import { Bell, CalendarPlus, CheckSquare, CloudSun, Info, MapPin, Navigation, Scale, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { Event, Trip } from '@/types/eventTypes';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripNotification } from '@/types/notificationTypes';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { eventHasLocationAttention, getGoogleMapsSearchUrl } from '@/utils/eventLocation';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';
import EventVoteControls from '@/components/TripDetails/EventCards/EventVoteControls';
import EventStatusChip from '@/components/TripDetails/EventCards/EventStatusChip';
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
import { MultidayEndpointCard, MultidaySpanChip } from '@/components/TripDetails/timeline/MultidayTimelineCards';

export interface TripTimelineHandle {
  scrollToEvent: (eventId: string) => void;
}

interface TripTimelineProps {
  events: Event[];
  trip?: Trip;
  tripId?: string;
  currentUserId?: string;
  tripStartDate?: string;
  tripEndDate?: string;
  eventThumbnails: Record<string, string>;
  isCondensedView: boolean;
  canEdit: boolean;
  deletingEvents: Set<string>;
  weatherSnapshots: WeatherSnapshot[];
  flightStatusSnapshots: FlightStatusSnapshot[];
  notifications?: TripNotification[];
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (eventId: string) => void;
  onStatusChange: (event: Event, status: 'confirmed' | 'exploring') => void;
  onVote?: (eventId: string, voteType: EventVoteAction) => void;
  onOpenDecision?: (decisionId: string) => void;
  onCompareSelectedEvents?: (eventIds: string[]) => void;
  healthIssues?: TripHealthIssue[];
  onOpenHealthIssue?: (issueId: string) => void;
  onLocationApplied?: (events: Event[]) => void;
  onReviewEventLocation?: (event: Event) => void;
  onAddEvent?: () => void;
  dayFilterKey?: string;
  selectedEventId?: string | null;
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
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
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

const EventWeatherForecast = ({
  event,
  weatherSnapshots,
}: {
  event: Event;
  weatherSnapshots: WeatherSnapshot[];
}) => {
  const snapshots = weatherSnapshots.filter(snapshot => (
    (snapshot.originalEventId || snapshot.eventId) === event.id && snapshot.daily?.length > 0
  ));
  if (snapshots.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      {snapshots.map((snapshot) => {
        const forecast = snapshot.daily?.[0];
        if (!forecast) return null;
        const label = snapshot.locationRole === 'departure'
          ? 'Departure weather'
          : snapshot.locationRole === 'arrival'
            ? 'Arrival weather'
            : 'Weather forecast';

        return (
          <div key={snapshot._id || `${snapshot.eventId}-${snapshot.date}`} className="flex items-center gap-2">
            <CloudSun className="h-4 w-4 flex-shrink-0 text-sky-600" />
            <span>
              <span className="font-medium">{label}:</span> {formatWeatherForecast(forecast)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const FlightStatusSummary = ({
  event,
  flightStatusSnapshots,
}: {
  event: Event;
  flightStatusSnapshots: FlightStatusSnapshot[];
}) => {
  if (event.type !== 'flight') return null;

  const snapshot = flightStatusSnapshots.find(status => status.eventId === event.id);
  if (!snapshot) return null;

  const departureParts = [
    snapshot.departure?.terminal ? `Terminal ${snapshot.departure.terminal}` : null,
    snapshot.departure?.gate ? `Gate ${snapshot.departure.gate}` : null,
    typeof snapshot.departure?.delayMinutes === 'number' && snapshot.departure.delayMinutes > 0
      ? `${snapshot.departure.delayMinutes} min delay`
      : null,
  ].filter(Boolean);
  const arrivalDelay = typeof snapshot.arrival?.delayMinutes === 'number' && snapshot.arrival.delayMinutes > 0
    ? `Arrival ${snapshot.arrival.delayMinutes} min delay`
    : null;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-900">
      <FaPlane className="h-4 w-4 flex-shrink-0 text-violet-600" />
      <span>
        <span className="font-medium">Flight status:</span> {[snapshot.status, ...departureParts, arrivalDelay].filter(Boolean).join(' | ')}
      </span>
    </div>
  );
};

const getEventIcon = (event: Event) => {
  switch (event.type) {
    case 'flight':
      return <FaPlane className="h-5 w-5 text-blue-500" />;
    case 'arrival':
      return <FaPlane className="h-5 w-5 rotate-45 text-green-500" />;
    case 'departure':
      return <FaPlane className="h-5 w-5 -rotate-45 text-red-500" />;
    case 'train':
      return <FaTrain className="h-5 w-5 text-green-500" />;
    case 'bus':
      return <FaBus className="h-5 w-5 text-purple-500" />;
    case 'rental_car':
      return <FaCar className="h-5 w-5 text-red-500" />;
    case 'stay':
      return <FaHotel className="h-5 w-5 text-yellow-500" />;
    case 'destination':
      return <FaMapMarkerAlt className="h-5 w-5 text-pink-500" />;
    case 'activity':
      return <FaMountain className="h-5 w-5 text-indigo-500" />;
    default:
      return <FaMapMarkerAlt className="h-5 w-5 text-slate-500" />;
  }
};

const getDayHeaderParts = (dateKey: string) => {
  if (dateKey === UNSCHEDULED_FILTER_KEY) {
    return { weekday: 'Unscheduled', date: 'Events without dates' };
  }
  return formatTimelineDate(dateKey);
};

const CondensedEventCard = ({
  event,
  thumbnail,
  trip,
  currentUserId,
  onVote,
  onEdit,
  onReviewLocation,
  isSelectionMode = false,
  isSelected = false,
  isSelectable = false,
  onToggleSelected,
  canEdit = true,
}: {
  event: Event;
  thumbnail: string;
  trip?: Trip;
  currentUserId?: string;
  onVote?: (eventId: string, voteType: EventVoteAction) => void;
  onEdit?: () => void;
  onReviewLocation?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  onToggleSelected?: () => void;
  canEdit?: boolean;
}) => {
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event);
  const start = getEventStart(event);
  const mapsUrl = getGoogleMapsSearchUrl(event);

  return (
    <div
      className={cn(
        tripSurfaces.content,
        tripSurfaces.contentHover,
        'relative flex items-center gap-3 p-3 hover:border-blue-200/80',
        isExploring && 'border-amber-200 bg-amber-50/80',
        isActive && !isExploring && 'border-blue-200 bg-blue-50/60 shadow-blue-100',
        isSelectionMode && isSelected && 'border-violet-400 ring-2 ring-violet-100',
        isSelectionMode && isSelectable && 'cursor-pointer',
      )}
      onClick={isSelectionMode && isSelectable ? onToggleSelected : undefined}
    >
      {isSelectionMode && isSelectable && (
        <div className="absolute left-2 top-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelected}
            onClick={(eventClick) => eventClick.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300"
          />
        </div>
      )}
      {isActive && !isExploring && (
        <div className="absolute -left-1 top-3 h-[calc(100%-1.5rem)] w-1 rounded-full bg-blue-500" />
      )}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
        <img src={thumbnail} alt={event.type} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-950/35" />
        <div className="absolute bottom-1 right-1 rounded-full bg-white p-1.5 shadow">
          {getEventIcon(event)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-950">{getEventDisplayName(event)}</h3>
          <EventStatusChip event={event} />
          {isActive && !isExploring && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              Now
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {start && <span>{format(start, 'MMM d, h:mm a')}</span>}
          {isExploring && trip && onVote && (
            <EventVoteControls
              event={event}
              trip={trip}
              currentUserId={currentUserId}
              onVote={onVote}
              readOnly={!canEdit}
            />
          )}
          {event.location?.quality && event.location.quality !== 'exact' && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location {event.location.quality}
            </span>
          )}
          {typeof (event as { bookingReference?: unknown }).bookingReference === 'string' && (
            <span className="inline-flex items-center gap-1">
              <Info className="h-3 w-3" />
              Booking: {(event as unknown as { bookingReference: string }).bookingReference}
            </span>
          )}
        </div>
      </div>
      {!isSelectionMode && (
        <div className="flex shrink-0 flex-col gap-1">
          {onEdit && (
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Open event details"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit();
              }}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Get directions"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              <Navigation className="h-4 w-4" />
            </a>
          )}
          {canEdit && onReviewLocation && eventHasLocationAttention(event) && (
            <button
              type="button"
              className="rounded-full p-2 text-teal-600 transition-colors hover:bg-teal-50"
              aria-label="Review location"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onReviewLocation();
              }}
            >
              <MapPin className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const TripTimeline = forwardRef<TripTimelineHandle, TripTimelineProps>(function TripTimeline({
  events,
  trip,
  tripId,
  currentUserId,
  tripStartDate,
  tripEndDate,
  eventThumbnails,
  isCondensedView,
  canEdit,
  deletingEvents,
  weatherSnapshots,
  flightStatusSnapshots,
  notifications = [],
  onEditEvent,
  onDeleteEvent,
  onStatusChange,
  onVote,
  onOpenDecision,
  onCompareSelectedEvents,
  healthIssues = [],
  onOpenHealthIssue,
  onLocationApplied,
  onReviewEventLocation,
  onAddEvent,
  dayFilterKey = ALL_DAYS_FILTER_KEY,
  selectedEventId,
}, ref) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const eventSectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const timelineSectionRef = useRef<HTMLElement>(null);

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
  }), []);

  return (
    <section ref={timelineSectionRef} className={cn(tripSurfaces.floatStrong, 'p-3 md:p-6')}>
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
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

      {isSelectionMode && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs text-violet-900">
          Select two or more exploring options of the same type — activity, destination, or stay — then compare them as alternatives.
          {activeSelectionType && (
            <span className="mt-1 block font-medium">
              Currently selecting {activeSelectionType === 'stay' ? 'stays' : `${activeSelectionType}s`}.
            </span>
          )}
        </div>
      )}

      {outOfRangeEvents.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Some events are outside this trip&apos;s dates</p>
          <p className="mt-1">
            {outOfRangeEvents.map(getEventDisplayName).join(', ')} {outOfRangeEvents.length === 1 ? 'has' : 'have'} dates that do not match the trip range. Edit the event date to fix the timeline order.
          </p>
        </div>
      )}

      {sortedEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <CalendarPlus className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-950">Start building the itinerary</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Add flights, stays, reservations, or activities to turn this trip into a timeline.
          </p>
          {onAddEvent && (
            <button
              type="button"
              className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              onClick={onAddEvent}
            >
              Add first event
            </button>
          )}
        </div>
      ) : visibleEvents.length === 0 && isDayFiltered ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-950">No events this day</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {dayFilterKey === UNSCHEDULED_FILTER_KEY
              ? 'All events have dates assigned.'
              : 'Nothing is scheduled for this day yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {Object.entries(groupedEvents)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([dateKey, dateEvents]) => {
            const dateParts = getDayHeaderParts(dateKey);
            const isToday = dateKey !== UNSCHEDULED_FILTER_KEY && isTimelineDateToday(dateKey);
            const hasActiveEvent = dateEvents.some(event => isEventCurrentlyActive(event));
            const dayAlertCount = getDayNotificationCount(dateKey, notifications);
            const dayWeatherSummary = getDayWeatherSummary(dateKey, weatherSnapshots);
            const dayHealthChips = healthChipsByDate.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className="relative pl-7"
              >
                <div className={cn('absolute bottom-0 left-3 top-12 w-px', tripSurfaces.timelineSpine)} />
                <div className={cn(
                  'sticky top-[var(--trip-timeline-sticky-top,3.5rem)] z-30 mb-3 -ml-7 py-1.5 md:top-[var(--trip-timeline-sticky-top-md,5rem)] md:mb-4 md:py-2',
                  isToday ? 'bg-gradient-to-b from-blue-50/90 to-transparent' : 'bg-white/90 backdrop-blur-sm',
                )}>
                  <div className={cn(
                    'inline-flex items-center gap-3 rounded-2xl border px-4 py-2',
                    isToday || hasActiveEvent
                      ? tripSurfaces.dayHeaderToday
                      : tripSurfaces.dayHeaderDefault,
                  )}>
                    <span className={cn(
                      'h-3 w-3 rounded-full',
                      isToday || hasActiveEvent ? 'animate-pulse bg-blue-500' : 'bg-slate-300',
                    )} />
                    <div>
                      <p className="text-sm font-bold">{dateParts.weekday}</p>
                      {dateParts.date && <p className="text-xs text-slate-500">{dateParts.date}</p>}
                    </div>
                    {(isToday || hasActiveEvent) && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                        Today
                      </span>
                    )}
                  </div>
                  {(dayWeatherSummary || dayAlertCount > 0 || dayHealthChips.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
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

                <div className="space-y-4">
                  {sortEventsByStart(dateEvents).map((event) => {
                    const registryItem = EVENT_TYPES[event.type];
                    if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
                    const EventCardComponent = registryItem.cardComponent;
                    const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail;
                    const isDeleting = deletingEvents.has(event.id);
                    const eventAlerts = getEventNotifications(event, notifications);
                    const hasLocationIssue = eventHasLocationAttention(event);
                    const hasFlightStatus = event.type === 'flight' && flightStatusSnapshots.some(status => status.eventId === event.id);

                    const hasLocationSearch = (
                      event.type === 'activity'
                      || event.type === 'stay'
                      || event.type === 'destination'
                      || event.type === 'flight'
                      || event.type === 'train'
                      || event.type === 'bus'
                      || event.type === 'rental_car'
                    );

                    const voteableEvent = event.type === 'activity'
                      || event.type === 'destination'
                      || event.type === 'stay';
                    const activeDecision = trip
                      ? getDecisionForEvent(trip.decisions, event.id)
                      : undefined;
                    const isEventActive = isEventCurrentlyActive(event);
                    const multidayRole = getMultidayEventDayRole(event, dateKey);
                    const showMultidayMiddle = isDayFiltered && multidayRole === 'middle';
                    const showMultidayEnd = isDayFiltered && multidayRole === 'end';
                    const useFullMultidayStartCard = isDayFiltered
                      && (multidayRole === 'start' || multidayRole === 'single');
                    const useCompactMultidayDisplay = showMultidayMiddle || showMultidayEnd;
                    const openEventDetails = canEdit ? () => onEditEvent(event) : undefined;

                    const eventBody = showMultidayMiddle ? (
                      <MultidaySpanChip
                        event={event}
                        viewDateKey={dateKey}
                        onOpen={openEventDetails}
                      />
                    ) : showMultidayEnd ? (
                      <MultidayEndpointCard
                        event={event}
                        role={multidayRole!}
                        viewDateKey={dateKey}
                        thumbnail={thumbnail}
                        onOpen={openEventDetails}
                      />
                    ) : !isCondensedView || useFullMultidayStartCard ? (
                      <div
                        className={cn(
                          'relative',
                          isSelectionMode && isEventSelectionEligible(event) && 'cursor-pointer',
                          isSelectionMode && selectedEventIds.has(event.id) && 'rounded-2xl ring-2 ring-violet-100',
                          isSelectionMode
                            && selectableEventIds.has(event.id)
                            && !isEventSelectionEligible(event)
                            && 'opacity-50',
                        )}
                        onClick={
                          isSelectionMode && isEventSelectionEligible(event)
                            ? () => toggleSelectedEvent(event.id)
                            : undefined
                        }
                      >
                        {isSelectionMode && isEventSelectionEligible(event) && (
                          <div className="absolute left-3 top-3 z-10">
                            <input
                              type="checkbox"
                              checked={selectedEventIds.has(event.id)}
                              onChange={() => toggleSelectedEvent(event.id)}
                              onClick={(eventClick) => eventClick.stopPropagation()}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </div>
                        )}
                        <EventCardComponent
                          event={event}
                          thumbnail={thumbnail}
                          onEdit={canEdit ? () => onEditEvent(event) : undefined}
                          onDelete={canEdit ? () => onDeleteEvent(event.id) : undefined}
                          onStatusChange={canEdit ? (newStatus) => onStatusChange(event, newStatus) : undefined}
                          {...(hasLocationSearch && canEdit && tripId && onLocationApplied ? {
                            tripId,
                            onLocationApplied,
                          } : {})}
                          {...(voteableEvent && trip && onVote ? {
                            trip,
                            currentUserId,
                            onVote,
                            canVote: canEdit,
                          } : {})}
                        />
                      </div>
                    ) : (
                      <CondensedEventCard
                        event={event}
                        thumbnail={thumbnail}
                        trip={trip}
                        currentUserId={currentUserId}
                        onVote={onVote}
                        onEdit={canEdit ? () => onEditEvent(event) : undefined}
                        onReviewLocation={
                          canEdit && onReviewEventLocation
                            ? () => onReviewEventLocation(event)
                            : undefined
                        }
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedEventIds.has(event.id)}
                        isSelectable={isEventSelectionEligible(event)}
                        onToggleSelected={() => toggleSelectedEvent(event.id)}
                        canEdit={canEdit}
                      />
                    );

                    return (
                      <div
                        key={event.id}
                        ref={(element) => {
                          if (element) {
                            eventSectionRefs.current.set(event.id, element);
                          } else {
                            eventSectionRefs.current.delete(event.id);
                          }
                        }}
                        data-timeline-event={event.id}
                        className={cn(
                          'relative transition-all duration-300',
                          isDeleting && 'animate-fade-out opacity-0',
                          selectedEventId === event.id
                            && 'rounded-2xl ring-2 ring-blue-400 ring-offset-2 ring-offset-white',
                        )}
                      >
                        <div className={cn(
                          'absolute -left-[1.45rem] top-6 h-3 w-3 rounded-full',
                          isEventActive
                            ? tripSurfaces.timelineDotActive
                            : isToday
                              ? tripSurfaces.timelineDotToday
                              : tripSurfaces.timelineDot,
                        )} />
                        {eventBody}
                        {!useCompactMultidayDisplay && (eventAlerts.length > 0 || hasLocationIssue || hasFlightStatus || activeDecision) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activeDecision && onOpenDecision && (
                              <ContextChip
                                icon={<Scale className="h-3 w-3" />}
                                className="border-violet-100 bg-violet-50 text-violet-800"
                                onClick={() => onOpenDecision(activeDecision.id)}
                              >
                                In decision: {activeDecision.title}
                              </ContextChip>
                            )}
                            {eventAlerts.length > 0 && (
                              <ContextChip icon={<Bell className="h-3 w-3" />} className="border-amber-100 bg-amber-50 text-amber-800">
                                {eventAlerts.length} alert{eventAlerts.length === 1 ? '' : 's'}
                              </ContextChip>
                            )}
                            {hasLocationIssue && (
                              <ContextChip
                                icon={<MapPin className="h-3 w-3" />}
                                className="border-teal-100 bg-teal-50 text-teal-800"
                                onClick={
                                  canEdit && onReviewEventLocation
                                    ? () => onReviewEventLocation(event)
                                    : undefined
                                }
                              >
                                Review location
                              </ContextChip>
                            )}
                            {hasFlightStatus && (
                              <ContextChip icon={<FaPlane className="h-3 w-3" />} className="border-violet-100 bg-violet-50 text-violet-800">
                                Flight status
                              </ContextChip>
                            )}
                          </div>
                        )}
                        {!useCompactMultidayDisplay && (
                          <>
                            <FlightStatusSummary event={event} flightStatusSnapshots={flightStatusSnapshots} />
                            <EventWeatherForecast event={event} weatherSnapshots={weatherSnapshots} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isSelectionMode && selectedEventIds.size >= 2 && (
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
