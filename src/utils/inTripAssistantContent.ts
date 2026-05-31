import { Event, Trip } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { TripInsight } from '@/types/insightTypes';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';
import { TodayBriefingAction, TripReplanBriefing, TripTodayBriefing } from '@/types/assistantBriefingTypes';
import {
  formatEventDateTime,
  getCurrentEvent,
  getEventBookingReference,
  getEventDisplayName,
  getEventEnd,
  getEventStart,
  getNextEvent,
  sortEventsByStart,
} from '@/utils/eventTime';
import { getGoogleMapsSearchUrl } from '@/utils/eventLocation';
import {
  getDirectionsUrl,
  getTransferSummary,
  TransferSummary,
} from '@/utils/transferAnalysis';

export type InTripAttentionSeverity = 'critical' | 'warning' | 'info';

export type InTripActionTarget = 'event' | 'checklist' | 'directions' | 'none';

export interface InTripHeroAction {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionTarget: InTripActionTarget;
  eventId?: string;
  directionsUrl?: string;
  source: 'ai' | 'computed' | 'on_track' | 'empty';
}

export interface InTripAttentionItem {
  id: string;
  title: string;
  reason: string;
  severity: InTripAttentionSeverity;
  actionLabel?: string;
  actionTarget?: InTripActionTarget;
  eventId?: string;
  directionsUrl?: string;
  dismissible?: boolean;
}

export interface InTripHandyItem {
  id: string;
  label: string;
  value: string;
  copyable?: boolean;
  href?: string;
}

export type InTripHandyEventRole = 'now' | 'next';

export interface InTripHandyGroup {
  eventId: string;
  eventName: string;
  eventRole: InTripHandyEventRole;
  eventTimeLabel?: string;
  items: InTripHandyItem[];
}

export interface InTripTomorrowPreview {
  title: string;
  subtitle: string;
  eventId: string;
}

export interface InTripAssistantContentInput {
  trip: Trip;
  now?: Date;
  insights?: TripInsight[];
  weatherSnapshots?: WeatherSnapshot[];
  flightStatusSnapshots?: FlightStatusSnapshot[];
  todayBriefing?: TripTodayBriefing | null;
}

export interface InTripAssistantContent {
  hero: InTripHeroAction;
  attentionItems: InTripAttentionItem[];
  handyGroups: InTripHandyGroup[];
  tomorrowPreview: InTripTomorrowPreview | null;
}

const SEVERITY_RANK: Record<InTripAttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const OUTDOOR_EVENT_TYPES = new Set<Event['type']>(['activity', 'destination']);

const isSameLocalDay = (a: Date, b: Date) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

const getTodaysEvents = (events: Event[], now: Date) => (
  sortEventsByStart(events).filter((event) => {
    const start = getEventStart(event);
    return start ? isSameLocalDay(start, now) : false;
  })
);

const getTomorrowsEvents = (events: Event[], now: Date) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return sortEventsByStart(events).filter((event) => {
    const start = getEventStart(event);
    return start ? isSameLocalDay(start, tomorrow) : false;
  });
};

const minutesUntil = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60_000);

const formatTime = (date: Date) => date.toLocaleTimeString(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const isWeatherActionable = (forecast: WeatherDay, event: Event) => {
  const condition = forecast.condition?.toLowerCase() ?? '';
  const hasRainSignal = (forecast.precipitationProbabilityMax ?? 0) >= 50
    || /rain|storm|snow|thunder|shower|drizzle/.test(condition);
  const hasWindSignal = (forecast.windSpeedMax ?? 0) >= 20;
  const isOutdoor = OUTDOOR_EVENT_TYPES.has(event.type);

  if (isOutdoor && hasRainSignal) return true;
  if (isOutdoor && hasWindSignal) return true;
  if ((forecast.temperatureMax ?? 100) >= 95 && isOutdoor) return true;
  if ((forecast.temperatureMin ?? 32) <= 32 && isOutdoor) return true;
  return false;
};

const formatWeatherReason = (forecast: WeatherDay) => {
  const parts = [
    forecast.condition,
    typeof forecast.precipitationProbabilityMax === 'number' && forecast.precipitationProbabilityMax >= 50
      ? `${forecast.precipitationProbabilityMax}% chance of precipitation`
      : null,
    typeof forecast.windSpeedMax === 'number' && forecast.windSpeedMax >= 20
      ? `${Math.round(forecast.windSpeedMax)} mph wind`
      : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Weather may affect outdoor plans';
};

const getEventWeatherSnapshot = (
  eventId: string,
  weatherSnapshots: WeatherSnapshot[],
) => weatherSnapshots.find((snapshot) => (
  (snapshot.originalEventId || snapshot.eventId) === eventId && snapshot.daily?.[0]
));

const getEventFlightSnapshot = (
  eventId: string,
  flightStatusSnapshots: FlightStatusSnapshot[],
) => flightStatusSnapshots.find((snapshot) => snapshot.eventId === eventId);

const isFlightAnomaly = (snapshot: FlightStatusSnapshot) => {
  const status = snapshot.status?.toLowerCase() ?? '';
  const departureDelay = snapshot.departure?.delayMinutes ?? 0;
  const arrivalDelay = snapshot.arrival?.delayMinutes ?? 0;
  return departureDelay >= 15
    || arrivalDelay >= 15
    || /cancel|delay|divert|incident/.test(status);
};

const formatFlightAnomalyReason = (snapshot: FlightStatusSnapshot) => {
  const parts = [
    snapshot.status,
    snapshot.departure?.delayMinutes ? `${snapshot.departure.delayMinutes} min departure delay` : null,
    snapshot.arrival?.delayMinutes ? `${snapshot.arrival.delayMinutes} min arrival delay` : null,
    snapshot.departure?.gate ? `Gate ${snapshot.departure.gate}` : null,
    snapshot.departure?.terminal ? `Terminal ${snapshot.departure.terminal}` : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'Flight status changed';
};

const buildTransferAttentionItem = (transfer: TransferSummary): InTripAttentionItem | null => {
  if (transfer.severity === 'ok' || transfer.flexibleDeparture) return null;

  const severity: InTripAttentionSeverity = transfer.severity === 'tight' ? 'critical' : 'warning';
  const title = transfer.severity === 'tight'
    ? `Tight transfer before ${getEventDisplayName(transfer.to)}`
    : `Long transfer before ${getEventDisplayName(transfer.to)}`;

  return {
    id: `transfer-${transfer.from.id}-${transfer.to.id}`,
    title,
    reason: `${transfer.gapMinutes} min available, about ${transfer.estimatedTravelMinutes} min estimated (${transfer.distanceMiles} mi).`,
    severity,
    actionLabel: 'Directions',
    actionTarget: 'directions',
    directionsUrl: getDirectionsUrl(transfer.fromPoint, transfer.toPoint),
    eventId: transfer.to.id,
  };
};

const computeLeaveByHero = (
  transfer: TransferSummary,
  now: Date,
): InTripHeroAction | null => {
  const toStart = getEventStart(transfer.to);
  if (!toStart) return null;

  const leaveBy = new Date(toStart.getTime() - transfer.estimatedTravelMinutes * 60_000);
  const minutesToLeave = minutesUntil(now, leaveBy);

  if (minutesToLeave > 90) return null;

  const title = minutesToLeave <= 0
    ? `Leave now for ${getEventDisplayName(transfer.to)}`
    : `Leave by ${formatTime(leaveBy)}`;

  return {
    title,
    subtitle: `${transfer.estimatedTravelMinutes} min drive · ${transfer.gapMinutes} min until start`,
    actionLabel: 'Directions',
    actionTarget: 'directions',
    directionsUrl: getDirectionsUrl(transfer.fromPoint, transfer.toPoint),
    eventId: transfer.to.id,
    source: 'computed',
  };
};

const heroFromAiAction = (action: TodayBriefingAction): InTripHeroAction => ({
  title: action.title,
  subtitle: action.reason,
  actionLabel: action.actionLabel,
  actionTarget: action.actionTarget === 'checklist'
    ? 'checklist'
    : action.eventId
      ? 'event'
      : 'none',
  eventId: action.eventId,
  source: 'ai',
});

const buildHandyGroups = (
  focusEvents: Array<{ event: Event; role: InTripHandyEventRole }>,
  flightStatusSnapshots: FlightStatusSnapshot[],
): InTripHandyGroup[] => {
  const groups: InTripHandyGroup[] = [];

  for (const { event, role } of focusEvents) {
    const items: InTripHandyItem[] = [];
    const bookingReference = getEventBookingReference(event);
    if (bookingReference) {
      items.push({
        id: `booking-${event.id}`,
        label: 'Confirmation',
        value: bookingReference,
        copyable: true,
      });
    }

    if (event.type === 'flight') {
      const snapshot = getEventFlightSnapshot(event.id, flightStatusSnapshots);
      if (snapshot?.departure?.gate) {
        items.push({
          id: `gate-${event.id}`,
          label: 'Gate',
          value: snapshot.departure.gate,
        });
      }
      if (snapshot?.departure?.terminal) {
        items.push({
          id: `terminal-${event.id}`,
          label: 'Terminal',
          value: snapshot.departure.terminal,
        });
      }
    }

    const mapsUrl = getGoogleMapsSearchUrl(event);
    if (mapsUrl) {
      items.push({
        id: `maps-${event.id}`,
        label: 'Directions',
        value: getEventDisplayName(event),
        href: mapsUrl,
      });
    }

    if (items.length === 0) continue;

    const start = getEventStart(event);
    groups.push({
      eventId: event.id,
      eventName: getEventDisplayName(event),
      eventRole: role,
      eventTimeLabel: start ? formatEventDateTime(start) : undefined,
      items,
    });
  }

  return groups;
};

const isTodayRelevantInsight = (insight: TripInsight, todaysEventIds: Set<string>) => {
  if (insight.severity === 'info' && insight.type !== 'reminder') return false;
  if (insight.source.kind === 'event' && insight.source.id) {
    return todaysEventIds.has(insight.source.id);
  }
  return insight.severity === 'critical';
};

const shouldShowTomorrowPreview = (events: Event[], now: Date) => {
  const todaysEvents = getTodaysEvents(events, now);
  if (todaysEvents.length === 0) return true;

  const lastToday = todaysEvents[todaysEvents.length - 1];
  const lastEnd = getEventEnd(lastToday) ?? getEventStart(lastToday);
  if (lastEnd && now >= lastEnd) return true;

  const hour = now.getHours();
  return hour >= 18;
};

export const buildInTripAssistantContent = ({
  trip,
  now = new Date(),
  insights = [],
  weatherSnapshots = [],
  flightStatusSnapshots = [],
  todayBriefing,
}: InTripAssistantContentInput): InTripAssistantContent => {
  const events = trip.events ?? [];
  const currentEvent = getCurrentEvent(events, now);
  const nextEvent = getNextEvent(events, now);
  const todaysEvents = getTodaysEvents(events, now);
  const todaysEventIds = new Set(todaysEvents.map((event) => event.id));

  const focusEvents = [currentEvent, nextEvent].filter((event): event is Event => Boolean(event));
  const focusEventIds = new Set(focusEvents.map((event) => event.id));
  const focusEventEntries: Array<{ event: Event; role: InTripHandyEventRole }> = [];
  if (currentEvent) {
    focusEventEntries.push({ event: currentEvent, role: 'now' });
  }
  if (nextEvent && nextEvent.id !== currentEvent?.id) {
    focusEventEntries.push({ event: nextEvent, role: 'next' });
  }

  let hero: InTripHeroAction | null = null;

  if (todayBriefing?.nextAction) {
    hero = heroFromAiAction(todayBriefing.nextAction);
  }

  if (!hero && nextEvent) {
    const nextIndex = todaysEvents.findIndex((event) => event.id === nextEvent.id);
    if (nextIndex > 0) {
      const transfer = getTransferSummary(
        todaysEvents[nextIndex - 1],
        nextEvent,
        weatherSnapshots,
      );
      if (transfer && transfer.severity === 'tight') {
        hero = computeLeaveByHero(transfer, now);
      }
    }
  }

  if (!hero && nextEvent) {
    const start = getEventStart(nextEvent);
    if (start) {
      const untilStart = minutesUntil(now, start);
      if (untilStart <= 120) {
        hero = {
          title: `Next: ${getEventDisplayName(nextEvent)}`,
          subtitle: untilStart <= 0
            ? 'Should be underway now'
            : `Starts ${formatEventDateTime(start)}`,
          actionLabel: 'View details',
          actionTarget: 'event',
          eventId: nextEvent.id,
          source: 'computed',
        };
      }
    }
  }

  if (!hero && currentEvent) {
    const end = getEventEnd(currentEvent);
    hero = {
      title: `Now: ${getEventDisplayName(currentEvent)}`,
      subtitle: end ? `Until ${formatTime(end)}` : undefined,
      actionLabel: 'View details',
      actionTarget: 'event',
      eventId: currentEvent.id,
      source: 'computed',
    };
  }

  if (!hero) {
    hero = todaysEvents.length > 0
      ? {
          title: "You're on track",
          subtitle: 'No urgent actions right now',
          actionTarget: 'none',
          source: 'on_track',
        }
      : {
          title: 'Nothing scheduled today',
          subtitle: 'Add events or check another day on the timeline',
          actionTarget: 'none',
          source: 'empty',
        };
  }

  const attentionItems: InTripAttentionItem[] = [];

  for (let index = 1; index < todaysEvents.length; index += 1) {
    const transfer = getTransferSummary(
      todaysEvents[index - 1],
      todaysEvents[index],
      weatherSnapshots,
    );
    const item = transfer ? buildTransferAttentionItem(transfer) : null;
    if (item) attentionItems.push(item);
  }

  for (const event of focusEvents) {
    const snapshot = getEventFlightSnapshot(event.id, flightStatusSnapshots);
    if (snapshot && isFlightAnomaly(snapshot)) {
      attentionItems.push({
        id: `flight-${event.id}`,
        title: `${getEventDisplayName(event)} update`,
        reason: formatFlightAnomalyReason(snapshot),
        severity: (snapshot.departure?.delayMinutes ?? 0) >= 30 ? 'critical' : 'warning',
        actionLabel: 'View flight',
        actionTarget: 'event',
        eventId: event.id,
      });
    }

    const weatherSnapshot = getEventWeatherSnapshot(event.id, weatherSnapshots);
    const forecast = weatherSnapshot?.daily?.[0];
    if (forecast && isWeatherActionable(forecast, event)) {
      attentionItems.push({
        id: `weather-${event.id}`,
        title: `Weather for ${getEventDisplayName(event)}`,
        reason: formatWeatherReason(forecast),
        severity: (forecast.precipitationProbabilityMax ?? 0) >= 70 ? 'warning' : 'info',
        actionLabel: 'View event',
        actionTarget: 'event',
        eventId: event.id,
      });
    }
  }

  for (const insight of insights) {
    if (!isTodayRelevantInsight(insight, todaysEventIds)) continue;
    if (insight.actionTarget === 'event' && insight.source.id && focusEventIds.has(insight.source.id)) {
      continue;
    }

    attentionItems.push({
      id: insight.id,
      title: insight.title,
      reason: insight.message,
      severity: insight.severity,
      actionLabel: insight.actionTarget === 'event' ? insight.actionLabel : undefined,
      actionTarget: insight.actionTarget === 'event' ? 'event' : undefined,
      eventId: insight.source.id,
      dismissible: insight.dismissible,
    });
  }

  const dedupedAttention = attentionItems
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 3);

  const handyGroups = buildHandyGroups(focusEventEntries, flightStatusSnapshots);

  let tomorrowPreview: InTripTomorrowPreview | null = null;
  if (shouldShowTomorrowPreview(events, now)) {
    const tomorrowEvents = getTomorrowsEvents(events, now);
    const firstTomorrow = tomorrowEvents[0];
    if (firstTomorrow) {
      const start = getEventStart(firstTomorrow);
      tomorrowPreview = {
        title: getEventDisplayName(firstTomorrow),
        subtitle: start ? formatEventDateTime(start) : 'Time TBD',
        eventId: firstTomorrow.id,
      };
    }
  }

  return {
    hero,
    attentionItems: dedupedAttention,
    handyGroups,
    tomorrowPreview,
  };
};

export const hasReplanBriefingContent = (briefing?: TripReplanBriefing | null) => (
  Boolean(
    briefing?.summary
    || (briefing?.suggestions?.length ?? 0) > 0
    || (briefing?.fallbackIdeas?.length ?? 0) > 0
    || (briefing?.suggestedChecklistItems?.length ?? 0) > 0,
  )
);

export const hasTodayBriefingContent = (briefing?: TripTodayBriefing | null) => (
  Boolean(
    briefing?.summary
    || briefing?.nextAction
    || (briefing?.watchItems?.length ?? 0) > 0
    || briefing?.collaboratorMessage,
  )
);
