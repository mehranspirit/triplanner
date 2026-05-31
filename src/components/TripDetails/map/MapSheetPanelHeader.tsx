import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TripPanel } from '../hooks/useTripPanelManager';
import { panelCopy, panelGroups } from '../panels/tripPanelMeta';
import { cn } from '@/lib/utils';

interface MapSheetPanelHeaderProps {
  activePanel: TripPanel;
  onOpenPanel: (panel: TripPanel) => void;
  onClosePanel: () => void;
}

const MapSheetPanelHeader: React.FC<MapSheetPanelHeaderProps> = ({
  activePanel,
  onOpenPanel,
  onClosePanel,
}) => {
  const copy = panelCopy[activePanel];
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [activePanel]);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50/95 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Trip detail</p>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="mt-0.5 text-base font-bold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {copy.title}
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{copy.description}</p>
        </div>
        <button
          type="button"
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
          aria-label="Back to timeline"
          onClick={onClosePanel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 hidden gap-2 overflow-x-auto pb-1 lg:flex" role="tablist" aria-label="Trip detail panels">
        {panelGroups.map((group) => (
          <div key={group.label} className="flex shrink-0 items-center gap-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            <div className="flex gap-1">
              {group.panels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === panel.id}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    activePanel === panel.id
                      ? 'border-blue-200 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
                  )}
                  onClick={() => onOpenPanel(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapSheetPanelHeader;
