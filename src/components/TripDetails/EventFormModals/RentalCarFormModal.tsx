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
        cost: eventToEdit.cost ?? undefined,
        date: eventToEdit.date || '',
        pickupTime: eventToEdit.pickupTime || '',
        dropoffDate: eventToEdit.dropoffDate || '',
        dropoffTime: eventToEdit.dropoffTime || '',
    } : {
        type: 'rental_car',
        cost: undefined,
        date: '',
        pickupTime: '',
        dropoffDate: '',
        dropoffTime: '',
        status: 'confirmed',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const datePart = eventToEdit.date || '';
      const pickupTimePart = eventToEdit.pickupTime || '';
      const dropoffDatePart = eventToEdit.dropoffDate || '';
      const dropoffTimePart = eventToEdit.dropoffTime || '';
      
      console.log('RentalCarFormModal: Parsed values:', { 
        datePart, 
        pickupTimePart, 
        dropoffDatePart, 
        dropoffTimePart,
        eventToEdit 
      });
      
      form.reset({
        ...eventToEdit,
        cost: eventToEdit.cost ?? undefined,
        date: datePart,
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
        date: '',
        pickupTime: '',
        dropoffDate: '',
        dropoffTime: '',
        licensePlate: '',
        bookingReference: '',
        notes: '',
        status: 'confirmed',
        cost: undefined,
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: RentalCarFormData) => {
    console.log("Raw RentalCar form data (strings):", data);
    const processedData: any = { ...data };

    // Map form fields to database fields
    processedData.date = data.date;
    processedData.pickupTime = data.pickupTime;
    processedData.dropoffDate = data.dropoffDate;
    processedData.dropoffTime = data.dropoffTime;

    console.log("Processed RentalCar data to save:", processedData);
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