import { useCallback } from 'react';
import { Trip } from '@/types/eventTypes';
import {
  ConfirmDecisionRequest,
  CreateDecisionRequest,
  DecisionSet,
  UpdateDecisionRequest,
} from '@/types/decisionTypes';
import { api } from '@/services/api';

const normalizeDecisions = (decisions: DecisionSet[], tripId: string): DecisionSet[] => (
  decisions.map((decision) => ({
    ...decision,
    tripId: decision.tripId || tripId,
  }))
);

export const useDecisions = (
  trip: Trip | null,
  onTripUpdated: (updates: Partial<Pick<Trip, 'decisions' | 'events'>>) => void,
) => {
  const createDecision = useCallback(async (data: CreateDecisionRequest) => {
    if (!trip?._id) return null;
    const decisions = normalizeDecisions(await api.createDecision(trip._id, data), trip._id);
    onTripUpdated({ decisions });
    return decisions;
  }, [trip?._id, onTripUpdated]);

  const updateDecision = useCallback(async (decisionId: string, data: UpdateDecisionRequest) => {
    if (!trip?._id) return null;
    const decisions = normalizeDecisions(
      await api.updateDecision(trip._id, decisionId, data),
      trip._id,
    );
    onTripUpdated({ decisions });
    return decisions;
  }, [trip?._id, onTripUpdated]);

  const deleteDecision = useCallback(async (decisionId: string) => {
    if (!trip?._id) return null;
    const decisions = normalizeDecisions(
      await api.deleteDecision(trip._id, decisionId),
      trip._id,
    );
    onTripUpdated({ decisions });
    return decisions;
  }, [trip?._id, onTripUpdated]);

  const confirmDecision = useCallback(async (decisionId: string, data: ConfirmDecisionRequest) => {
    if (!trip?._id) return null;
    const result = await api.confirmDecision(trip._id, decisionId, data);
    onTripUpdated({
      decisions: normalizeDecisions(result.decisions, trip._id),
      events: result.events,
    });
    return result;
  }, [trip?._id, onTripUpdated]);

  const refreshDecisions = useCallback(async () => {
    if (!trip?._id) return null;
    const decisions = normalizeDecisions(await api.getDecisions(trip._id), trip._id);
    onTripUpdated({ decisions });
    return decisions;
  }, [trip?._id, onTripUpdated]);

  const generateComparisonOverview = useCallback(async (
    decisionId: string,
    options?: { refresh?: boolean },
  ) => {
    if (!trip?._id) return null;
    const result = await api.generateComparisonOverview(trip._id, decisionId, options);
    const decisions = normalizeDecisions(result.decisions, trip._id);
    onTripUpdated({ decisions });
    return result.comparisonOverview;
  }, [trip?._id, onTripUpdated]);

  return {
    createDecision,
    updateDecision,
    deleteDecision,
    confirmDecision,
    refreshDecisions,
    generateComparisonOverview,
  };
};

export type UseDecisionsReturn = ReturnType<typeof useDecisions>;
