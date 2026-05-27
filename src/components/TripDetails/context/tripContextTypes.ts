import { Event } from '@/types/eventTypes';

export type TripPhase = 'before' | 'during' | 'after' | 'unscheduled';

export type ProactiveContextCardType =
  | 'next_up'
  | 'travel_day'
  | 'alerts'
  | 'pending_imports'
  | 'location_issues'
  | 'urgent_insights'
  | 'travel_status'
  | 'trip_health';

export interface ProactiveContextCard {
  type: ProactiveContextCardType;
  title: string;
  description: string;
  value?: string | number;
  actionLabel: string;
  priority: number;
  event?: Event;
  issueId?: string;
  healthScore?: number;
}

export interface TripContextSignals {
  phase: TripPhase;
  todayEvents: Event[];
  nextEvent: Event | null;
  unreadNotificationCount: number;
  pendingImportCount: number;
  locationIssueCount: number;
  urgentInsightCount: number;
  travelStatusCount: number;
  cards: ProactiveContextCard[];
}
