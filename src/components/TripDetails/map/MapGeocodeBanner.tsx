import React from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapGeocodeBannerProps {
  geocodedCount: number;
  canEdit?: boolean;
  onReviewLocations?: () => void;
}

const MapGeocodeBanner: React.FC<MapGeocodeBannerProps> = ({
  geocodedCount,
  canEdit,
  onReviewLocations,
}) => {
  if (geocodedCount >= 2) return null;

  return (
    <div className="pointer-events-auto rounded-2xl border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-950 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-semibold">Map view needs more locations.</span>{' '}
            Add map pins to at least two events for a useful route view.
          </span>
        </p>
        {canEdit && onReviewLocations && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full border-sky-300"
            onClick={onReviewLocations}
          >
            Review locations
          </Button>
        )}
      </div>
    </div>
  );
};

export default MapGeocodeBanner;
