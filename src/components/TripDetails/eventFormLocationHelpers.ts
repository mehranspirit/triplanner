import { UseFormReturn } from 'react-hook-form';
import { PickedEventLocation } from '@/types/geocodingTypes';
import { EventLocationPoint } from '@/utils/transportLocation';

export const buildEndpointLocationFromPick = (
  picked: PickedEventLocation,
): EventLocationPoint => ({
  lat: picked.lat,
  lng: picked.lng,
  address: picked.address,
  quality: picked.quality,
  source: picked.source,
  confidence: picked.confidence,
  placeId: picked.placeId,
  query: picked.query,
});

export const applyPickedLocationToForm = (
  form: UseFormReturn<any>,
  picked: PickedEventLocation,
) => {
  form.setValue('address', picked.address, { shouldDirty: true });
  form.setValue('location', buildEndpointLocationFromPick(picked), { shouldDirty: true });
  form.setValue('source', 'google_places', { shouldDirty: true });
};

export const applyPickedTransportLocationToForm = (
  form: UseFormReturn<any>,
  endpoint: 'departure' | 'arrival',
  picked: PickedEventLocation,
) => {
  const field = endpoint === 'departure' ? 'departureLocation' : 'arrivalLocation';
  form.setValue(field, buildEndpointLocationFromPick(picked), { shouldDirty: true });

  const eventType = form.getValues('type');
  const label = picked.address;
  if (!label?.trim()) {
    return;
  }

  if (endpoint === 'departure') {
    if (eventType === 'flight') {
      form.setValue('departureAirport', label, { shouldDirty: true });
    } else if (eventType === 'train' || eventType === 'bus') {
      form.setValue('departureStation', label, { shouldDirty: true });
    } else if (eventType === 'rental_car') {
      form.setValue('pickupLocation', label, { shouldDirty: true });
    }
    return;
  }

  if (eventType === 'flight') {
    form.setValue('arrivalAirport', label, { shouldDirty: true });
  } else if (eventType === 'train' || eventType === 'bus') {
    form.setValue('arrivalStation', label, { shouldDirty: true });
  } else if (eventType === 'rental_car') {
    form.setValue('dropoffLocation', label, { shouldDirty: true });
  }
};
