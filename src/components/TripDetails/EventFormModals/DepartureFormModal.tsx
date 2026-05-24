import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, ArrivalDepartureEvent } from '@/types/eventTypes';
import { departureEventSchema, DepartureFormData } from '@/eventTypes/departureSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface DepartureFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: ArrivalDepartureEvent & { type: 'departure' };
}

const DepartureFormModal: React.FC<DepartureFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  
  const form = useForm<DepartureFormData>({
    resolver: zodResolver(departureEventSchema as z.ZodType<DepartureFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        // Map database date/time to form fields
        departureDate: eventToEdit.date || '',
        departureTime: eventToEdit.time || '',
    } : {
        type: 'departure',
        departureDate: '',
        departureTime: '',
        status: 'confirmed',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      form.reset({
        ...eventToEdit,
        // Map database date/time to form fields
        departureDate: eventToEdit.date || '',
        departureTime: eventToEdit.time || '',
      });
    } else {
      // Reset with empty strings and defaults for new event
      form.reset({
        type: 'departure',
        airport: '',
        departureDate: '',
        departureTime: '',
        notes: '',
        status: 'confirmed',
        flightNumber: '',
        airline: '',
        terminal: '',
        gate: '',
        bookingReference: '',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: DepartureFormData) => {
    const processedData: any = { ...data };

    // Map form fields to database fields
    processedData.date = data.departureDate || '';
    processedData.time = data.departureTime || '';
    
    // Set startDate and endDate for calendar and timeline view compatibility
    if (data.departureDate && data.departureTime) {
      const naiveISOString = `${data.departureDate}T${data.departureTime}:00`;
      processedData.startDate = naiveISOString;
      processedData.endDate = naiveISOString;
    } else {
      processedData.startDate = '';
      processedData.endDate = '';
    }

    // Remove the UI-specific fields that aren't in the database schema
    delete processedData.departureDate;
    delete processedData.departureTime;

    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['departure'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'departure'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Departure form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default DepartureFormModal; 