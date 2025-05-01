import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, RentalCarEvent } from '@/types/eventTypes';
import { rentalCarEventSchema, RentalCarFormData } from '@/eventTypes/rentalCarSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface RentalCarFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: RentalCarEvent | null;
}

const RentalCarFormModal: React.FC<RentalCarFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const form = useForm<RentalCarFormData>({
    resolver: zodResolver(rentalCarEventSchema as z.ZodType<RentalCarFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        pickupDate: eventToEdit.startDate?.substring(0, 10) || '',
        pickupTime: eventToEdit.startDate?.substring(11, 16) || '',
        dropoffDate: eventToEdit.endDate?.substring(0, 10) || '',
        dropoffTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'rental_car',
        pickupDate: '',
        pickupTime: '',
        dropoffDate: '',
        dropoffTime: '',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const pickupDatePart = eventToEdit.startDate?.substring(0, 10) || '';
      const pickupTimePart = eventToEdit.startDate?.substring(11, 16) || '';
      const dropoffDatePart = eventToEdit.endDate?.substring(0, 10) || '';
      const dropoffTimePart = eventToEdit.endDate?.substring(11, 16) || '';
      console.log('RentalCarFormModal: Directly parsed values:', { pickupDatePart, pickupTimePart, dropoffDatePart, dropoffTimePart });
      form.reset({
        ...eventToEdit,
        pickupDate: pickupDatePart,
        pickupTime: pickupTimePart,
        dropoffDate: dropoffDatePart,
        dropoffTime: dropoffTimePart,
      });
    } else {
      // Reset form for new event
      form.reset({
        type: 'rental_car',
        carCompany: '',
        carType: '',
        pickupLocation: '',
        dropoffLocation: '',
        pickupDate: '',
        pickupTime: '',
        dropoffDate: '',
        dropoffTime: '',
        licensePlate: '',
        bookingReference: '',
        notes: '',
        status: 'exploring',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: RentalCarFormData) => {
    console.log("Raw RentalCar form data (strings):", data);
    let processedData: any = { ...data };

    // Construct naive ISO-like strings
    if (data.pickupDate && data.pickupTime) {
      processedData.startDate = `${data.pickupDate}T${data.pickupTime}:00`;
      console.log("RentalCarFormModal: Constructed naive ISO for startDate:", processedData.startDate);
    } else {
      processedData.startDate = undefined;
    }
    if (data.dropoffDate && data.dropoffTime) {
      processedData.endDate = `${data.dropoffDate}T${data.dropoffTime}:00`;
      console.log("RentalCarFormModal: Constructed naive ISO for endDate:", processedData.endDate);
    } else {
      processedData.endDate = undefined;
    }

    // Remove form-specific fields
    delete processedData.pickupDate;
    delete processedData.pickupTime;
    delete processedData.dropoffDate;
    delete processedData.dropoffTime;

    // Remove legacy fields if they existed
    // delete processedData.date;

    console.log("Processed RentalCar data to save (naive ISO):", processedData);
    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['rental_car'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'rental_car'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Rental Car form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default RentalCarFormModal; 