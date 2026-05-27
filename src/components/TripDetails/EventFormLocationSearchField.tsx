import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { EventFormLocationSearch } from '@/components/TripDetails/EventLocationSearch';
import { applyPickedLocationToForm } from '@/components/TripDetails/eventFormLocationHelpers';

interface EventFormLocationSearchFieldProps {
  form: UseFormReturn<any>;
}

const EventFormLocationSearchField: React.FC<EventFormLocationSearchFieldProps> = ({ form }) => {
  const address = form.watch('address');
  const location = form.watch('location');

  return (
    <EventFormLocationSearch
      address={address}
      location={location}
      onLocationPick={(picked) => applyPickedLocationToForm(form, picked)}
    />
  );
};

export default EventFormLocationSearchField;
