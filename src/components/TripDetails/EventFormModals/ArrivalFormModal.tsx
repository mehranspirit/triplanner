import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, ArrivalDepartureEvent } from '@/types/eventTypes';
import { arrivalEventSchema, ArrivalFormData } from '@/eventTypes/arrivalSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface ArrivalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: ArrivalDepartureEvent & { type: 'arrival' };
}

const ArrivalFormModal: React.FC<ArrivalFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  // Log the received eventToEdit prop
  console.log('ArrivalFormModal received eventToEdit:', eventToEdit);

  const form = useForm<ArrivalFormData>({
    resolver: zodResolver(arrivalEventSchema as z.ZodType<ArrivalFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        // Map database date/time to form fields
        arrivalDate: eventToEdit.date || '',
        arrivalTime: eventToEdit.time || '',
    } : {
        type: 'arrival',
        arrivalDate: '',
        arrivalTime: '',
        status: 'exploring',
    },
  });

  useEffect(() => {
    // Log inside useEffect before processing
    console.log('ArrivalFormModal useEffect, eventToEdit:', eventToEdit);
    if (eventToEdit) {
      // Use the arrivalDate and arrivalTime directly from the database
      console.log('Using database date/time fields:', {
        date: eventToEdit.date || '',
        time: eventToEdit.time || '',
      });
      
      form.reset({
        ...eventToEdit,
        // Map database date/time to form fields
        arrivalDate: eventToEdit.date || '',
        arrivalTime: eventToEdit.time || '',
      });
    } else {
      form.reset({
        type: 'arrival',
        airport: '',
        arrivalDate: '',
        arrivalTime: '',
        notes: '',
        status: 'exploring',
        flightNumber: '',
        airline: '',
        terminal: '',
        gate: '',
        bookingReference: '',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: ArrivalFormData) => {
    console.log("Raw Arrival form data (strings):", JSON.stringify(data));
    
    // Create a copy of the form data
    let processedData: any = { ...data };
    
    // Map form fields to database fields
    processedData.date = data.arrivalDate || '';
    processedData.time = data.arrivalTime || '';
    
    // Set startDate and endDate for calendar and timeline view compatibility
    if (data.arrivalDate && data.arrivalTime) {
      const naiveISOString = `${data.arrivalDate}T${data.arrivalTime}:00`;
      processedData.startDate = naiveISOString;
      processedData.endDate = naiveISOString;
    } else {
      processedData.startDate = '';
      processedData.endDate = '';
    }

    // Preserve all other fields
    processedData.airport = data.airport || '';
    processedData.flightNumber = data.flightNumber || '';
    processedData.airline = data.airline || '';
    processedData.terminal = data.terminal || '';
    processedData.gate = data.gate || '';
    processedData.bookingReference = data.bookingReference || '';
    processedData.notes = data.notes || '';
    processedData.status = data.status;
    if (data.location) {
      processedData.location = data.location;
    }
    if (data.thumbnailUrl) {
      processedData.thumbnailUrl = data.thumbnailUrl;
    }
    if (data.source) {
      processedData.source = data.source;
    }

    // Remove the UI-specific fields that aren't in the database schema
    delete processedData.arrivalDate;
    delete processedData.arrivalTime;

    console.log("Final processed data to save:", JSON.stringify(processedData));
    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['arrival'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'arrival'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Arrival form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default ArrivalFormModal; 