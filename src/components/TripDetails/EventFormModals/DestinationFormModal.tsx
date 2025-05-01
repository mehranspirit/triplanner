import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, DestinationEvent } from '@/types/eventTypes';
import { destinationEventSchema, DestinationFormData } from '@/eventTypes/destinationSpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface DestinationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: DestinationEvent | null;
}

const DestinationFormModal: React.FC<DestinationFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const form = useForm<DestinationFormData>({
    resolver: zodResolver(destinationEventSchema as z.ZodType<DestinationFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        destStartDate: eventToEdit.startDate?.substring(0, 10) || '',
        destStartTime: eventToEdit.startDate?.substring(11, 16) || '',
        destEndDate: eventToEdit.endDate?.substring(0, 10) || '',
        destEndTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'destination',
        destStartDate: '',
        destStartTime: '',
        destEndDate: '',
        destEndTime: '',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const startDatePart = eventToEdit.startDate?.substring(0, 10) || '';
      const startTimePart = eventToEdit.startDate?.substring(11, 16) || '';
      const endDatePart = eventToEdit.endDate?.substring(0, 10) || '';
      const endTimePart = eventToEdit.endDate?.substring(11, 16) || '';
      console.log('DestinationFormModal: Directly parsed values:', { startDatePart, startTimePart, endDatePart, endTimePart });
      form.reset({
        ...eventToEdit,
        destStartDate: startDatePart,
        destStartTime: startTimePart,
        destEndDate: endDatePart,
        destEndTime: endTimePart,
      });
    } else {
      form.reset({
        type: 'destination',
        placeName: '',
        address: '',
        description: '',
        openingHours: '',
        destStartDate: '',
        destStartTime: '',
        destEndDate: '',
        destEndTime: '',
        notes: '',
        status: 'exploring',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: DestinationFormData) => {
    console.log("Raw Destination form data (strings):", data);
    let processedData: any = { ...data };

    if (data.destStartDate && data.destStartTime) {
      processedData.startDate = `${data.destStartDate}T${data.destStartTime}:00`;
      console.log("DestinationFormModal: Constructed naive ISO for startDate:", processedData.startDate);
    } else {
      processedData.startDate = undefined;
    }
    if (data.destEndDate && data.destEndTime) {
      processedData.endDate = `${data.destEndDate}T${data.destEndTime}:00`;
      console.log("DestinationFormModal: Constructed naive ISO for endDate:", processedData.endDate);
    } else {
      processedData.endDate = undefined;
    }

    delete processedData.destStartDate;
    delete processedData.destStartTime;
    delete processedData.destEndDate;
    delete processedData.destEndTime;

    console.log("Processed Destination data to save (naive ISO):", processedData);
    onSave(processedData as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['destination'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'destination'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Destination form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default DestinationFormModal; 