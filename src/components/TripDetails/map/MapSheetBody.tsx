import React from 'react';
import { TripPanel } from '../hooks/useTripPanelManager';
import TripPanelContent, { TripPanelContentProps } from '../panels/TripPanelContent';
import MapSheetPanelHeader from './MapSheetPanelHeader';

type MapSheetBodyProps = Omit<TripPanelContentProps, 'activePanel'> & {
  timeline: React.ReactNode;
  activePanel: TripPanel | null;
};

const MapSheetBody: React.FC<MapSheetBodyProps> = ({
  timeline,
  activePanel,
  onClose,
  onOpenPanel,
  ...panelProps
}) => {
  if (!activePanel || activePanel === 'map') {
    return <>{timeline}</>;
  }

  return (
    <div className="flex min-h-0 flex-col">
      <MapSheetPanelHeader
        activePanel={activePanel}
        onOpenPanel={onOpenPanel}
        onClosePanel={onClose}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <TripPanelContent
          activePanel={activePanel}
          onClose={onClose}
          onOpenPanel={onOpenPanel}
          {...panelProps}
        />
      </div>
    </div>
  );
};

export default MapSheetBody;
