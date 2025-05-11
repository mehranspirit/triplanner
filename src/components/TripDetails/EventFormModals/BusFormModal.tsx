import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, BusEvent } from '@/types/eventTypes';
import { busEventSchema, BusFormData } from '@/eventTypes/busSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface BusFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: BusEvent | null;
}

const BusFormModal: React.FC<BusFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  console.log('BusFormModal rendering, isOpen:', isOpen, 'eventToEdit:', eventToEdit);
  
  const form = useForm<BusFormData>({
    resolver: zodResolver(busEventSchema as z.ZodType<BusFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        cost: eventToEdit.cost ?? undefined,
        departureDate: eventToEdit.startDate?.substring(0, 10) || '',
        departureTime: eventToEdit.startDate?.substring(11, 16) || '',
        arrivalDate: eventToEdit.endDate?.substring(0, 10) || '',
        arrivalTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'bus',
        cost: undefined,
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
        status: 'confirmed',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const departureDatePart = eventToEdit.startDate?.substring(0, 10) || '';
      const departureTimePart = eventToEdit.startDate?.substring(11, 16) || '';
      const arrivalDatePart = eventToEdit.endDate?.substring(0, 10) || '';
      const arrivalTimePart = eventToEdit.endDate?.substring(11, 16) || '';
      console.log('BusFormModal: Directly parsed values for form reset:', { departureDatePart, departureTimePart, arrivalDatePart, arrivalTimePart });
      form.reset({
        ...eventToEdit,
        cost: eventToEdit.cost ?? undefined,
        departureDate: departureDatePart,
        departureTime: departureTimePart,
        arrivalDate: arrivalDatePart,
        arrivalTime: arrivalTimePart,
      });
    } else {
      // Reset with empty strings and defaults for new event
      form.reset({
        type: 'bus',
        busOperator: '',
        busNumber: '',
        departureStation: '',
        arrivalStation: '',
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
        seatNumber: '',
        bookingReference: '',
        notes: '',
        status: 'confirmed',
        cost: undefined,
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: BusFormData) => {
    console.log("BusFormModal: Raw Bus form data being submitted:", data);
    const processedData: any = { ...data };

    // Construct naive ISO-like strings
    if (data.departureDate && data.departureTime) {
      processedData.startDate = `${data.departureDate}T${data.departureTime}:00`;
      console.log("BusFormModal: Constructed naive ISO for startDate:", processedData.startDate);
    } else {
      processedData.startDate = undefined;
    }
    if (data.arrivalDate && data.arrivalTime) {
      processedData.endDate = `${data.arrivalDate}T${data.arrivalTime}:00`;
      console.log("BusFormModal: Constructed naive ISO for endDate:", processedData.endDate);
    } else {
      processedData.endDate = undefined;
    }

    // Remove form-specific fields
    delete processedData.departureDate;
    delete processedData.departureTime;
    delete processedData.arrivalDate;
    delete processedData.arrivalTime;

    console.log("BusFormModal: Final processed data before calling onSave:", processedData);
    
    try {
      onSave(processedData as Event);
      console.log("BusFormModal: onSave completed successfully");
      onClose();
      console.log("BusFormModal: Modal closed after save");
    } catch (error) {
      console.error("BusFormModal: Error during save:", error);
    }
  };

  const eventSpec = EVENT_TYPES['bus'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'bus'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Bus form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default BusFormModal; 