import React, { useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { Event } from '@/types/eventTypes';
import { PickedEventLocation } from '@/types/geocodingTypes';
import EventLocationSearch, { buildPickedEventLocation } from '@/components/TripDetails/EventLocationSearch';
import { applyPickedTransportLocationToForm, buildEndpointLocationFromPick } from '@/components/TripDetails/eventFormLocationHelpers';
import {
  endpointLocationHasCoordinates,
  getTransportEndpointInfo,
  getTransportEndpointLocation,
  TransportEvent,
} from '@/utils/transportLocation';

type TransportEndpoint = 'departure' | 'arrival';

const toPreviewEvent = (event: Event): TransportEvent => event as TransportEvent;

interface TransportLocationSearchPanelProps {
  event: Event;
  compact?: boolean;
  onPick: (endpoint: TransportEndpoint, location: PickedEventLocation) => void | Promise<void>;
}

export const TransportLocationSearchPanel: React.FC<TransportLocationSearchPanelProps> = ({
  event,
  compact = false,
  onPick,
}) => {
  const [activeEndpoint, setActiveEndpoint] = useState<TransportEndpoint>('departure');
  const endpointInfo = getTransportEndpointInfo(event);
  const transportEvent = toPreviewEvent(event);

  const endpoints = useMemo(() => ([
    {
      id: 'departure' as const,
      label: endpointInfo.departureLabel,
      query: endpointInfo.departureQuery,
      location: transportEvent.departureLocation,
    },
    {
      id: 'arrival' as const,
      label: endpointInfo.arrivalLabel,
      query: endpointInfo.arrivalQuery,
      location: transportEvent.arrivalLocation,
    },
  ]), [endpointInfo, transportEvent.arrivalLocation, transportEvent.departureLocation]);

  const active = endpoints.find((entry) => entry.id === activeEndpoint) ?? endpoints[0];
  const locationBias = active.location && endpointLocationHasCoordinates(active.location)
    ? { lat: active.location.lat, lng: active.location.lng }
    : undefined;

  return (
    <div className={cn('space-y-3', compact ? 'w-[min(100vw-2rem,22rem)]' : '')}>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        {endpoints.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setActiveEndpoint(entry.id)}
            className={cn(
              'rounded-md px-3 py-2 text-left text-xs font-medium transition-colors',
              activeEndpoint === entry.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <span className="block">{entry.label}</span>
            {entry.location?.address && (
              <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500">
                {entry.location.address}
              </span>
            )}
          </button>
        ))}
      </div>

      <EventLocationSearch
        key={`${event.id}-${activeEndpoint}-${active.query || ''}`}
        compact={compact}
        initialQuery={active.query || active.location?.address || ''}
        currentAddress={active.location?.address}
        locationBias={locationBias}
        onPick={async (picked) => {
          await onPick(activeEndpoint, picked);
        }}
      />
    </div>
  );
};

interface EventFormTransportLocationSearchFieldProps {
  form: UseFormReturn<any>;
}

export const EventFormTransportLocationSearchField: React.FC<EventFormTransportLocationSearchFieldProps> = ({
  form,
}) => {
  const formValues = form.watch();
  const previewEvent = {
    ...formValues,
    type: formValues.type,
  } as Event;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Search route locations on Google Maps</p>
        <p className="text-xs text-muted-foreground">
          Pick results for each endpoint to set coordinates and skip automatic geocoding for that side.
        </p>
      </div>
      <TransportLocationSearchPanel
        event={previewEvent}
        onPick={(endpoint, picked) => {
          applyPickedTransportLocationToForm(form, endpoint, picked);
        }}
      />
    </div>
  );
};

interface TransportLocationQuickActionProps {
  tripId: string;
  event: Event;
  onApplied: (events: Event[]) => void;
}

export const TransportLocationQuickAction: React.FC<TransportLocationQuickActionProps> = ({
  tripId,
  event,
  onApplied,
}) => {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (endpoint: TransportEndpoint, picked: PickedEventLocation) => {
    setApplying(true);
    setError(null);

    try {
      const payload = endpoint === 'departure'
        ? { departure: buildEndpointLocationFromPick(picked) }
        : { arrival: buildEndpointLocationFromPick(picked) };

      const result = await api.applyEventLocation(tripId, event.id, payload);
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

  const departureConfirmed = endpointLocationHasCoordinates(getTransportEndpointLocation(event, 'departure'));
  const arrivalConfirmed = endpointLocationHasCoordinates(getTransportEndpointLocation(event, 'arrival'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg transition-colors duration-200 hover:bg-slate-50"
          title="Search route locations"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <MapPin className={cn(
            'h-4 w-4',
            departureConfirmed && arrivalConfirmed ? 'text-teal-600' : 'text-amber-600',
          )} />
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
          <p className="text-sm font-medium text-slate-900">Search route locations</p>
          <p className="text-xs text-muted-foreground">
            Choose From or To, then pick a Google Maps result to update that endpoint.
          </p>
        </div>
        <TransportLocationSearchPanel
          compact
          event={event}
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

export { buildPickedEventLocation };
