import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event, EventType, ActivityEvent } from '@/types/eventTypes';
import { activityEventSchema, ActivityFormData } from '@/eventTypes/activitySpec';
import { EVENT_TYPES } from '@/eventTypes/registry';
import BaseEventFormModal from './BaseEventFormModal';
import * as z from 'zod';

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => void;
  eventToEdit?: ActivityEvent | null;
}

const ActivityFormModal: React.FC<ActivityFormModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityEventSchema as z.ZodType<ActivityFormData>),
    defaultValues: eventToEdit ? {
        ...eventToEdit,
        startDate: eventToEdit.startDate || '',
        startTime: eventToEdit.startTime || '',
        endDate: eventToEdit.endDate || '',
        endTime: eventToEdit.endTime || '',
        cost: eventToEdit.cost ?? undefined,
    } : {
        type: 'activity',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        status: 'confirmed',
        cost: undefined,
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      form.reset({
        ...eventToEdit,
        startDate: eventToEdit.startDate || '',
        startTime: eventToEdit.startTime || '',
        endDate: eventToEdit.endDate || '',
        endTime: eventToEdit.endTime || '',
      });
    } else {
      form.reset({
        type: 'activity',
        title: '',
        description: '',
        activityType: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: undefined,
        notes: '',
        status: 'confirmed',
        cost: undefined,
      });
    }
  }, [eventToEdit, form]);

  const onSubmit = (data: ActivityFormData) => {
    const processedData = { ...data };
    console.log("Processed Activity data to save:", processedData);
    onSave(processedData as unknown as Event);
    onClose();
  };

  const eventSpec = EVENT_TYPES['activity'];
  const renderFields = eventSpec?.formFields;

  return (
    <BaseEventFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      eventType={'activity'}
      eventToEdit={eventToEdit}
    >
      {renderFields ? renderFields(form) : <p>Activity form fields loading error.</p>}
    </BaseEventFormModal>
  );
};

export default ActivityFormModal; 