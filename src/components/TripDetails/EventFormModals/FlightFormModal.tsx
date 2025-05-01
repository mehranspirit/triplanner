import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// Remove date-fns imports if no longer needed
// import { format, parse, setHours, setMinutes, setSeconds, formatISO } from 'date-fns';
import { Event, EventType, FlightEvent } from '@/types/eventTypes';
import { flightEventSchema, FlightFormData } from '@/eventTypes/flightSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface FlightFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: FlightEvent | null;
}

// Remove parseISOToDateTime and combineDateAndTime helpers

const FlightFormModal: React.FC<FlightFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightEventSchema as z.ZodType<FlightFormData>),
    // Update defaultValues for string dates
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        departureDate: eventToEdit.startDate?.substring(0, 10) || '',
        departureTime: eventToEdit.startDate?.substring(11, 16) || '',
        arrivalDate: eventToEdit.endDate?.substring(0, 10) || '',
        arrivalTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'flight',
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const departureDatePart = eventToEdit.startDate?.substring(0, 10) || '';
      const departureTimePart = eventToEdit.startDate?.substring(11, 16) || '';
      const arrivalDatePart = eventToEdit.endDate?.substring(0, 10) || '';
      const arrivalTimePart = eventToEdit.endDate?.substring(11, 16) || '';
      console.log('FlightFormModal: Directly parsed values for form reset:', { departureDatePart, departureTimePart, arrivalDatePart, arrivalTimePart });
      form.reset({
        ...eventToEdit,
        departureDate: departureDatePart,
        departureTime: departureTimePart,
        arrivalDate: arrivalDatePart,
        arrivalTime: arrivalTimePart,
      });
    } else {
      // Reset with empty strings and defaults for new event
      form.reset({
        type: 'flight',
        airline: '',
        flightNumber: '',
        departureAirport: '',
        arrivalAirport: '',
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
        terminal: '',
        gate: '',
        bookingReference: '',
        notes: '',
        status: 'exploring',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: FlightFormData) => {
    console.log("Raw Flight form data (strings):", data);
    let processedData: any = { ...data };

    // Construct naive ISO-like strings
    if (data.departureDate && data.departureTime) {
      processedData.startDate = `${data.departureDate}T${data.departureTime}:00`;
      console.log("FlightFormModal: Constructed naive ISO for startDate:", processedData.startDate);
    } else {
      processedData.startDate = undefined;
    }
    if (data.arrivalDate && data.arrivalTime) {
      processedData.endDate = `${data.arrivalDate}T${data.arrivalTime}:00`;
      console.log("FlightFormModal: Constructed naive ISO for endDate:", processedData.endDate);
    } else {
      processedData.endDate = undefined;
    }

    // Remove form-specific fields
    delete processedData.departureDate;
    delete processedData.departureTime;
    delete processedData.arrivalDate;
    delete processedData.arrivalTime;

    console.log("Processed Flight data to save (naive ISO):", processedData);
    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['flight'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'flight'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Flight form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default FlightFormModal; 