import { EventType } from './eventTypes';

export type TripInsightType =
  | 'missing_info'
  | 'conflict'
  | 'suggestion'
  | 'reminder'
  | 'budget'
  | 'sync'
  | 'collaboration';

export type TripInsightSeverity = 'info' | 'warning' | 'critical';

export interface TripInsight {
  id: string;
  type: TripInsightType;
  severity: TripInsightSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: 'add_event' | 'ai_import' | 'checklist' | 'expenses' | 'event';
  actionEventType?: EventType;
  source: {
    kind: 'trip' | 'event' | 'checklist' | 'expense' | 'settlement' | 'sync';
    id?: string;
  };
  dismissible: boolean;
  createdAt: string;
}
