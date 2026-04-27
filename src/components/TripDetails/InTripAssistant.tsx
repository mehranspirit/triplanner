import React from 'react';
import { AlertCircle, CalendarDays, CheckSquare, Clock, CloudSun, Copy, ExternalLink, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event, Trip } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  formatEventDateTime,
  getCurrentEvent,
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventLocationLabel,
  getEventStart,
  getNextEvent,
  sortEventsByStart,
} from '@/utils/eventTime';
import { cn } from '@/lib/utils';
import { getTripStatusSummary } from '@/services/tripStatus';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';

interface InTripAssistantProps {
  trip: Trip;
  insights: TripInsight[];
  canEdit: boolean;
  weatherSnapshots?: WeatherSnapshot[];
  flightStatusSnapshots?: FlightStatusSnapshot[];
  onClose: () => void;
  onOpenChecklist: () => void;
  onEditEvent: (event: Event) => void;
}

const isSameLocalDay = (a: Date, b: Date) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const getMapsUrl = (location: string) => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
};

const getDirectionsUrl = (from: RoutePoint, to: RoutePoint) => {
  const origin = `${from.lat},${from.lng}`;
  const destination = `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
};

interface RoutePoint {
  lat: number;
  lng: number;
}

interface TransferSummary {
  from: Event;
  to: Event;
  fromPoint: RoutePoint;
  toPoint: RoutePoint;
  gapMinutes: number;
  estimatedTravelMinutes: number;
  distanceMiles: number;
  severity: 'ok' | 'tight' | 'long';
}

const copyText = async (text: string) => {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
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

const getSnapshotLabel = (snapshot: WeatherSnapshot) => {
  if (snapshot.locationRole === 'departure') return 'Departure weather';
  if (snapshot.locationRole === 'arrival') return 'Arrival weather';
  return 'Weather forecast';
};

const EventWeatherRows: React.FC<{ snapshots: WeatherSnapshot[] }> = ({ snapshots }) => {
  const visibleSnapshots = snapshots.filter(snapshot => snapshot.daily?.[0]);
  if (visibleSnapshots.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 rounded-md border border-sky-100 bg-sky-50 px-2 py-2 text-xs text-sky-900">
      {visibleSnapshots.map((snapshot) => (
        <div key={snapshot._id || `${snapshot.eventId}-${snapshot.date}`} className="flex items-center gap-2">
          <CloudSun className="h-3.5 w-3.5 flex-shrink-0 text-sky-600" />
          <span>
            <span className="font-medium">{getSnapshotLabel(snapshot)}:</span> {formatWeatherForecast(snapshot.daily[0])}
          </span>
        </div>
      ))}
    </div>
  );
};

const FlightStatusRows: React.FC<{ snapshots: FlightStatusSnapshot[] }> = ({ snapshots }) => {
  if (snapshots.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 rounded-md border border-violet-100 bg-violet-50 px-2 py-2 text-xs text-violet-900">
      {snapshots.map((snapshot) => {
        const departureParts = [
          snapshot.departure?.terminal ? `Terminal ${snapshot.departure.terminal}` : null,
          snapshot.departure?.gate ? `Gate ${snapshot.departure.gate}` : null,
          typeof snapshot.departure?.delayMinutes === 'number' && snapshot.departure.delayMinutes > 0
            ? `${snapshot.departure.delayMinutes} min departure delay`
            : null,
        ].filter(Boolean);
        const arrivalDelay = typeof snapshot.arrival?.delayMinutes === 'number' && snapshot.arrival.delayMinutes > 0
          ? `${snapshot.arrival.delayMinutes} min arrival delay`
          : null;
        const details = [snapshot.status, ...departureParts, arrivalDelay].filter(Boolean).join(' | ');

        return (
          <div key={snapshot._id || `${snapshot.eventId}-${snapshot.dateLocal}`} className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />
            <span>
              <span className="font-medium">Flight status:</span> {details || 'No status details available yet'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const getUsableEventLocation = (event: Event): RoutePoint | null => {
  if (
    !event.location ||
    !event.location.lat ||
    !event.location.lng ||
    event.location.lat === 0 ||
    event.location.lng === 0
  ) {
    return null;
  }

  return { lat: event.location.lat, lng: event.location.lng };
};

const getFlightEndpointPoint = (
  event: Event,
  role: 'departure' | 'arrival',
  weatherSnapshots: WeatherSnapshot[]
): RoutePoint | null => {
  if (event.type !== 'flight') return null;

  const snapshot = weatherSnapshots.find((item) => (
    (item.originalEventId || item.eventId) === event.id &&
    item.locationRole === role &&
    item.lat &&
    item.lng
  ));

  return snapshot ? { lat: snapshot.lat, lng: snapshot.lng } : null;
};

const getRoutePoint = (
  event: Event,
  side: 'from' | 'to',
  weatherSnapshots: WeatherSnapshot[]
): RoutePoint | null => {
  if (event.type === 'flight') {
    return getFlightEndpointPoint(event, side === 'from' ? 'arrival' : 'departure', weatherSnapshots);
  }

  return getUsableEventLocation(event);
};

const getDistanceKm = (from: RoutePoint, to: RoutePoint) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateTravelMinutes = (distanceKm: number) => {
  return Math.ceil((distanceKm / 40) * 60 + 15);
};

const getTransferSummary = (
  from: Event,
  to: Event,
  weatherSnapshots: WeatherSnapshot[]
): TransferSummary | null => {
  const fromEnd = getEventEnd(from);
  const toStart = getEventStart(to);
  if (!fromEnd || !toStart) return null;

  const gapMinutes = Math.round((toStart.getTime() - fromEnd.getTime()) / (60 * 1000));
  if (gapMinutes < 0) return null;

  const fromPoint = getRoutePoint(from, 'from', weatherSnapshots);
  const toPoint = getRoutePoint(to, 'to', weatherSnapshots);
  if (!fromPoint || !toPoint) return null;

  const distanceKm = getDistanceKm(fromPoint, toPoint);
  if (distanceKm < 2) return null;

  const estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
  const severity = gapMinutes < estimatedTravelMinutes
    ? 'tight'
    : distanceKm >= 50 && gapMinutes < estimatedTravelMinutes + 45
      ? 'long'
      : 'ok';

  return {
    from,
    to,
    fromPoint,
    toPoint,
    gapMinutes,
    estimatedTravelMinutes,
    distanceMiles: Math.round(distanceKm * 0.621371),
    severity,
  };
};

const TransferRow: React.FC<{ transfer: TransferSummary; onEditEvent: (event: Event) => void }> = ({
  transfer,
  onEditEvent,
}) => {
  return (
    <div className={cn(
      'rounded-lg border px-3 py-2 text-xs',
      transfer.severity === 'tight' && 'border-red-200 bg-red-50 text-red-900',
      transfer.severity === 'long' && 'border-amber-200 bg-amber-50 text-amber-900',
      transfer.severity === 'ok' && 'border-gray-200 bg-gray-50 text-gray-700'
    )}>
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            Transfer buffer: {transfer.gapMinutes} min available, about {transfer.estimatedTravelMinutes} min estimated
          </p>
          <p className="mt-0.5 opacity-90">
            Roughly {transfer.distanceMiles} miles from {getEventDisplayName(transfer.from)} to {getEventDisplayName(transfer.to)}.
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={getDirectionsUrl(transfer.fromPoint, transfer.toPoint)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-current/20 px-2 py-1 font-medium hover:bg-white/60"
        >
          Directions
        </a>
        {transfer.severity !== 'ok' && (
          <button
            type="button"
            onClick={() => onEditEvent(transfer.to)}
            className="rounded-md border border-current/20 px-2 py-1 font-medium hover:bg-white/60"
          >
            Edit next event
          </button>
        )}
      </div>
    </div>
  );
};

const EventCard: React.FC<{
  label: string;
  event: Event | null;
  canEdit: boolean;
  weatherSnapshots: WeatherSnapshot[];
  flightStatusSnapshots: FlightStatusSnapshot[];
  onEditEvent: (event: Event) => void;
}> = ({ label, event, canEdit, weatherSnapshots, flightStatusSnapshots, onEditEvent }) => {
  if (!event) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-sm text-gray-500">Nothing scheduled.</p>
      </div>
    );
  }

  const start = getEventStart(event);
  const location = getEventLocationLabel(event);
  const bookingReference = getEventBookingReference(event);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 font-semibold text-gray-900">{getEventDisplayName(event)}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEditEvent(event)}>
            Edit
          </Button>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{formatEventDateTime(start)}</span>
        </div>
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <a
              href={getMapsUrl(location)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-blue-700 hover:underline"
            >
              {location}
            </a>
          </div>
        )}
        {bookingReference && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1">
            <span className="truncate">Confirmation: {bookingReference}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(bookingReference)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <FlightStatusRows snapshots={flightStatusSnapshots} />
        <EventWeatherRows snapshots={weatherSnapshots} />
      </div>
    </div>
  );
};

const InTripAssistant: React.FC<InTripAssistantProps> = ({
  trip,
  insights,
  canEdit,
  weatherSnapshots = [],
  flightStatusSnapshots = [],
  onClose,
  onOpenChecklist,
  onEditEvent,
}) => {
  const now = new Date();
  const currentEvent = getCurrentEvent(trip.events, now);
  const nextEvent = getNextEvent(trip.events, now);
  const tripStatus = getTripStatusSummary(trip, now);
  const todaysEvents = sortEventsByStart(trip.events || []).filter((event) => {
    const start = getEventStart(event);
    return start ? isSameLocalDay(start, now) : false;
  });
  const getEventWeatherSnapshots = (eventId: string) => weatherSnapshots.filter(snapshot => (
    (snapshot.originalEventId || snapshot.eventId) === eventId && snapshot.daily?.length > 0
  ));
  const getEventFlightStatusSnapshots = (eventId: string) => flightStatusSnapshots.filter(snapshot => (
    snapshot.eventId === eventId
  ));
  const weatherBriefingEventIds = Array.from(new Set([
    currentEvent?.id,
    nextEvent?.id,
    ...todaysEvents.map(event => event.id),
  ].filter((id): id is string => Boolean(id))));
  const weatherBriefingSnapshots = weatherBriefingEventIds.flatMap(getEventWeatherSnapshots);
  const flightBriefingSnapshots = weatherBriefingEventIds.flatMap(getEventFlightStatusSnapshots);
  const priorityInsights = [...insights]
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 3);

  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div className="flex items-start justify-between border-b border-gray-200 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <CalendarDays className="h-4 w-4" />
            Today
          </div>
          <h2 className="mt-1 text-lg font-semibold">In-trip assistant</h2>
          <p className="mt-1 text-sm text-gray-600">Critical details for what is happening now and next.</p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Close Today">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className={cn(
          'rounded-lg border p-3 text-sm',
          tripStatus.status === 'active' && 'border-green-200 bg-green-50 text-green-900',
          tripStatus.status === 'upcoming' && 'border-blue-200 bg-blue-50 text-blue-900',
          tripStatus.status === 'completed' && 'border-gray-200 bg-gray-50 text-gray-800',
          tripStatus.status === 'unscheduled' && 'border-amber-200 bg-amber-50 text-amber-900'
        )}>
          <p className="font-semibold">{tripStatus.label}</p>
          <p className="mt-1 opacity-90">{tripStatus.description}</p>
        </div>

        <div className="grid gap-3">
          <EventCard
            label="Now"
            event={currentEvent}
            canEdit={canEdit}
            weatherSnapshots={currentEvent ? getEventWeatherSnapshots(currentEvent.id) : []}
            flightStatusSnapshots={currentEvent ? getEventFlightStatusSnapshots(currentEvent.id) : []}
            onEditEvent={onEditEvent}
          />
          <EventCard
            label="Next"
            event={nextEvent}
            canEdit={canEdit}
            weatherSnapshots={nextEvent ? getEventWeatherSnapshots(nextEvent.id) : []}
            flightStatusSnapshots={nextEvent ? getEventFlightStatusSnapshots(nextEvent.id) : []}
            onEditEvent={onEditEvent}
          />
        </div>

        {flightBriefingSnapshots.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Flight briefing</h3>
            <FlightStatusRows snapshots={flightBriefingSnapshots.slice(0, 4)} />
          </section>
        )}

        {weatherBriefingSnapshots.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Weather briefing</h3>
            <EventWeatherRows snapshots={weatherBriefingSnapshots.slice(0, 4)} />
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Need before you go</h3>
            <Button variant="outline" size="sm" onClick={onOpenChecklist}>
              <CheckSquare className="mr-1 h-4 w-4" />
              Checklist
            </Button>
          </div>
          {priorityInsights.length > 0 ? (
            <div className="space-y-2">
              {priorityInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    'rounded-lg border p-3 text-sm',
                    insight.severity === 'critical' && 'border-red-200 bg-red-50 text-red-900',
                    insight.severity === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
                    insight.severity === 'info' && 'border-blue-200 bg-blue-50 text-blue-900'
                  )}
                >
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{insight.title}</p>
                      <p className="mt-1 opacity-90">{insight.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              No urgent itinerary issues found.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Today&apos;s timeline</h3>
          {todaysEvents.length > 0 ? (
            <div className="space-y-2">
              {todaysEvents.map((event, index) => {
                const location = getEventLocationLabel(event);
                const transfer = index > 0
                  ? getTransferSummary(todaysEvents[index - 1], event, weatherSnapshots)
                  : null;
                return (
                  <React.Fragment key={event.id}>
                    {transfer && (
                      <TransferRow transfer={transfer} onEditEvent={onEditEvent} />
                    )}
                    <div className="rounded-lg border border-gray-200 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{getEventDisplayName(event)}</p>
                          <p className="mt-1 text-gray-600">{formatEventDateTime(getEventStart(event))}</p>
                          {location && <p className="mt-1 truncate text-gray-500">{location}</p>}
                          <FlightStatusRows snapshots={getEventFlightStatusSnapshots(event.id)} />
                          <EventWeatherRows snapshots={getEventWeatherSnapshots(event.id)} />
                        </div>
                        {location && (
                          <a
                            href={getMapsUrl(location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-blue-700 hover:bg-blue-50"
                            aria-label={`Open map for ${getEventDisplayName(event)}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              No events scheduled for today.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default InTripAssistant;
