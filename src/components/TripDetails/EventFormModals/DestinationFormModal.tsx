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
        startDate: eventToEdit.startDate || '',
        endDate: eventToEdit.endDate || '',
    } : {
        type: 'destination',
        startDate: '',
        endDate: '',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      form.reset({
        ...eventToEdit,
        startDate: eventToEdit.startDate || '',
        endDate: eventToEdit.endDate || '',
      });
    }
  }, [eventToEdit, form]);

  const onSubmit = (data: DestinationFormData) => {
    const processedData = { ...data };
    console.log("Processed Destination data to save:", processedData);
    onSave(processedData as unknown as Event);
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