import { Event } from '@/types/eventTypes';
import { MultidayEventDayRole } from '@/utils/timelineDates';

export interface EventGlanceAttention {
  alertCount?: number;
  hasLocationIssue?: boolean;
  hasFlightStatus?: boolean;
  decisionTitle?: string;
}

export interface EventGlanceContentProps {
  event: Event;
  isExploring: boolean;
  isActive: boolean;
  location?: string;
  showTimeInBody?: boolean;
  multidayRole?: MultidayEventDayRole | null;
  viewDateKey?: string;
}
