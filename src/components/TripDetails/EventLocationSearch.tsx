import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import {
  PickedEventLocation,
  PlaceAutocompleteResult,
  PlaceDetailsResult,
} from '@/types/geocodingTypes';
import { Event } from '@/types/eventTypes';
import { createPlacesSessionToken } from '@/utils/placesSessionToken';

const SEARCH_DEBOUNCE_MS = 350;

export const buildPickedEventLocation = (
  details: {
    lat: number;
    lng: number;
    formattedAddress: string;
    placeId?: string;
    name?: string;
    website?: string;
    openingHours?: string;
    contactInfo?: string;
  },
): PickedEventLocation => ({
  lat: details.lat,
  lng: details.lng,
  address: details.formattedAddress,
  placeId: details.placeId,
  query: details.name || details.formattedAddress,
  source: 'google_places',
  quality: 'exact',
  confidence: 0.95,
  website: details.website,
  openingHours: details.openingHours,
  contactInfo: details.contactInfo,
});

interface EventLocationSearchProps {
  initialQuery?: string;
  currentAddress?: string;
  locationBias?: { lat: number; lng: number };
  compact?: boolean;
  onPick: (location: PickedEventLocation, details: PlaceDetailsResult) => void | Promise<void>;
}

const EventLocationSearch: React.FC<EventLocationSearchProps> = ({
  initialQuery = '',
  currentAddress,
  locationBias,
  compact = false,
  onPick,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlaceAutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingPlaceId, setApplyingPlaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const sessionTokenRef = useRef<string | null>(null);

  const resetSessionToken = () => {
    sessionTokenRef.current = null;
  };

  const ensureSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createPlacesSessionToken();
    }
    return sessionTokenRef.current;
  };

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      resetSessionToken();
      return;
    }

    const sessionToken = ensureSessionToken();

    setLoading(true);
    setError(null);

    debounceRef.current = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        const autocompleteResults = await api.placesAutocomplete(trimmed, {
          ...locationBias,
          sessionToken,
        });
        if (requestIdRef.current !== requestId) {
          return;
        }
        setResults(autocompleteResults);
      } catch (searchError) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setResults([]);
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'Failed to search places',
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query, locationBias?.lat, locationBias?.lng]);

  const handleSelect = async (result: PlaceAutocompleteResult) => {
    setApplyingPlaceId(result.placeId);
    setError(null);

    const sessionToken = sessionTokenRef.current;
    if (!sessionToken) {
      setError('Search session expired. Try typing again.');
      return;
    }

    try {
      const details = await api.placeDetails(result.placeId, sessionToken);
      const picked = buildPickedEventLocation(details);
      await onPick(picked, details);
      resetSessionToken();
      setQuery(picked.address);
      setResults([]);
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : 'Failed to load place details',
      );
    } finally {
      setApplyingPlaceId(null);
    }
  };

  const statusText = useMemo(() => {
    if (currentAddress) {
      return currentAddress;
    }
    return 'Search Google Maps to set a precise location.';
  }, [currentAddress]);

  return (
    <div className={cn('space-y-3', compact ? 'w-[min(100vw-2rem,22rem)]' : '')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Google Maps…"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {!compact && (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
          {results.map((result) => (
            <li key={result.placeId}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                disabled={applyingPlaceId !== null}
                onClick={() => void handleSelect(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{result.mainText}</p>
                    {result.secondaryText && (
                      <p className="text-xs text-slate-500">{result.secondaryText}</p>
                    )}
                  </div>
                  {applyingPlaceId === result.placeId && (
                    <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-slate-400" />
                  )}
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface EventFormLocationSearchProps {
  address?: string;
  location?: Event['location'];
  onLocationPick: (location: PickedEventLocation) => void;
}

export const EventFormLocationSearch: React.FC<EventFormLocationSearchProps> = ({
  address,
  location,
  onLocationPick,
}) => {
  const locationBias = location && location.lat !== 0 && location.lng !== 0
    ? { lat: location.lat, lng: location.lng }
    : undefined;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Search location on Google Maps</p>
        <p className="text-xs text-muted-foreground">
          Pick a result to set coordinates and skip automatic geocoding for this save.
        </p>
      </div>
      <EventLocationSearch
        initialQuery={address || location?.address || ''}
        currentAddress={location?.address}
        locationBias={locationBias}
        onPick={async (picked) => {
          onLocationPick(picked);
        }}
      />
    </div>
  );
};

interface EventLocationQuickActionProps {
  tripId: string;
  event: Event;
  onApplied: (events: Event[]) => void;
}

export const EventLocationQuickAction: React.FC<EventLocationQuickActionProps> = ({
  tripId,
  event,
  onApplied,
}) => {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialQuery = event.location?.address || '';
  const locationBias = event.location && event.location.lat !== 0 && event.location.lng !== 0
    ? { lat: event.location.lat, lng: event.location.lng }
    : undefined;

  const handlePick = async (picked: PickedEventLocation) => {
    setApplying(true);
    setError(null);

    try {
      const result = await api.applyEventLocation(tripId, event.id, {
        lat: picked.lat,
        lng: picked.lng,
        address: picked.address,
        displayName: picked.address,
        query: picked.query,
        confidence: picked.confidence,
        quality: picked.quality,
        source: picked.source,
        placeId: picked.placeId,
      });
      onApplied(result.trip.events);
      setOpen(false);
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Failed to update location',
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg transition-colors duration-200 hover:bg-slate-50"
          title="Search location"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <MapPin className="h-4 w-4 text-teal-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="center"
        side="bottom"
        sideOffset={8}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="mb-3">
          <p className="text-sm font-medium text-slate-900">Search location</p>
          <p className="text-xs text-muted-foreground">
            Pick a Google Maps result to update this event&apos;s coordinates.
          </p>
        </div>
        <EventLocationSearch
          compact
          initialQuery={initialQuery}
          currentAddress={event.location?.address}
          locationBias={locationBias}
          onPick={handlePick}
        />
        {applying && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving location…
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-rose-600">{error}</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default EventLocationSearch;
