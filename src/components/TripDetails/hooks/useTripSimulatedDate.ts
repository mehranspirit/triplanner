import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trip } from '@/types/eventTypes';
import {
  getTripSimulatedDateStorageKey,
  isUiTestTrip,
  parseSimulatedDateKey,
} from '@/utils/uiTestTrip';

export const useTripSimulatedDate = (trip: Trip | null | undefined) => {
  const uiTestTrip = isUiTestTrip(trip);
  const tripId = trip?._id;

  const [simulatedDateKey, setSimulatedDateKeyState] = useState<string | null>(() => {
    if (!tripId || !uiTestTrip) return null;
    try {
      return localStorage.getItem(getTripSimulatedDateStorageKey(tripId));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!tripId || !uiTestTrip) {
      setSimulatedDateKeyState(null);
      return;
    }

    try {
      setSimulatedDateKeyState(localStorage.getItem(getTripSimulatedDateStorageKey(tripId)));
    } catch {
      setSimulatedDateKeyState(null);
    }
  }, [tripId, uiTestTrip]);

  const setSimulatedDateKey = useCallback((dateKey: string | null) => {
    setSimulatedDateKeyState(dateKey);
    if (!tripId || !uiTestTrip) return;

    try {
      if (dateKey) {
        localStorage.setItem(getTripSimulatedDateStorageKey(tripId), dateKey);
      } else {
        localStorage.removeItem(getTripSimulatedDateStorageKey(tripId));
      }
    } catch {
      // ignore storage failures in dev tooling
    }
  }, [tripId, uiTestTrip]);

  const referenceNow = useMemo(() => {
    if (uiTestTrip && simulatedDateKey) {
      return parseSimulatedDateKey(simulatedDateKey);
    }
    return new Date();
  }, [simulatedDateKey, uiTestTrip]);

  return {
    referenceNow,
    simulatedDateKey: uiTestTrip ? simulatedDateKey : null,
    setSimulatedDateKey,
    isSimulating: uiTestTrip && Boolean(simulatedDateKey),
    isUiTestTrip: uiTestTrip,
    tripStartDate: trip?.startDate,
    tripEndDate: trip?.endDate,
  };
};

export type TripSimulatedDateState = ReturnType<typeof useTripSimulatedDate>;
