import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType } from '@/types/eventTypes';
import { StayEvent } from '@/types/eventTypes';
import { stayEventSchema, StayFormData } from '@/eventTypes/staySpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface StayFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: StayEvent | null;
}

const StayFormModal: React.FC<StayFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const form = useForm<StayFormData>({
    resolver: zodResolver(stayEventSchema as z.ZodType<StayFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        // Map database fields to form fields
        checkInDate: eventToEdit.checkIn || '',
        checkInTime: eventToEdit.checkInTime || '14:00', // Use stored time or default
        checkOutDate: eventToEdit.checkOut || '',
        checkOutTime: eventToEdit.checkOutTime || '11:00', // Use stored time or default
    } : {
        type: 'stay',
        checkInDate: '',
        checkInTime: '14:00', // Default check-in time
        checkOutDate: '',
        checkOutTime: '11:00', // Default check-out time
        status: 'exploring',
    },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (eventToEdit) {
      console.log('StayFormModal: Setting form values:', { 
        checkIn: eventToEdit.checkIn,
        checkInTime: eventToEdit.checkInTime,
        checkOut: eventToEdit.checkOut,
        checkOutTime: eventToEdit.checkOutTime,
        eventToEdit 
      });
      
      form.reset({
        ...eventToEdit,
        checkInDate: eventToEdit.checkIn || '',
        checkInTime: eventToEdit.checkInTime || '14:00',
        checkOutDate: eventToEdit.checkOut || '',
        checkOutTime: eventToEdit.checkOutTime || '11:00',
      });
    } else {
      // Reset with empty strings and defaults for new event
      form.reset({
        type: 'stay',
        accommodationName: '',
        address: '',
        checkInDate: '',
        checkInTime: '14:00',
        checkOutDate: '',
        checkOutTime: '11:00',
        notes: '',
        status: 'exploring',
        reservationNumber: '',
        contactInfo: '',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: StayFormData) => {
    console.log("Raw Stay form data (strings):", data);
    let processedData: any = { ...data };

    // Map form fields to database fields
    if (data.checkInDate) {
      processedData.checkIn = data.checkInDate;
      processedData.checkInTime = data.checkInTime;
      processedData.startDate = `${data.checkInDate}T${data.checkInTime}:00`;
    }
    
    if (data.checkOutDate) {
      processedData.checkOut = data.checkOutDate;
      processedData.checkOutTime = data.checkOutTime;
      processedData.endDate = `${data.checkOutDate}T${data.checkOutTime}:00`;
    }

    // Remove only the date fields that were mapped
    delete processedData.checkInDate;
    delete processedData.checkOutDate;

    console.log("Processed Stay data to save:", processedData);
    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['stay'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'stay'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Stay form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default StayFormModal; 