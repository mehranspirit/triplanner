import { z } from 'zod';
import { Event, EventType } from '@/types/eventTypes';
import { UseFormReturn } from 'react-hook-form';

// Interface for the specification of each event type
export interface EventSpec<T extends Event = Event> {
  type: EventType;
  icon: string; // Emoji or icon class name
  defaultThumbnail: string;
  zodSchema: z.ZodSchema<any>; // Zod schema for form validation
  formFields: (form: UseFormReturn<any>) => React.ReactNode; // Function to render form fields
  listSummary: (event: T) => string; // Function to generate a summary string for lists
  detailRows: (event: T) => [string, string][]; // Function to generate label/value pairs for details view
  cardComponent: React.FC<{ event: T; thumbnail: string; onEdit?: () => void; onDelete?: () => void }>; // Component to render the event card
}

// Global registry for event specifications
export const EVENT_TYPES: { [key in EventType]?: EventSpec<any> } = {};

// Helper function to register a new event type specification
export const registerEvent = <T extends Event>(
  spec: EventSpec<T>
) => {
  if (EVENT_TYPES[spec.type]) {
    console.warn(`Event type "${spec.type}" is already registered. Overwriting.`);
  }
  EVENT_TYPES[spec.type] = spec;
};

// NOTE: Ensure defaultThumbnail paths exist or are handled gracefully
