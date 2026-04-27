import React from 'react';
import { AlertCircle, CalendarDays, CheckSquare, Clock, Copy, ExternalLink, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event, Trip } from '@/types/eventTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  formatEventDateTime,
  getCurrentEvent,
  getEventBookingReference,
  getEventDisplayName,
  getEventLocationLabel,
  getEventStart,
  getNextEvent,
  sortEventsByStart,
} from '@/utils/eventTime';
import { cn } from '@/lib/utils';
import { getTripStatusSummary } from '@/services/tripStatus';

interface InTripAssistantProps {
  trip: Trip;
  insights: TripInsight[];
  canEdit: boolean;
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

const copyText = async (text: string) => {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
};

const EventCard: React.FC<{
  label: string;
  event: Event | null;
  canEdit: boolean;
  onEditEvent: (event: Event) => void;
}> = ({ label, event, canEdit, onEditEvent }) => {
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
      </div>
    </div>
  );
};

const InTripAssistant: React.FC<InTripAssistantProps> = ({
  trip,
  insights,
  canEdit,
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
          <EventCard label="Now" event={currentEvent} canEdit={canEdit} onEditEvent={onEditEvent} />
          <EventCard label="Next" event={nextEvent} canEdit={canEdit} onEditEvent={onEditEvent} />
        </div>

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
              {todaysEvents.map((event) => {
                const location = getEventLocationLabel(event);
                return (
                  <div key={event.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{getEventDisplayName(event)}</p>
                        <p className="mt-1 text-gray-600">{formatEventDateTime(getEventStart(event))}</p>
                        {location && <p className="mt-1 truncate text-gray-500">{location}</p>}
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
