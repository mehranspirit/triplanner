import { useCallback, useState } from 'react';

export type TripPanel = 'notifications' | 'today' | 'checklist' | 'notes' | 'map';

export const useTripPanelManager = () => {
  const [activePanel, setActivePanel] = useState<TripPanel | null>(null);

  const openPanel = useCallback((panel: TripPanel) => {
    setActivePanel(panel);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const togglePanel = useCallback((panel: TripPanel) => {
    setActivePanel(currentPanel => currentPanel === panel ? null : panel);
  }, []);

  return {
    activePanel,
    openPanel,
    closePanel,
    togglePanel,
  };
};
