import React, { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EventLocationSearch from '@/components/TripDetails/EventLocationSearch';
import { Event, Trip } from '@/types/eventTypes';
import { PlaceDetailsResult } from '@/types/geocodingTypes';
import { EXPLORING_EVENT_UI_LABEL } from '@/utils/eventStatusLabels';
import {
  buildEventDraftFromPlace,
  inferActivityTypeFromPlaceTypes,
  inferPlaceEventType,
  isLodgingPlace,
  NewPlaceEventPayload,
  PlaceAddEventType,
} from '@/utils/buildEventDraftFromPlace';
import { resolveDefaultPlaceEventDate, resolveTripLocationBias } from '@/utils/tripLocationBias';

type PlaceAddStep = 'search' | 'confirm';

interface PlaceAddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  activeDayKey?: string;
  defaultDate?: string;
  onAdd: (event: NewPlaceEventPayload) => Promise<void>;
}

const PlaceAddEventDialog: React.FC<PlaceAddEventDialogProps> = ({
  open,
  onOpenChange,
  trip,
  activeDayKey,
  defaultDate,
  onAdd,
}) => {
  const [step, setStep] = useState<PlaceAddStep>('search');
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetailsResult | null>(null);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<PlaceAddEventType>('activity');
  const [activityType, setActivityType] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [status, setStatus] = useState<Event['status']>('exploring');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationBias = resolveTripLocationBias(trip, activeDayKey);

  useEffect(() => {
    if (!open) {
      setStep('search');
      setSelectedPlace(null);
      setName('');
      setEventType('activity');
      setActivityType('');
      setDate('');
      setStartTime('10:00');
      setEndTime('12:00');
      setStatus('exploring');
      setIsAdding(false);
      setError(null);
      return;
    }

    setDate(
      defaultDate
      || resolveDefaultPlaceEventDate(trip, activeDayKey),
    );
  }, [open, trip, activeDayKey, defaultDate]);

  const handlePlacePick = async (_picked: unknown, details: PlaceDetailsResult) => {
    setError(null);
    setSelectedPlace(details);
    setName(details.name);
    setEventType(inferPlaceEventType(details.types));
    setActivityType(inferActivityTypeFromPlaceTypes(details.types));
    setStep('confirm');
  };

  const handleBack = () => {
    setStep('search');
    setSelectedPlace(null);
    setError(null);
  };

  const handleAdd = async () => {
    if (!selectedPlace || !date.trim()) {
      setError('Pick a place and date before adding.');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const eventData = buildEventDraftFromPlace({
        place: selectedPlace,
        eventType,
        name,
        activityType: eventType === 'activity' ? activityType : undefined,
        date,
        startTime,
        endTime,
        status,
      });

      await onAdd(eventData);
      onOpenChange(false);
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Failed to add place to itinerary',
      );
    } finally {
      setIsAdding(false);
    }
  };

  const lodgingWarning = selectedPlace && isLodgingPlace(selectedPlace.types);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] md:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' ? 'Search a place' : 'Add to itinerary'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search'
              ? 'Find restaurants, attractions, and other spots on Google Maps.'
              : 'Review details before adding this place as a draft event.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'search' ? (
          <div className="space-y-3">
            <EventLocationSearch
              locationBias={locationBias}
              onPick={handlePlacePick}
            />
            {locationBias && (
              <p className="text-xs text-muted-foreground">
                Results are biased toward your trip area.
              </p>
            )}
          </div>
        ) : (
          selectedPlace && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-slate-900">{selectedPlace.name}</p>
                    <p className="text-xs text-slate-500">{selectedPlace.formattedAddress}</p>
                    {selectedPlace.website && (
                      <a
                        href={selectedPlace.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-block text-xs text-teal-700 hover:underline"
                      >
                        {selectedPlace.website}
                      </a>
                    )}
                    {selectedPlace.contactInfo
                      && selectedPlace.contactInfo !== selectedPlace.website && (
                      <p className="text-xs text-slate-600">{selectedPlace.contactInfo}</p>
                    )}
                    {selectedPlace.openingHours && (
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600">
                        {selectedPlace.openingHours}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {lodgingWarning && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This looks like lodging. For hotels with check-in and check-out dates, use
                  {' '}
                  <span className="font-medium">Manual entry → Stay</span>
                  .
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="place-event-name">Name</Label>
                <Input
                  id="place-event-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event type</Label>
                  <Select
                    value={eventType}
                    onValueChange={(value) => setEventType(value as PlaceAddEventType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activity">Activity</SelectItem>
                      <SelectItem value="destination">Destination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as Event['status'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exploring">{EXPLORING_EVENT_UI_LABEL}</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="alternative">Alternative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {eventType === 'activity' && (
                <div className="space-y-2">
                  <Label htmlFor="place-activity-type">Activity type</Label>
                  <Input
                    id="place-activity-type"
                    value={activityType}
                    onChange={(event) => setActivityType(event.target.value)}
                    placeholder="e.g., Dining, Sightseeing"
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="place-event-date">Date</Label>
                  <Input
                    id="place-event-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place-start-time">Start</Label>
                  <Input
                    id="place-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place-end-time">End</Label>
                  <Input
                    id="place-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )
        )}

        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack} disabled={isAdding}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void handleAdd()}
                disabled={isAdding || !name.trim() || !date.trim()}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  'Add to itinerary'
                )}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlaceAddEventDialog;
