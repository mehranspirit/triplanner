import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Event } from '@/types/eventTypes';
import { GeocodePreviewResult, GeocodeSuggestion, TransportLocationApplyPayload } from '@/types/geocodingTypes';
import { api } from '@/services/api';
import { eventNeedsLocationConfirmation, eventNeedsGeocodeRetry } from '@/utils/eventLocation';
import { isDualEndpointTransportEvent } from '@/utils/transportLocation';

export interface LocationConfirmQueueItem {
  event: Event;
  previousEvent?: Event | null;
}

interface UseLocationConfirmQueueOptions {
  tripId: string | undefined;
  onTripUpdated: (events: Event[]) => void;
}

export const useLocationConfirmQueue = ({
  tripId,
  onTripUpdated,
}: UseLocationConfirmQueueOptions) => {
  const [queue, setQueue] = useState<LocationConfirmQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<GeocodePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const previewRequestId = useRef(0);

  const currentItem = queue[currentIndex] ?? null;

  const queuePosition = useMemo(() => ({
    current: currentIndex + 1,
    total: queue.length,
  }), [currentIndex, queue.length]);

  const advanceQueue = useCallback(() => {
    setPreview(null);
    setError(null);

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    setQueue([]);
    setCurrentIndex(0);
    setOpen(false);
  }, [currentIndex, queue.length]);

  const loadPreview = useCallback(async (event: Event) => {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const response = await api.geocodePreview(event);
      if (previewRequestId.current !== requestId) {
        return;
      }
      setPreview(response);
    } catch (previewError) {
      if (previewRequestId.current !== requestId) {
        return;
      }
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Failed to load location suggestions',
      );
    } finally {
      if (previewRequestId.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open || !currentItem?.event) {
      return;
    }

    void loadPreview(currentItem.event);
  }, [open, currentItem?.event.id, loadPreview]);

  const enqueue = useCallback((items: LocationConfirmQueueItem | LocationConfirmQueueItem[]) => {
    const incoming = Array.isArray(items) ? items : [items];
    const pending = incoming.filter(({ event, previousEvent }) => (
      eventNeedsLocationConfirmation(event, previousEvent)
    ));

    if (pending.length === 0) {
      return;
    }

    setQueue((existing) => [...existing, ...pending]);
    setOpen(true);
  }, []);

  const enqueueSavedEvents = useCallback((
    savedEvents: Event[],
    previousEventsById?: Map<string, Event>,
  ) => {
    enqueue(savedEvents.map((event) => ({
      event,
      previousEvent: previousEventsById?.get(event.id) ?? null,
    })));
  }, [enqueue]);

  const startUnresolvedReview = useCallback((events: Event[]) => {
    const pending = events
      .filter(eventNeedsGeocodeRetry)
      .map((event) => ({ event, previousEvent: event }));

    if (pending.length === 0) {
      return false;
    }

    setQueue(pending);
    setCurrentIndex(0);
    setPreview(null);
    setError(null);
    setOpen(true);
    return true;
  }, []);

  const buildLocationPayload = (suggestion: GeocodeSuggestion) => ({
    lat: suggestion.lat,
    lng: suggestion.lng,
    address: suggestion.displayName,
    displayName: suggestion.displayName,
    query: suggestion.query,
    confidence: suggestion.confidence,
    quality: suggestion.quality,
    source: 'geocoded' as const,
  });

  const handleConfirm = useCallback(async (suggestion: GeocodeSuggestion) => {
    if (!tripId || !currentItem?.event) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const result = await api.applyEventLocation(
        tripId,
        currentItem.event.id,
        buildLocationPayload(suggestion),
      );

      onTripUpdated(result.trip.events);
      advanceQueue();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Failed to save confirmed location',
      );
    } finally {
      setApplying(false);
    }
  }, [advanceQueue, currentItem?.event, onTripUpdated, tripId]);

  const handleConfirmTransport = useCallback(async (selection: {
    departure?: GeocodeSuggestion;
    arrival?: GeocodeSuggestion;
  }) => {
    if (!tripId || !currentItem?.event || !isDualEndpointTransportEvent(currentItem.event)) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const payload: TransportLocationApplyPayload = {};
      if (selection.departure) {
        payload.departure = buildLocationPayload(selection.departure);
      }
      if (selection.arrival) {
        payload.arrival = buildLocationPayload(selection.arrival);
      }

      const result = await api.applyEventLocation(
        tripId,
        currentItem.event.id,
        payload,
      );

      onTripUpdated(result.trip.events);
      advanceQueue();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Failed to save confirmed locations',
      );
    } finally {
      setApplying(false);
    }
  }, [advanceQueue, currentItem?.event, onTripUpdated, tripId]);

  const handleSkip = useCallback(() => {
    advanceQueue();
  }, [advanceQueue]);

  const handleRetry = useCallback(() => {
    if (currentItem?.event) {
      void loadPreview(currentItem.event);
    }
  }, [currentItem?.event, loadPreview]);

  return {
    open,
    setOpen,
    currentItem,
    preview,
    loading,
    error,
    applying,
    queuePosition,
    enqueue,
    enqueueSavedEvents,
    startUnresolvedReview,
    handleConfirm,
    handleConfirmTransport,
    handleSkip,
    handleRetry,
  };
};
