import React from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapViewSuggestPromptProps {
  onTryMapView: () => void;
  onDismiss: () => void;
}

const MapViewSuggestPrompt: React.FC<MapViewSuggestPromptProps> = ({
  onTryMapView,
  onDismiss,
}) => (
  <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-blue-100 p-2 text-blue-700">
        <MapIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">Try map view?</p>
        <p className="mt-1 text-sm text-slate-600">
          Get a full-screen map of your trip with the itinerary in a bottom sheet.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="rounded-full" onClick={onTryMapView}>
            Switch to map
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="rounded-full p-1 text-slate-400 hover:bg-white/80 hover:text-slate-600"
        aria-label="Dismiss map view suggestion"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  </div>
);

export default MapViewSuggestPrompt;
