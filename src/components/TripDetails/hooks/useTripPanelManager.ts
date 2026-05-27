import { useCallback, useState } from 'react';

export type TripPanel = 'notifications' | 'today' | 'checklist' | 'notes' | 'map' | 'planning';

export interface TripPanelOptions {
  issueId?: string;
}

export const useTripPanelManager = () => {
  const [activePanel, setActivePanel] = useState<TripPanel | null>(null);
  const [panelOptions, setPanelOptions] = useState<TripPanelOptions>({});

  const openPanel = useCallback((panel: TripPanel, options?: TripPanelOptions) => {
    setActivePanel(panel);
    setPanelOptions(options ?? {});
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    setPanelOptions({});
  }, []);

  const togglePanel = useCallback((panel: TripPanel, options?: TripPanelOptions) => {
    setActivePanel(currentPanel => {
      if (currentPanel === panel) {
        setPanelOptions({});
        return null;
      }
      setPanelOptions(options ?? {});
      return panel;
    });
  }, []);

  return {
    activePanel,
    panelOptions,
    openPanel,
    closePanel,
    togglePanel,
  };
};
