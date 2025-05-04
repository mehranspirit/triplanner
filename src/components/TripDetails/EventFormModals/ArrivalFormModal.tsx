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
    defaultValues: {
      type: 'arrival',
      arrivalDate: '',
      arrivalTime: '',
      status: 'exploring',
    },
  });

  useEffect(() => {
    if (isOpen && eventToEdit) {
      console.log('ArrivalFormModal: Resetting form with event data:', eventToEdit);
      form.reset({
        ...eventToEdit,
        arrivalDate: eventToEdit.date || '',
        arrivalTime: eventToEdit.time || '',
      });
    } else if (isOpen) {
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
  }, [isOpen, eventToEdit?.id]); // Only reset when modal opens or eventToEdit changes

  const onSubmit = (data: ArrivalFormData) => {
    console.log("ArrivalFormModal onSubmit called with data:", data);
    
    // Create a copy of the form data
    const processedData: any = { ...data };
    
    // Map form fields to database fields - ensure these match the ArrivalDepartureEvent type
    processedData.date = data.arrivalDate;
    processedData.time = data.arrivalTime;
    
    // Set startDate and endDate for calendar and timeline view compatibility
    if (data.arrivalDate && data.arrivalTime) {
      // Ensure proper format for ISO string
      const naiveISOString = `${data.arrivalDate}T${data.arrivalTime}:00`;
      processedData.startDate = naiveISOString;
      processedData.endDate = naiveISOString;
      console.log("Created ISO strings:", { 
        startDate: processedData.startDate, 
        endDate: processedData.endDate 
      });
    } else {
      // Provide fallback empty strings to avoid validation issues
      processedData.startDate = "";
      processedData.endDate = "";
    }

    // Remove the UI-specific fields that aren't in the database schema
    delete processedData.arrivalDate;
    delete processedData.arrivalTime;

    // If editing, preserve the event ID and other metadata
    if (eventToEdit) {
      processedData.id = eventToEdit.id;
      // Preserve timestamps and user data
      processedData.createdAt = eventToEdit.createdAt;
      processedData.createdBy = eventToEdit.createdBy;
      processedData.updatedAt = new Date().toISOString();
      processedData.updatedBy = eventToEdit.updatedBy;
      processedData.likes = eventToEdit.likes || [];
      processedData.dislikes = eventToEdit.dislikes || [];
    }

    console.log("Final processed data to save:", processedData);
    
    try {
      onSave(processedData);
      console.log("ArrivalFormModal: onSave called successfully");
      onClose();
      console.log("ArrivalFormModal: onClose called");
    } catch (error) {
      console.error("ArrivalFormModal: Error in onSave/onClose:", error);
    }
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