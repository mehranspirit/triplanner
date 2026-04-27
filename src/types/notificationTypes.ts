export type NotificationType = 'insight' | 'reminder' | 'prep' | 'sync' | 'system';
export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type NotificationActionTarget = 'trip' | 'event' | 'checklist' | 'expenses' | 'today' | 'ai_import' | 'add_event';

export interface TripNotification {
  _id: string;
  userId: string;
  tripId?: string;
  eventId?: string;
  dedupeKey: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: NotificationActionTarget;
  scheduledFor?: string;
  readAt?: string;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationRequest {
  read?: boolean;
  dismissed?: boolean;
}

export interface NotificationPreference {
  _id: string;
  userId: string;
  tripId: string;
  inAppEnabled: boolean;
  disabledTypes: NotificationType[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationPreferenceRequest {
  inAppEnabled?: boolean;
  disabledTypes?: NotificationType[];
}
