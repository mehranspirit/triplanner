import React from 'react';
import { TripPanel } from '../hooks/useTripPanelManager';
import { cn } from '@/lib/utils';

interface MapSideRailProps {
  children: React.ReactNode;
  activePanel: TripPanel | null;
  className?: string;
}

const MapSideRail: React.FC<MapSideRailProps> = ({ children, activePanel, className }) => (
    <aside className={cn('min-h-0 flex-col border-t border-white/10 bg-white lg:border-l lg:border-t-0', className)}>
    {!activePanel && (
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Itinerary</p>
        <h2 className="text-lg font-semibold text-slate-950">Timeline</h2>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-3 [--trip-timeline-sticky-top:0px] [--trip-timeline-sticky-top-md:0px]">
      {children}
    </div>
  </aside>
);

export default MapSideRail;
