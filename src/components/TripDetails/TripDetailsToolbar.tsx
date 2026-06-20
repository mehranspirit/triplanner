import React, { forwardRef } from 'react';
import { CalendarDays, LayoutList, Map as MapIconLucide, MapPin } from 'lucide-react';
import { EventType } from '@/types/eventTypes';
import { TripDetailsView } from '@/types/tripDetailsViewTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { TripPanel } from './hooks/useTripPanelManager';
import TripSimulatedDatePicker from './TripSimulatedDatePicker';
import TripToolbarActionMenus from './TripToolbarActionMenus';

interface TripDetailsToolbarProps {
  tripId: string;
  canEdit: boolean;
  addableEventTypes: EventType[];
  activePanel: TripPanel | null;
  activeView: TripDetailsView;
  unreadNotificationCount: number;
  isImprovingLocations: boolean;
  improveLocationsLabel?: string;
  mapLocationProgress?: { geocoded: number; total: number };
  onOpenAIImport: () => void;
  onAddEvent: (eventType: EventType) => void;
  onOpenExploreSuggestions: () => void;
  onOpenPlaceSearch?: () => void;
  onImproveLocations: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
  onViewChange: (view: TripDetailsView) => void;
  showCalendarTab?: boolean;
}

const VIEW_OPTIONS: Array<{
  id: TripDetailsView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'itinerary', label: 'Itinerary', icon: <LayoutList className="h-3.5 w-3.5" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { id: 'map', label: 'Map', icon: <MapIconLucide className="h-3.5 w-3.5" /> },
];

const TripDetailsToolbar = forwardRef<HTMLDivElement, TripDetailsToolbarProps>(function TripDetailsToolbar({
  tripId,
  canEdit,
  addableEventTypes,
  activePanel,
  activeView,
  unreadNotificationCount,
  isImprovingLocations,
  improveLocationsLabel,
  mapLocationProgress,
  onOpenAIImport,
  onAddEvent,
  onOpenExploreSuggestions,
  onOpenPlaceSearch,
  onImproveLocations,
  onOpenPanel,
  onOpenNotifications,
  onViewChange,
  showCalendarTab = true,
}, ref) {
  const viewOptions = showCalendarTab
    ? VIEW_OPTIONS
    : VIEW_OPTIONS.filter((view) => view.id !== 'calendar');
  const showLocationProgress = mapLocationProgress
    && mapLocationProgress.total > 0
    && mapLocationProgress.geocoded < mapLocationProgress.total;

  return (
    <div
      ref={ref}
      data-trip-details-toolbar
      className={cn(tripSurfaces.float, 'sticky top-0 z-40 rounded-none border-x-0 p-2 lg:rounded-3xl lg:border-x lg:p-3')}
    >
      <div className="flex flex-col gap-2">
        <div className="hidden items-center gap-2 lg:flex">
          <TripToolbarActionMenus
            tripId={tripId}
            canEdit={canEdit}
            addableEventTypes={addableEventTypes}
            activePanel={activePanel}
            unreadNotificationCount={unreadNotificationCount}
            isImprovingLocations={isImprovingLocations}
            improveLocationsLabel={improveLocationsLabel}
            onOpenAIImport={onOpenAIImport}
            onAddEvent={onAddEvent}
            onOpenExploreSuggestions={onOpenExploreSuggestions}
            onOpenPlaceSearch={onOpenPlaceSearch}
            onImproveLocations={onImproveLocations}
            onOpenPanel={onOpenPanel}
            onOpenNotifications={onOpenNotifications}
            onViewChange={onViewChange}
          />

          {showLocationProgress && (
            canEdit ? (
              <button
                type="button"
                className="ml-auto hidden items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/90 px-3 py-1.5 text-xs font-medium text-teal-900 shadow-sm transition-colors hover:bg-teal-100 sm:inline-flex sm:text-sm"
                onClick={onImproveLocations}
                disabled={isImprovingLocations}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                {isImprovingLocations
                  ? (improveLocationsLabel || 'Reviewing...')
                  : `${mapLocationProgress.geocoded}/${mapLocationProgress.total} on map`}
              </button>
            ) : (
              <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 sm:inline-flex sm:text-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                {`${mapLocationProgress.geocoded}/${mapLocationProgress.total} on map`}
              </span>
            )
          )}
        </div>

        <TripSimulatedDatePicker />

        <nav
          aria-label="Trip views"
          className={cn('flex w-full', tripSurfaces.segmentTrack)}
        >
          {viewOptions.map((view) => (
            <button
              key={view.id}
              type="button"
              aria-current={activeView === view.id ? 'page' : undefined}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                activeView === view.id
                  ? tripSurfaces.segmentActive
                  : 'text-slate-600 hover:text-slate-900',
              )}
              onClick={() => onViewChange(view.id)}
            >
              {view.icon}
              {view.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
});

export default TripDetailsToolbar;
