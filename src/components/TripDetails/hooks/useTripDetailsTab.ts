import { useCallback, useEffect, useState } from 'react';
import { TripDetailsTab } from '@/types/tripDetailsTabTypes';
import {
  loadTripDetailsTab,
  saveTripDetailsTab,
} from '@/utils/tripDetailsPreferences';

export const useTripDetailsTab = (tripId: string | undefined) => {
  const [activeTab, setActiveTabState] = useState<TripDetailsTab>('itinerary');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    setActiveTabState(loadTripDetailsTab(tripId));
    setIsHydrated(true);
  }, [tripId]);

  const setActiveTab = useCallback((tab: TripDetailsTab) => {
    if (!tripId) return;
    setActiveTabState(tab);
    saveTripDetailsTab(tripId, tab);
  }, [tripId]);

  return {
    activeTab,
    isHydrated,
    setActiveTab,
  };
};
