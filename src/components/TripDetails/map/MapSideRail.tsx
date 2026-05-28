import React from 'react';
import { TripPanel } from '../hooks/useTripPanelManager';

interface MapSideRailProps {
  children: React.ReactNode;
  activePanel: TripPanel | null;
}

const MapSideRail: React.FC<MapSideRailProps> = ({ children, activePanel }) => (
  <aside className="hidden min-h-0 flex-col border-l border-white/10 bg-white lg:flex">
    {!activePanel && (
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Itinerary</p>
        <h2 className="text-lg font-semibold text-slate-950">Timeline</h2>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-y-auto p-3 [--trip-timeline-sticky-top:0px] [--trip-timeline-sticky-top-md:0px]">
      {children}
    </div>
  </aside>
);

export default MapSideRail;
