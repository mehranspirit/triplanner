import { EventType } from '@/types/eventTypes';
import {
  AddHealthDismissalRequest,
  HealthDismissalReason,
  ResolutionAction,
} from '@/types/tripHealthTypes';
import { TripPanel } from '@/components/TripDetails/hooks/useTripPanelManager';

export interface ExploreScope {
  date?: string;
  endDate?: string;
  locationBias?: { lat: number; lng: number };
  defaultKeywords?: string;
}

export interface TripPanelOpenOptions {
  issueId?: string;
}

export interface ResolutionContext {
  tripId: string;
  openPanel: (panel: TripPanel, options?: TripPanelOpenOptions) => void;
  onAddEvent: (type: EventType, prefill?: Record<string, unknown>) => void;
  onEditEvent: (eventId: string) => void;
  onOpenExplore?: (scope?: ExploreScope) => void;
  onReviewLocation?: (eventId: string) => void;
  onOpenImport?: () => void;
  onOpenDecision?: (decisionId: string) => void;
  onDeferDecision?: (decisionId: string) => Promise<void>;
  onCreateDecisionGroup?: (optionEventIds: string[]) => void;
  onAddDecisionOption?: (decisionId: string) => void;
  onDismissIssue?: (
    issueKey: string,
    reason: HealthDismissalReason,
    note?: string,
    reopenBeforeTripDays?: number,
  ) => Promise<void>;
}

export async function executeResolution(
  action: ResolutionAction,
  payload: Record<string, unknown> | undefined,
  context: ResolutionContext,
): Promise<void> {
  switch (action) {
    case 'navigate': {
      const panel = payload?.panel;
      if (
        panel === 'planning'
        || panel === 'today'
        || panel === 'checklist'
        || panel === 'notes'
        || panel === 'map'
        || panel === 'notifications'
      ) {
        context.openPanel(panel, {
          issueId: typeof payload?.issueId === 'string' ? payload.issueId : undefined,
        });
      }
      break;
    }
    case 'create_event': {
      const eventType = payload?.eventType;
      if (typeof eventType === 'string') {
        context.onAddEvent(eventType as EventType, payload?.prefill as Record<string, unknown> | undefined);
      }
      break;
    }
    case 'edit_event': {
      const eventId = payload?.eventId;
      if (typeof eventId === 'string') {
        context.onEditEvent(eventId);
      }
      break;
    }
    case 'extend_stay': {
      const eventId = payload?.eventId;
      if (typeof eventId === 'string') {
        context.onEditEvent(eventId);
      }
      break;
    }
    case 'ai_suggest':
      context.onOpenExplore?.({
        date: typeof payload?.date === 'string' ? payload.date : undefined,
        endDate: typeof payload?.endDate === 'string' ? payload.endDate : undefined,
        defaultKeywords: typeof payload?.defaultKeywords === 'string' ? payload.defaultKeywords : undefined,
      });
      break;
    case 'review_location': {
      const eventId = payload?.eventId;
      if (typeof eventId === 'string') {
        context.onReviewLocation?.(eventId);
      }
      break;
    }
    case 'open_import':
      context.onOpenImport?.();
      break;
    case 'open_decision': {
      const decisionId = payload?.decisionId;
      if (typeof decisionId === 'string') {
        context.openPanel('planning', {
          issueId: `open_decision:${decisionId}`,
        });
        context.onOpenDecision?.(decisionId);
      }
      break;
    }
    case 'defer_decision': {
      const decisionId = payload?.decisionId;
      if (typeof decisionId === 'string') {
        await context.onDeferDecision?.(decisionId);
      }
      break;
    }
    case 'create_decision': {
      const optionEventIds = payload?.optionEventIds;
      if (Array.isArray(optionEventIds) && optionEventIds.every((id) => typeof id === 'string')) {
        context.onCreateDecisionGroup?.(optionEventIds as string[]);
      }
      break;
    }
    case 'add_decision_option': {
      const decisionId = payload?.decisionId;
      if (typeof decisionId === 'string') {
        context.openPanel('planning', {
          issueId: `open_decision:${decisionId}`,
        });
        context.onOpenDecision?.(decisionId);
        context.onAddDecisionOption?.(decisionId);
      }
      break;
    }
    case 'dismiss': {
      const issueKey = payload?.issueKey;
      const reason = payload?.reason;
      if (typeof issueKey === 'string' && typeof reason === 'string') {
        await context.onDismissIssue?.(
          issueKey,
          reason as HealthDismissalReason,
          typeof payload?.note === 'string' ? payload.note : undefined,
          typeof payload?.reopenBeforeTripDays === 'number' ? payload.reopenBeforeTripDays : undefined,
        );
      }
      break;
    }
    default:
      console.warn('Unhandled resolution action:', action);
  }
}

export type { AddHealthDismissalRequest };
