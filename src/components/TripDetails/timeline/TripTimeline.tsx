import React from 'react';
import { format } from 'date-fns';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import { Bell, CalendarPlus, CloudSun, Info, MapPin } from 'lucide-react';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { Event } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripNotification } from '@/types/notificationTypes';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';
import { cn } from '@/lib/utils';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { eventHasLocationAttention } from '@/utils/eventLocation';
import { isEventCurrentlyActive } from '@/utils/eventGlow';

interface TripTimelineProps {
  events: Event[];
  tripId?: string;
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
  onLocationApplied?: (events: Event[]) => void;
  onReviewEventLocation?: (event: Event) => void;
  onAddEvent?: () => void;
}

const getTimelineDateKey = (event: Event) => {
  const start = getEventStart(event);
  if (!start) return '';
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
};

const formatTimelineDate = (dateKey: string) => {
  try {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    if (Number.isNaN(date.getTime())) return { weekday: dateKey, date: '' };
    return {
      weekday: format(date, 'EEEE'),
      date: format(date, 'MMMM d, yyyy'),
    };
  } catch {
    return { weekday: dateKey, date: '' };
  }
};

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

const getDateFromKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

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

const CondensedEventCard = ({ event, thumbnail }: { event: Event; thumbnail: string }) => {
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event);
  const start = getEventStart(event);

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md',
        isExploring && 'border-amber-200 bg-amber-50/80',
        isActive && !isExploring && 'border-blue-200 bg-blue-50/60 shadow-blue-100'
      )}
    >
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
          {isExploring && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Exploring
            </span>
          )}
          {isActive && !isExploring && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              Now
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {start && <span>{format(start, 'MMM d, h:mm a')}</span>}
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
    </div>
  );
};

const TripTimeline: React.FC<TripTimelineProps> = ({
  events,
  tripId,
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
  onLocationApplied,
  onReviewEventLocation,
  onAddEvent,
}) => {
  const sortedEvents = sortEventsByStart(events);
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
  const groupedEvents = sortedEvents.reduce((groups, event) => {
    const dateKey = getTimelineDateKey(event);
    if (!dateKey) return groups;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
    return groups;
  }, {} as Record<string, Event[]>);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100 md:rounded-[2rem] md:p-6 md:shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-blue-700 sm:block">Main itinerary</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">Timeline</h2>
        </div>
        <p className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 md:px-3 md:py-1 md:text-sm">
          {sortedEvents.length} event{sortedEvents.length === 1 ? '' : 's'}
        </p>
      </div>

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
      ) : (
        <div className="space-y-6 md:space-y-8">
          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => {
            const dateParts = formatTimelineDate(dateKey);
            const hasActiveEvent = dateEvents.some(event => isEventCurrentlyActive(event));
            const dayAlertCount = getDayNotificationCount(dateKey, notifications);
            const dayWeatherSummary = getDayWeatherSummary(dateKey, weatherSnapshots);

            return (
              <div key={dateKey} className="relative pl-7">
                <div className="absolute bottom-0 left-3 top-12 w-px bg-gradient-to-b from-blue-200 via-slate-200 to-transparent" />
                <div className="sticky top-14 z-30 mb-3 -ml-7 bg-white/90 py-1.5 backdrop-blur md:top-20 md:mb-4 md:py-2">
                  <div className={cn(
                    'inline-flex items-center gap-3 rounded-2xl border px-4 py-2 shadow-sm',
                    hasActiveEvent
                      ? 'border-blue-200 bg-blue-50 text-blue-950'
                      : 'border-slate-200 bg-slate-50 text-slate-950'
                  )}>
                    <span className={cn(
                      'h-3 w-3 rounded-full',
                      hasActiveEvent ? 'animate-pulse bg-blue-500' : 'bg-slate-300'
                    )} />
                    <div>
                      <p className="text-sm font-bold">{dateParts.weekday}</p>
                      {dateParts.date && <p className="text-xs text-slate-500">{dateParts.date}</p>}
                    </div>
                    {hasActiveEvent && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                        Today
                      </span>
                    )}
                  </div>
                  {(dayWeatherSummary || dayAlertCount > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
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

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'relative transition-all duration-300',
                          isDeleting && 'animate-fade-out opacity-0'
                        )}
                      >
                        <div className="absolute -left-[1.45rem] top-6 h-3 w-3 rounded-full border-2 border-white bg-slate-300 shadow ring-2 ring-slate-100" />
                        {isCondensedView ? (
                          <CondensedEventCard event={event} thumbnail={thumbnail} />
                        ) : (
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
                          />
                        )}
                        {(eventAlerts.length > 0 || hasLocationIssue || hasFlightStatus) && (
                          <div className="mt-2 flex flex-wrap gap-2">
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
                        <FlightStatusSummary event={event} flightStatusSnapshots={flightStatusSnapshots} />
                        <EventWeatherForecast event={event} weatherSnapshots={weatherSnapshots} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TripTimeline;
