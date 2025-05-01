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
        activityStartDate: eventToEdit.startDate?.substring(0, 10) || '',
        activityStartTime: eventToEdit.startDate?.substring(11, 16) || '',
        activityEndDate: eventToEdit.endDate?.substring(0, 10) || '',
        activityEndTime: eventToEdit.endDate?.substring(11, 16) || '',
    } : {
        type: 'activity',
        activityStartDate: '',
        activityStartTime: '',
        activityEndDate: '',
        activityEndTime: '',
    },
  });

  useEffect(() => {
    if (eventToEdit) {
      const startDatePart = eventToEdit.startDate?.substring(0, 10) || '';
      const startTimePart = eventToEdit.startDate?.substring(11, 16) || '';
      const endDatePart = eventToEdit.endDate?.substring(0, 10) || '';
      const endTimePart = eventToEdit.endDate?.substring(11, 16) || '';
      console.log('ActivityFormModal: Directly parsed values:', { startDatePart, startTimePart, endDatePart, endTimePart });
      form.reset({
        ...eventToEdit,
        activityStartDate: startDatePart,
        activityStartTime: startTimePart,
        activityEndDate: endDatePart,
        activityEndTime: endTimePart,
      });
    } else {
      form.reset({
        type: 'activity',
        title: '',
        activityType: '',
        address: '',
        description: '',
        activityStartDate: '',
        activityStartTime: '',
        activityEndDate: '',
        activityEndTime: '',
        notes: '',
        status: 'exploring',
      });
    }
  }, [eventToEdit, form, isOpen]);

  const onSubmit = (data: ActivityFormData) => {
    console.log("Raw Activity form data (strings):", data);
    let processedData: any = { ...data };

    if (data.activityStartDate && data.activityStartTime) {
      processedData.startDate = `${data.activityStartDate}T${data.activityStartTime}:00`;
      console.log("ActivityFormModal: Constructed naive ISO for startDate:", processedData.startDate);
    } else {
      processedData.startDate = undefined;
    }
    if (data.activityEndDate && data.activityEndTime) {
      processedData.endDate = `${data.activityEndDate}T${data.activityEndTime}:00`;
      console.log("ActivityFormModal: Constructed naive ISO for endDate:", processedData.endDate);
    } else {
      processedData.endDate = undefined;
    }

    delete processedData.activityStartDate;
    delete processedData.activityStartTime;
    delete processedData.activityEndDate;
    delete processedData.activityEndTime;

    console.log("Processed Activity data to save (naive ISO):", processedData);
    onSave(processedData as Event);
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