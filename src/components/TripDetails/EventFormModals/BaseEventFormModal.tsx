import React, { useEffect } from 'react';
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

  // Debug modal status
  useEffect(() => {
    console.log(`BaseEventFormModal for ${eventType}: isOpen=${isOpen}, eventToEdit=`, eventToEdit);
  }, [isOpen, eventToEdit, eventType]);

  // Handle form submission directly
  const handleFormSubmit = form.handleSubmit((data) => {
    console.log(`BaseEventFormModal: Form submitted for ${eventType}`, data);
    try {
      onSubmit(data);
    } catch (error) {
      console.error(`BaseEventFormModal: Error in onSubmit for ${eventType}`, error);
    }
  }, (errors) => {
    console.error(`BaseEventFormModal: Form validation errors for ${eventType}:`, errors);
    return false;
  });

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        console.log(`BaseEventFormModal Dialog onOpenChange: ${open} -> ${!open}`);
        if (!open) {
          // Only handle closing through the Dialog UI (clicking outside/escape key)
          // Don't close on form submission
          console.log('Dialog closing through UI interaction');
          form.reset(); // Reset the form when closing
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={(e) => {
              console.log('Form submit event triggered');
              handleFormSubmit(e);
              // Don't call e.preventDefault() - let the form's normal submission flow handle it
            }} 
            className="space-y-6 p-1"
          >
            {/* Render the specific form fields passed as children */}
            {children}

            {/* Show footer only if an event type is selected (for new) or editing */}
            {(eventType || eventToEdit) && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  console.log('BaseEventFormModal: Cancel button clicked');
                  form.reset(); // Reset the form when canceling
                  onClose();
                }}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                >
                  Save Event
                </Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BaseEventFormModal; 