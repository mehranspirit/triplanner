import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutList, Map as MapIcon } from 'lucide-react';
import TripMap, { TripMapFilter } from '@/components/TripMap';
import { Trip, Event } from '@/types/eventTypes';
import { useMapViewChrome } from '@/context/MapViewChromeContext';
import { eventHasMapCoordinates } from '@/utils/eventLocation';
import { getTripStatusSummary } from '@/services/tripStatus';
import { resolveMapTileStyleForTrip } from '@/config/mapTiles';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { TripPanel } from '../hooks/useTripPanelManager';
import { getPanelSheetSnap } from '../panels/tripPanelMeta';
import MapGeocodeBanner from './MapGeocodeBanner';
import MapSideRail from './MapSideRail';
import EventMapPreview from './EventMapPreview';
import MapBottomSheet, { MapSheetSnap } from './MapBottomSheet';
import TodayPeek from './TodayPeek';
import TripToolbarActionMenus, { TripToolbarActionMenusProps } from '../TripToolbarActionMenus';
import TripSimulatedDatePicker from '../TripSimulatedDatePicker';

interface MapTripViewProps {
  trip: Trip;
  canEdit: boolean;
  mobileSheetBody: React.ReactNode;
  desktopRailBody: React.ReactNode;
  activePanel: TripPanel | null;
  unreadNotificationCount: number;
  isOverlayModalOpen?: boolean;
  onExitMapView: () => void;
  onReviewLocations?: () => void;
  onOpenEvent?: (event: Event) => void;
  onClosePanel: () => void;
  toolbarMenuProps: Omit<TripToolbarActionMenusProps, 'activePanel' | 'unreadNotificationCount' | 'isMapView'>;
}

const MapTripView: React.FC<MapTripViewProps> = ({
  trip,
  canEdit,
  mobileSheetBody,
  desktopRailBody,
  activePanel,
  unreadNotificationCount,
  isOverlayModalOpen = false,
  onExitMapView,
  onReviewLocations,
  onOpenEvent,
  onClosePanel,
  toolbarMenuProps,
}) => {
  const { setMapViewActive } = useMapViewChrome();
  const [mapFilter, setMapFilter] = useState<TripMapFilter>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [navigableEvents, setNavigableEvents] = useState<Event[]>([]);
  const [sheetSnap, setSheetSnap] = useState<MapSheetSnap>('peek');

  useEffect(() => {
    setMapViewActive(true);
    return () => setMapViewActive(false);
  }, [setMapViewActive]);

  useEffect(() => {
    if (isOverlayModalOpen) {
      setSheetSnap('peek');
      return;
    }

    if (activePanel && activePanel !== 'map') {
      setSheetSnap(getPanelSheetSnap(activePanel));
    }
  }, [activePanel, isOverlayModalOpen]);

  useEffect(() => {
    if (!activePanel && !isOverlayModalOpen) {
      setSheetSnap((current) => (current === 'full' ? 'half' : current));
    }
  }, [activePanel, isOverlayModalOpen]);

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
    onClosePanel();
    if (sheetSnap === 'peek') {
      setSheetSnap('half');
    }
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

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <TripToolbarActionMenus
              {...toolbarMenuProps}
              activePanel={activePanel}
              unreadNotificationCount={unreadNotificationCount}
              isMapView
              className="hidden lg:flex"
            />

            <div className={cn('inline-flex', tripSurfaces.mapSegmentTrack)}>
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
                  tripSurfaces.mapSegmentActive,
                )}
                aria-current="page"
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 hidden lg:block">
          <TripSimulatedDatePicker />
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

      <div className="relative min-h-0 flex-1 lg:grid lg:grid-cols-2">
        <div className="relative h-full min-h-0">
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
            <div className={cn('pointer-events-auto inline-flex', tripSurfaces.mapSegmentTrack)}>
              {(['today', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={mapFilter === filter}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors sm:text-sm',
                    mapFilter === filter
                      ? tripSurfaces.mapSegmentActive
                      : 'text-white/80 hover:text-white',
                  )}
                  onClick={() => setMapFilter(filter)}
                >
                  {filter === 'all' ? 'All trip' : 'Today'}
                </button>
              ))}
            </div>

            {selectedEvent && (
              <div className="pointer-events-auto max-w-[min(100%,20rem)]">
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

          {import.meta.env.VITE_MAPTILER_API_KEY && (
            <div className={cn(
              'pointer-events-none absolute left-3 z-[5] max-w-[calc(100%-1.5rem)] rounded-md bg-slate-950/75 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm',
              'bottom-[calc(5.75rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-4',
            )}
            >
              © MapTiler © OpenStreetMap contributors
            </div>
          )}

          <MapBottomSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            peekContent={<TodayPeek trip={trip} />}
          >
            {mobileSheetBody}
          </MapBottomSheet>
        </div>

        <MapSideRail activePanel={activePanel} className="hidden lg:flex">
          {desktopRailBody}
        </MapSideRail>
      </div>
    </div>
  );
};

export default MapTripView;
