import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Form } from "@/components/ui/form";
import { UseFormReturn } from 'react-hook-form';

interface BaseEventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void; // The specific submit handler from the child
  form: UseFormReturn<any>; // The form instance from the child
  eventType: string | null; // To enable/disable footer
  eventToEdit: any | null; // To change title
  children: React.ReactNode; // The actual form fields from the child
}

const BaseEventFormModal: React.FC<BaseEventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  form,
  eventType,
  eventToEdit,
  children,
}) => {
  const title = eventToEdit ? `Edit ${eventType || 'Event'}` : 'Add New Event';
  const description = eventToEdit
    ? `Editing details for ${eventType} event.`
    : 'Select the type of event and fill in the details.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* Use handleSubmit from the passed form instance */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
            {/* Render the specific form fields passed as children */}
            {children}

            {/* Show footer only if an event type is selected (for new) or editing */}
            {(eventType || eventToEdit) && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit">Save Event</Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BaseEventFormModal; 