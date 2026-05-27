import { User } from './eventTypes';

export type TripHealthIssueType =
  | 'empty_day'
  | 'lodging_gap'
  | 'transport_gap'
  | 'location'
  | 'booking_ref'
  | 'exploring_event'
  | 'open_decision'
  | 'schedule_conflict';

export type TripHealthSeverity = 'info' | 'warning' | 'critical';

export type TripHealthDimension = 'schedule' | 'lodging' | 'transport' | 'location' | 'booking' | 'decisions';

export type ResolutionAction =
  | 'navigate'
  | 'create_event'
  | 'edit_event'
  | 'extend_stay'
  | 'ai_suggest'
  | 'review_location'
  | 'open_import'
  | 'open_decision'
  | 'defer_decision'
  | 'create_decision'
  | 'add_decision_option'
  | 'dismiss';

export interface ResolutionOption {
  id: string;
  label: string;
  action: ResolutionAction;
  payload?: Record<string, unknown>;
  isPrimary?: boolean;
}

export interface TripHealthIssue {
  id: string;
  issueKey: string;
  type: TripHealthIssueType;
  dimension: TripHealthDimension;
  severity: TripHealthSeverity;
  title: string;
  reason: string;
  affectedDates?: string[];
  relatedEventIds?: string[];
  resolutionOptions: ResolutionOption[];
}

export interface TripHealthSummary {
  headlineScore: number;
  logisticsScore: number;
  contentScore: number;
  openIssueCount: number;
  criticalCount: number;
  warningCount: number;
}

export interface TripHealthResult {
  summary: TripHealthSummary;
  issues: TripHealthIssue[];
}

export type HealthDismissalReason =
  | 'intentional_rest_day'
  | 'planning_deferred'
  | 'day_trip'
  | 'red_eye'
  | 'alternate_lodging'
  | 'overnight_transport'
  | 'connection_ok'
  | 'ad_hoc_ground_transport'
  | 'location_optional'
  | 'booking_not_required'
  | 'other';

export interface HealthDismissal {
  issueKey: string;
  reason: HealthDismissalReason;
  note?: string;
  dismissedAt: string;
  dismissedBy: User;
  reopenBeforeTripDays?: number;
}

export interface AddHealthDismissalRequest {
  issueKey: string;
  reason: HealthDismissalReason;
  note?: string;
  reopenBeforeTripDays?: number;
}
