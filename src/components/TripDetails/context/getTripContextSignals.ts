import { Trip } from '@/types/eventTypes';
import { eventHasLocationAttention } from '@/utils/eventLocation';
import { getMissingLocationInsightId } from '@/services/tripInsights';
import { TripInsight } from '@/types/insightTypes';
import { TripNotification } from '@/types/notificationTypes';
import { TravelImport } from '@/types/travelImportTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { ProactiveContextCard, TripContextSignals, TripPhase, ProactiveContextCardType } from './tripContextTypes';

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getTripPhase = (trip: Trip, now: Date): TripPhase => {
  if (!trip.startDate || !trip.endDate) return 'unscheduled';

  const start = startOfDay(new Date(trip.startDate));
  const end = endOfDay(new Date(trip.endDate));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'unscheduled';
  if (now < start) return 'before';
  if (now > end) return 'after';
  return 'during';
};

const isSameDay = (left: Date, right: Date) => (
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()
);

const getLocationIssueCount = (trip: Trip, dismissedInsightIds: string[] = []) => (
  trip.events.filter(event => (
    eventHasLocationAttention(event) &&
    !dismissedInsightIds.includes(getMissingLocationInsightId(event.id))
  )).length
);

const getPendingImportCount = (travelImports: TravelImport[]) => (
  travelImports.filter(travelImport => (
    ['needs_review', 'missing_info', 'duplicate', 'parsed'].includes(travelImport.status)
  )).length
);

const getTravelStatusCount = (
  flightStatusSnapshots: FlightStatusSnapshot[],
  weatherSnapshots: WeatherSnapshot[]
) => (
  flightStatusSnapshots.length +
  weatherSnapshots.filter(snapshot => snapshot.daily?.length > 0).length
);

const getPhaseWeight = (phase: TripPhase, type: ProactiveContextCard['type']) => {
  const weights: Record<TripPhase, Partial<Record<ProactiveContextCard['type'], number>>> = {
    before: {
      pending_imports: -30,
      location_issues: -25,
      next_up: -10,
    },
    during: {
      travel_day: -40,
      alerts: -35,
      travel_status: -25,
      next_up: -20,
    },
    after: {
      alerts: -20,
      urgent_insights: -15,
    },
    unscheduled: {
      location_issues: -15,
      pending_imports: -10,
    },
  };

  return weights[phase][type] || 0;
};

export const getTripContextSignals = ({
  trip,
  notifications,
  travelImports,
  insights,
  weatherSnapshots,
  flightStatusSnapshots,
  dismissedInsightIds = [],
  dismissedContextCardTypes = [],
  now = new Date(),
}: {
  trip: Trip;
  notifications: TripNotification[];
  travelImports: TravelImport[];
  insights: TripInsight[];
  weatherSnapshots: WeatherSnapshot[];
  flightStatusSnapshots: FlightStatusSnapshot[];
  dismissedInsightIds?: string[];
  dismissedContextCardTypes?: ProactiveContextCardType[];
  now?: Date;
}): TripContextSignals => {
  const phase = getTripPhase(trip, now);
  const sortedEvents = sortEventsByStart(trip.events);
  const todayEvents = sortedEvents.filter((event) => {
    const start = getEventStart(event);
    return !!start && isSameDay(start, now);
  });
  const nextEvent = sortedEvents.find((event) => {
    const start = getEventStart(event);
    return !!start && start >= now;
  }) || null;
  const unreadNotificationCount = notifications.filter(notification => !notification.readAt && !notification.dismissedAt).length;
  const pendingImportCount = getPendingImportCount(travelImports);
  const locationIssueCount = getLocationIssueCount(trip, dismissedInsightIds);
  const urgentInsightCount = insights.filter(insight => insight.severity !== 'info').length;
  const travelStatusCount = getTravelStatusCount(flightStatusSnapshots, weatherSnapshots);

  const cards: ProactiveContextCard[] = [];

  if (nextEvent) {
    cards.push({
      type: 'next_up',
      title: 'Next up',
      description: getEventDisplayName(nextEvent),
      actionLabel: 'View event',
      priority: 50,
      event: nextEvent,
    });
  }

  if (phase === 'during' || todayEvents.length > 0) {
    cards.push({
      type: 'travel_day',
      title: 'Travel day',
      description: todayEvents.length > 0
        ? `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} today`
        : 'This trip is active now',
      value: todayEvents.length || undefined,
      actionLabel: 'Open today',
      priority: 20,
    });
  }

  if (unreadNotificationCount > 0) {
    cards.push({
      type: 'alerts',
      title: 'Unread alerts',
      description: `${unreadNotificationCount} item${unreadNotificationCount === 1 ? '' : 's'} need attention`,
      value: unreadNotificationCount,
      actionLabel: 'Review alerts',
      priority: 25,
    });
  }

  if (pendingImportCount > 0) {
    cards.push({
      type: 'pending_imports',
      title: 'Pending imports',
      description: `${pendingImportCount} import${pendingImportCount === 1 ? '' : 's'} ready to review`,
      value: pendingImportCount,
      actionLabel: 'Review imports',
      priority: 35,
    });
  }

  if (locationIssueCount > 0) {
    cards.push({
      type: 'location_issues',
      title: 'Location issues',
      description: `${locationIssueCount} event${locationIssueCount === 1 ? '' : 's'} need better map data`,
      value: locationIssueCount,
      actionLabel: 'Review locations',
      priority: 45,
    });
  }

  if (urgentInsightCount > 0 && !dismissedContextCardTypes.includes('urgent_insights')) {
    cards.push({
      type: 'urgent_insights',
      title: 'Needs attention',
      description: `${urgentInsightCount} planning issue${urgentInsightCount === 1 ? '' : 's'} detected`,
      value: urgentInsightCount,
      actionLabel: 'Review',
      priority: 30,
    });
  }

  if ((phase === 'during' || todayEvents.length > 0) && travelStatusCount > 0) {
    cards.push({
      type: 'travel_status',
      title: 'Live travel context',
      description: 'Weather or flight updates are available',
      value: travelStatusCount,
      actionLabel: 'Open today',
      priority: 40,
    });
  }

  return {
    phase,
    todayEvents,
    nextEvent,
    unreadNotificationCount,
    pendingImportCount,
    locationIssueCount,
    urgentInsightCount,
    travelStatusCount,
    cards: cards
      .map(card => ({ ...card, priority: card.priority + getPhaseWeight(phase, card.type) }))
      .sort((left, right) => left.priority - right.priority),
  };
};
