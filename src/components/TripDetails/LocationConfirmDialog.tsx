import React, { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Loader2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/eventTypes';
import {
  GeocodeEndpointPreview,
  GeocodePreviewResult,
  GeocodeSuggestion,
  GeocodeTransportPreviewResponse,
  isTransportGeocodePreview,
} from '@/types/geocodingTypes';
import { getEventDisplayName } from '@/utils/eventTime';
import { cn } from '@/lib/utils';
import GeocodePreviewMap, { MapPreviewMarker } from '@/components/TripDetails/GeocodePreviewMap';
import { getTransportEndpointInfo } from '@/utils/transportLocation';

interface LocationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  preview: GeocodePreviewResult | null;
  loading: boolean;
  error: string | null;
  queuePosition?: { current: number; total: number };
  applying?: boolean;
  onConfirm: (suggestion: GeocodeSuggestion) => void;
  onConfirmTransport?: (selection: {
    departure?: GeocodeSuggestion;
    arrival?: GeocodeSuggestion;
  }) => void;
  onSkip: () => void;
  onRetry?: () => void;
}

const formatConfidence = (confidence: number) => `${Math.round(confidence * 100)}%`;

const getSuggestionKey = (suggestion: GeocodeSuggestion) => (
  `${suggestion.lat},${suggestion.lng},${suggestion.query}`
);

const EndpointSuggestionSection: React.FC<{
  endpointPreview: GeocodeEndpointPreview;
  selectedSuggestion: GeocodeSuggestion | null;
  onSelect: (suggestion: GeocodeSuggestion) => void;
}> = ({ endpointPreview, selectedSuggestion, onSelect }) => {
  const suggestions = endpointPreview.suggestions;

  if (!endpointPreview.query) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No {endpointPreview.label.toLowerCase()} text on this event.
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">{endpointPreview.label}</p>
        <p className="mt-1">No matches found for &ldquo;{endpointPreview.query}&rdquo;.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-900">{endpointPreview.label}</p>
        <p className="text-xs text-slate-500">
          {endpointPreview.queriesTried
            ? `Checked ${endpointPreview.queriesTried} ${endpointPreview.queriesTried === 1 ? 'query' : 'queries'}.`
            : `Matched from "${endpointPreview.query}".`}
        </p>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => {
          const key = getSuggestionKey(suggestion);
          const isSelected = selectedSuggestion === suggestion;

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(suggestion)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-teal-300 bg-teal-50/80 ring-1 ring-teal-200'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {suggestion.displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Matched from &ldquo;{suggestion.query}&rdquo;
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-1 text-[11px] font-medium',
                    suggestion.quality === 'exact'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800',
                  )}>
                    {formatConfidence(suggestion.confidence)}
                  </span>
                </div>
                {suggestion.recommended && (
                  <p className="mt-2 text-xs font-medium text-teal-700">Recommended</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const LocationConfirmDialog: React.FC<LocationConfirmDialogProps> = ({
  open,
  onOpenChange,
  event,
  preview,
  loading,
  error,
  queuePosition,
  applying = false,
  onConfirm,
  onConfirmTransport,
  onSkip,
  onRetry,
}) => {
  const isTransport = isTransportGeocodePreview(preview);
  const transportPreview = isTransport ? preview as GeocodeTransportPreviewResponse : null;

  const singleSuggestions = !isTransport ? preview?.suggestions ?? [] : [];
  const singleRecommended = !isTransport ? preview?.recommended ?? singleSuggestions[0] ?? null : null;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [departureSelection, setDepartureSelection] = useState<GeocodeSuggestion | null>(null);
  const [arrivalSelection, setArrivalSelection] = useState<GeocodeSuggestion | null>(null);

  const selectedSuggestion = useMemo(() => {
    if (singleSuggestions.length === 0) {
      return null;
    }

    if (selectedKey) {
      const match = singleSuggestions.find((suggestion) => getSuggestionKey(suggestion) === selectedKey);
      if (match) {
        return match;
      }
    }

    return singleRecommended;
  }, [selectedKey, singleRecommended, singleSuggestions]);

  useEffect(() => {
    if (!open) {
      setSelectedKey(null);
      setDepartureSelection(null);
      setArrivalSelection(null);
      return;
    }

    if (singleRecommended) {
      setSelectedKey(getSuggestionKey(singleRecommended));
    }

    if (transportPreview) {
      setDepartureSelection(transportPreview.departure.recommended);
      setArrivalSelection(transportPreview.arrival.recommended);
    }
  }, [
    open,
    singleRecommended,
    transportPreview?.departure.recommended,
    transportPreview?.arrival.recommended,
  ]);

  const progressLabel = queuePosition && queuePosition.total > 1
    ? `Event ${queuePosition.current} of ${queuePosition.total}`
    : undefined;

  const transportMarkers = useMemo<MapPreviewMarker[]>(() => {
    if (!isTransport) {
      return [];
    }

    const markers: MapPreviewMarker[] = [];
    if (departureSelection) {
      markers.push({
        lat: departureSelection.lat,
        lng: departureSelection.lng,
        variant: 'departure',
      });
    }
    if (arrivalSelection) {
      markers.push({
        lat: arrivalSelection.lat,
        lng: arrivalSelection.lng,
        variant: 'arrival',
      });
    }
    return markers;
  }, [arrivalSelection, departureSelection, isTransport]);

  const transportEndpointInfo = event ? getTransportEndpointInfo(event) : null;

  const canConfirmTransport = !!transportPreview && (
    (!transportPreview.departure.query || !!departureSelection)
    && (!transportPreview.arrival.query || !!arrivalSelection)
    && (!!departureSelection || !!arrivalSelection)
  );

  const handleTransportConfirm = () => {
    if (!onConfirmTransport) {
      return;
    }

    onConfirmTransport({
      departure: departureSelection ?? undefined,
      arrival: arrivalSelection ?? undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0',
        isTransport ? 'sm:max-w-2xl' : 'sm:max-w-lg',
      )}>
        <DialogHeader className="space-y-2 border-b px-6 py-5 pr-14 text-left">
          <div className="flex items-center gap-2 text-teal-700">
            <MapPin className="h-5 w-5" />
            <DialogTitle>{isTransport ? 'Confirm route locations' : 'Confirm location'}</DialogTitle>
          </div>
          {event && (
            <DialogDescription className="text-left">
              {progressLabel ? `${progressLabel} · ` : ''}
              {getEventDisplayName(event)}
              <span className="mt-1 block text-xs capitalize text-slate-500">
                {event.type.replace('_', ' ')}
                {isTransport && transportEndpointInfo && (
                  <>
                    {' · '}
                    {[transportEndpointInfo.departureQuery, transportEndpointInfo.arrivalQuery]
                      .filter(Boolean)
                      .join(' → ')}
                  </>
                )}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up location matches…
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3">
              <div className="flex items-start gap-2 text-sm text-rose-800">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
              {onRetry && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          )}

          {!loading && !error && isTransport && transportPreview && (
            <div className="space-y-4">
              <div className="h-44 overflow-hidden rounded-xl border">
                <GeocodePreviewMap markers={transportMarkers} className="h-full w-full" />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
                  A = {transportPreview.departure.label}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
                  B = {transportPreview.arrival.label}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <EndpointSuggestionSection
                  endpointPreview={transportPreview.departure}
                  selectedSuggestion={departureSelection}
                  onSelect={setDepartureSelection}
                />
                <EndpointSuggestionSection
                  endpointPreview={transportPreview.arrival}
                  selectedSuggestion={arrivalSelection}
                  onSelect={setArrivalSelection}
                />
              </div>
            </div>
          )}

          {!loading && !error && !isTransport && singleSuggestions.length === 0 && (
            <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">No location matches found</p>
              <p className="text-amber-800">
                You can skip for now and fix the location later from the event card.
              </p>
            </div>
          )}

          {!loading && !error && !isTransport && selectedSuggestion && (
            <div className="space-y-4">
              <div className="h-40 overflow-hidden rounded-xl border">
                <GeocodePreviewMap
                  lat={selectedSuggestion.lat}
                  lng={selectedSuggestion.lng}
                  className="h-full w-full"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">Choose a match</p>
                <p className="mt-1 text-xs text-slate-500">
                  {preview && 'queriesTried' in preview && preview.queriesTried
                    ? `Checked ${preview.queriesTried} location ${preview.queriesTried === 1 ? 'query' : 'queries'}.`
                    : 'Select the best match for this event.'}
                </p>
              </div>

              <ul className="space-y-2">
                {singleSuggestions.map((suggestion) => {
                  const key = getSuggestionKey(suggestion);
                  const isSelected = selectedSuggestion === suggestion;

                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={cn(
                          'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-teal-300 bg-teal-50/80 ring-1 ring-teal-200'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {suggestion.displayName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Matched from &ldquo;{suggestion.query}&rdquo;
                            </p>
                          </div>
                          <span className={cn(
                            'shrink-0 rounded-full px-2 py-1 text-[11px] font-medium',
                            suggestion.quality === 'exact'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800',
                          )}>
                            {formatConfidence(suggestion.confidence)}
                          </span>
                        </div>
                        {suggestion.recommended && (
                          <p className="mt-2 text-xs font-medium text-teal-700">Recommended</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={loading || applying}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isTransport) {
                handleTransportConfirm();
                return;
              }
              if (selectedSuggestion) {
                onConfirm(selectedSuggestion);
              }
            }}
            disabled={
              loading
              || applying
              || (isTransport ? !canConfirmTransport : !selectedSuggestion)
            }
          >
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              isTransport ? 'Confirm locations' : 'Confirm location'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocationConfirmDialog;
