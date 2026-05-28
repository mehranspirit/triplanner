import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutList, Map as MapIcon, Wand2 } from 'lucide-react';
import TripMap, { TripMapFilter } from '@/components/TripMap';
import { Trip, Event } from '@/types/eventTypes';
import { useMapViewChrome } from '@/context/MapViewChromeContext';
import { eventHasMapCoordinates } from '@/utils/eventLocation';
import { getTripStatusSummary } from '@/services/tripStatus';
import { resolveMapTileStyleForTrip } from '@/config/mapTiles';
import { cn } from '@/lib/utils';
import { TripPanel } from '../hooks/useTripPanelManager';
import { getPanelSheetSnap } from '../panels/tripPanelMeta';
import MapGeocodeBanner from './MapGeocodeBanner';
import MapBottomSheet, { MapSheetSnap } from './MapBottomSheet';
import MapSideRail from './MapSideRail';
import TodayPeek from './TodayPeek';
import EventMapPreview from './EventMapPreview';
import ToolsMenuSheet from './ToolsMenuSheet';
import type { ToolsMenuSheetProps } from './toolsMenuSheetTypes';

interface MapTripViewProps {
  trip: Trip;
  canEdit: boolean;
  sheetBody: React.ReactNode;
  activePanel: TripPanel | null;
  collapseSheet: boolean;
  unreadNotificationCount: number;
  onExitMapView: () => void;
  onReviewLocations?: () => void;
  onOpenEvent?: (event: Event) => void;
  onClosePanel: () => void;
  toolsMenuProps: Omit<ToolsMenuSheetProps, 'open' | 'onOpenChange' | 'unreadNotificationCount'>;
}

const MapTripView: React.FC<MapTripViewProps> = ({
  trip,
  canEdit,
  sheetBody,
  activePanel,
  collapseSheet,
  unreadNotificationCount,
  onExitMapView,
  onReviewLocations,
  onOpenEvent,
  onClosePanel,
  toolsMenuProps,
}) => {
  const { setMapViewActive } = useMapViewChrome();
  const [sheetSnap, setSheetSnap] = useState<MapSheetSnap>('peek');
  const [mapFilter, setMapFilter] = useState<TripMapFilter>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [navigableEvents, setNavigableEvents] = useState<Event[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    setMapViewActive(true);
    return () => setMapViewActive(false);
  }, [setMapViewActive]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (collapseSheet) {
      setSheetSnap('peek');
    }
  }, [collapseSheet]);

  useEffect(() => {
    if (!activePanel) {
      setSheetSnap('peek');
      return;
    }
    setSheetSnap(getPanelSheetSnap(activePanel));
  }, [activePanel]);

  const geocodedCount = useMemo(
    () => (trip.events || []).filter(eventHasMapCoordinates).length,
    [trip.events],
  );

  const status = getTripStatusSummary(trip);

  const tileStyle = useMemo(() => {
    const start = trip.startDate ? new Date(trip.startDate) : null;
    const end = trip.endDate ? new Date(trip.endDate) : null;
    return resolveMapTileStyleForTrip(start, end);
  }, [trip.endDate, trip.startDate]);

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setSheetSnap('peek');
    onClosePanel();
  };

  const handleNavigableEventsChange = useCallback((events: Event[]) => {
    setNavigableEvents(events);
  }, []);

  const selectedStopIndex = useMemo(
    () => (selectedEvent ? navigableEvents.findIndex((event) => event.id === selectedEvent.id) : -1),
    [navigableEvents, selectedEvent],
  );

  useEffect(() => {
    if (
      selectedEvent
      && navigableEvents.length > 0
      && !navigableEvents.some((event) => event.id === selectedEvent.id)
    ) {
      setSelectedEvent(null);
    }
  }, [navigableEvents, selectedEvent]);

  const goToAdjacentStop = (direction: 'prev' | 'next') => {
    if (selectedStopIndex === -1) return;

    const nextIndex = direction === 'prev' ? selectedStopIndex - 1 : selectedStopIndex + 1;
    if (nextIndex < 0 || nextIndex >= navigableEvents.length) return;

    setSelectedEvent(navigableEvents[nextIndex]);
  };

  const handleSnapChange = (snap: MapSheetSnap) => {
    if (activePanel && snap === 'peek') {
      onClosePanel();
    }
    setSheetSnap(snap);
  };

  const peekContent = activePanel && activePanel !== 'map'
    ? null
    : <TodayPeek trip={trip} />;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
      <header className="relative z-20 shrink-0 border-b border-white/10 bg-slate-950/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-lg backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{trip.name}</p>
            {status.start && status.end && (
              <p className="truncate text-xs text-white/70">{status.label}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="relative inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/15 sm:text-sm"
              aria-expanded={isToolsOpen}
              aria-haspopup="dialog"
              onClick={() => setIsToolsOpen(true)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Tools
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <div className="inline-flex rounded-full border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white sm:text-sm"
                onClick={onExitMapView}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Standard
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm',
                  'bg-white text-slate-900 shadow-sm',
                )}
                aria-current="page"
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <MapGeocodeBanner
            geocodedCount={geocodedCount}
            totalEvents={trip.events?.length ?? 0}
            canEdit={canEdit}
            onReviewLocations={onReviewLocations}
          />
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[3fr_2fr]">
        <div className="relative min-h-0">
          <div className="absolute inset-0 z-0">
            <TripMap
              trip={trip}
              variant="immersive"
              className="h-full rounded-none"
              mapFilter={mapFilter}
              tileStyle={tileStyle}
              onEventSelect={handleEventSelect}
              focusEventId={selectedEvent?.id ?? null}
              onNavigableEventsChange={handleNavigableEventsChange}
            />
          </div>

          <div className="pointer-events-none absolute left-3 top-3 z-[5] flex flex-col gap-2">
            <div className="pointer-events-auto inline-flex rounded-full border border-white/20 bg-slate-950/80 p-1 shadow-lg backdrop-blur-md">
              {(['today', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={mapFilter === filter}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors sm:text-sm',
                    mapFilter === filter
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/80 hover:text-white',
                  )}
                  onClick={() => setMapFilter(filter)}
                >
                  {filter === 'all' ? 'All trip' : 'Today'}
                </button>
              ))}
            </div>

            {selectedEvent && (
              <div className="pointer-events-auto max-w-sm">
                <EventMapPreview
                  event={selectedEvent}
                  stopIndex={selectedStopIndex}
                  stopCount={navigableEvents.length}
                  onPrevious={() => goToAdjacentStop('prev')}
                  onNext={() => goToAdjacentStop('next')}
                  onClose={() => setSelectedEvent(null)}
                  onOpenEvent={onOpenEvent}
                />
              </div>
            )}
          </div>

          {!isDesktop && (
            <MapBottomSheet
              snap={sheetSnap}
              onSnapChange={handleSnapChange}
              peekContent={peekContent}
            >
              {sheetBody}
            </MapBottomSheet>
          )}

          {import.meta.env.VITE_MAPTILER_API_KEY && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[5] max-w-[calc(100%-1.5rem)] rounded-md bg-slate-950/75 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm lg:bottom-4">
              © MapTiler © OpenStreetMap contributors
            </div>
          )}

          <ToolsMenuSheet
            open={isToolsOpen}
            unreadNotificationCount={unreadNotificationCount}
            onOpenChange={setIsToolsOpen}
            {...toolsMenuProps}
          />
        </div>

        {isDesktop && (
          <MapSideRail activePanel={activePanel}>
            {sheetBody}
          </MapSideRail>
        )}
      </div>
    </div>
  );
};

export default MapTripView;
