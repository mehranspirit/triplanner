export type AssistantActionTarget = 'event' | 'checklist' | 'add_event' | 'today' | 'expenses' | 'ai_import';

export interface AssistantRisk {
  title: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  actionTarget?: AssistantActionTarget;
  eventId?: string;
}

export interface AssistantAction {
  title: string;
  reason: string;
  actionLabel: string;
  actionTarget: AssistantActionTarget;
  eventId?: string;
}

export interface AssistantChecklistItem {
  text: string;
  reason: string;
  scope: 'shared' | 'personal';
  dueDate?: string;
}

export interface AssistantBackupEvent {
  title: string;
  reason: string;
  eventType: 'activity' | 'destination';
  date?: string;
  locationHint?: string;
}

export interface TripAssistantBriefing {
  summary: string;
  topRisks: AssistantRisk[];
  nextBestActions: AssistantAction[];
  suggestedChecklistItems: AssistantChecklistItem[];
  suggestedBackupEvents: AssistantBackupEvent[];
}

export interface TripAssistantBriefingResponse {
  model: string;
  generatedAt: string;
  briefing: TripAssistantBriefing;
}

export interface TodayBriefingWatchItem {
  title: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  eventId?: string;
}

export interface TodayBriefingAction {
  title: string;
  reason: string;
  actionLabel: string;
  actionTarget: 'event' | 'checklist' | 'today';
  eventId?: string;
}

export interface TodayBriefingFallbackIdea {
  title: string;
  reason: string;
}

export interface TripTodayBriefing {
  summary: string;
  nextAction?: TodayBriefingAction;
  watchItems: TodayBriefingWatchItem[];
  fallbackIdeas: TodayBriefingFallbackIdea[];
  collaboratorMessage?: string;
}

export interface TripTodayBriefingResponse {
  model: string;
  generatedAt: string;
  briefing: TripTodayBriefing;
}

export interface ReplanSuggestion {
  title: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  suggestionType: 'timing' | 'backup' | 'transport' | 'weather' | 'flight' | 'checklist';
  actionLabel?: string;
  actionTarget?: 'event' | 'checklist' | 'today';
  eventId?: string;
}

export interface TripReplanBriefing {
  summary: string;
  suggestions: ReplanSuggestion[];
  fallbackIdeas: TodayBriefingFallbackIdea[];
  suggestedChecklistItems: AssistantChecklistItem[];
  caveat?: string;
}

export interface TripReplanBriefingResponse {
  model: string;
  generatedAt: string;
  briefing: TripReplanBriefing;
}

export type AssistantSuggestionType = 'assistant_checklist_item' | 'assistant_action' | 'assistant_backup_event';
export type AssistantSuggestionFeedbackStatus = 'accepted' | 'dismissed';

export interface AssistantSuggestionFeedback {
  _id: string;
  userId: string;
  tripId: string;
  suggestionId: string;
  suggestionType: AssistantSuggestionType;
  status: AssistantSuggestionFeedbackStatus;
  scope: 'shared' | 'personal';
  title?: string;
  reason?: string;
  payload?: unknown;
  acceptedAt?: string;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAssistantSuggestionFeedbackRequest {
  suggestionId: string;
  suggestionType: AssistantSuggestionType;
  status: AssistantSuggestionFeedbackStatus;
  scope?: 'shared' | 'personal';
  title?: string;
  reason?: string;
  payload?: unknown;
}

export interface TripQuestionAnswer {
  answer: string;
  supportingFacts: string[];
  relatedEventIds: string[];
  caveat?: string;
}

export interface TripQuestionAnswerResponse {
  model: string;
  generatedAt: string;
  question: string;
  result: TripQuestionAnswer;
}
