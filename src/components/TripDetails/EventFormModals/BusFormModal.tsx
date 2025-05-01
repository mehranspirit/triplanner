import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, BusEvent } from '@/types/eventTypes';
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
  const form = useForm<BusFormData>({
    resolver: zodResolver(busEventSchema as z.ZodType<BusFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        departureDate: eventToEdit.startDate?.substring(0, 10) || '',
        departureTime: eventToEdit.startDate?.substring(11, 16) || '',
        arrivalDate: eventToEdit.endDate?.substring(0, 10) || '',
        arrivalTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'bus',
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
      console.log('BusFormModal: Directly parsed values:', { departureDatePart, departureTimePart, arrivalDatePart, arrivalTimePart });
      form.reset({
        ...eventToEdit,
        departureDate: departureDatePart,
        departureTime: departureTimePart,
        arrivalDate: arrivalDatePart,
        arrivalTime: arrivalTimePart,
      });
    } else {
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
        status: 'exploring',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: BusFormData) => {
    console.log("Raw Bus form data (strings):", data);
    let processedData: any = { ...data };

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

    delete processedData.departureDate;
    delete processedData.departureTime;
    delete processedData.arrivalDate;
    delete processedData.arrivalTime;

    console.log("Processed Bus data to save (naive ISO):", processedData);
    onSave(processedData as Event);
    onClose();
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