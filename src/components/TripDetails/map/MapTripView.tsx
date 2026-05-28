import React, { useEffect, useMemo } from 'react';
import { LayoutList } from 'lucide-react';
import TripMap from '@/components/TripMap';
import { Trip } from '@/types/eventTypes';
import { Button } from '@/components/ui/button';
import { useMapViewChrome } from '@/context/MapViewChromeContext';
import { eventHasMapCoordinates } from '@/utils/eventLocation';
import { getTripStatusSummary } from '@/services/tripStatus';
import MapGeocodeBanner from './MapGeocodeBanner';

interface MapTripViewProps {
  trip: Trip;
  canEdit: boolean;
  onExitMapView: () => void;
  onReviewLocations?: () => void;
}

const MapTripView: React.FC<MapTripViewProps> = ({
  trip,
  canEdit,
  onExitMapView,
  onReviewLocations,
}) => {
  const { setMapViewActive } = useMapViewChrome();

  useEffect(() => {
    setMapViewActive(true);
    return () => setMapViewActive(false);
  }, [setMapViewActive]);

  const geocodedCount = useMemo(
    () => (trip.events || []).filter(eventHasMapCoordinates).length,
    [trip.events],
  );

  const status = getTripStatusSummary(trip);

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/5">
      <div className="relative h-[100dvh] w-full">
        <TripMap trip={trip} className="h-full rounded-none" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex flex-col gap-3 p-3">
          <div className="pointer-events-auto flex items-start justify-between gap-3">
            <div className="inline-flex max-w-[min(100%,20rem)] flex-col rounded-2xl border border-white/20 bg-slate-950/80 px-3 py-2 text-white shadow-lg backdrop-blur-md">
              <span className="truncate text-sm font-semibold">{trip.name}</span>
              {status.start && status.end && (
                <span className="truncate text-xs text-white/75">{status.label}</span>
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-full border border-white/20 bg-white/95 shadow-lg backdrop-blur"
              onClick={onExitMapView}
            >
              <LayoutList className="mr-1.5 h-4 w-4" />
              Standard view
            </Button>
          </div>

          <MapGeocodeBanner
            geocodedCount={geocodedCount}
            canEdit={canEdit}
            onReviewLocations={onReviewLocations}
          />
        </div>
      </div>
    </div>
  );
};

export default MapTripView;
