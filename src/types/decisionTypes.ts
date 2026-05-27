import { User } from './eventTypes';

export type DecisionSetStatus = 'open' | 'decided' | 'deferred';

export interface DecisionSlot {
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  label?: string;
}

export interface ComparisonDimensionValue {
  eventId: string;
  display: string;
  highlight?: 'best' | 'worst' | 'neutral';
}

export interface ComparisonDimension {
  key: string;
  label: string;
  values: ComparisonDimensionValue[];
}

export interface OptionSummary {
  eventId: string;
  bestFor: string[];
  watchOuts: string[];
  oneLiner: string;
}

export interface SoftRecommendation {
  eventId: string;
  label: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  caveats: string[];
}

export interface DecisionComparisonContext {
  comparisonType?: 'activity' | 'destination' | 'stay' | 'mixed';
  slotLabel?: string;
  referenceLabel?: string;
  referenceDescription?: string;
  staticMapUrl?: string;
}

export interface DecisionComparisonOverview {
  generatedAt: string;
  generatedBy: 'ai' | 'deterministic';
  model?: string;
  stale: boolean;
  summary: string;
  context?: DecisionComparisonContext;
  dimensions: ComparisonDimension[];
  optionSummaries: OptionSummary[];
  tradeoffs: string[];
  missingInfo: string[];
  softRecommendation?: SoftRecommendation;
}

export type DecisionLoserAction = 'archive' | 'delete' | 'keep_exploring';

export interface CreateDecisionRequest {
  title: string;
  slot?: DecisionSlot;
  optionEventIds: string[];
}

export interface UpdateDecisionRequest {
  title?: string;
  slot?: DecisionSlot | null;
  status?: DecisionSetStatus;
  addOptionEventIds?: string[];
  removeOptionEventIds?: string[];
}

export interface ConfirmDecisionRequest {
  winnerEventId: string;
  loserAction?: DecisionLoserAction;
}

export interface ConfirmDecisionResponse {
  decisions: DecisionSet[];
  events: import('./eventTypes').Event[];
}

export interface GenerateComparisonOverviewResponse {
  decisionId: string;
  comparisonOverview: DecisionComparisonOverview;
  decisions: DecisionSet[];
}

export interface DecisionSet {
  id: string;
  tripId: string;
  title: string;
  slot?: DecisionSlot;
  optionEventIds: string[];
  status: DecisionSetStatus;
  winnerEventId?: string;
  decidedAt?: string;
  decidedBy?: User;
  createdBy: User;
  createdAt: string;
  comparisonOverview?: DecisionComparisonOverview;
}
