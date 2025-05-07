import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { DestinationEvent } from '@/types/eventTypes';
import DestinationEventCard from '../components/TripDetails/EventCards/DestinationEventCard';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format, setHours, setMinutes, setSeconds, parse } from 'date-fns';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage,
    FormDescription
} from "@/components/ui/form";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Zod Schema for DestinationEvent
export const destinationEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('destination'),
  placeName: z.string().min(1, { message: "Place name is required" }),
  startDate: z.string({ required_error: "Start date is required." })
              .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  startTime: z.string({ required_error: "Start time is required." })
              .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  endDate: z.string({ required_error: "End date is required." })
            .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  endTime: z.string({ required_error: "End time is required." })
            .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  location: z.object({ 
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  status: z.enum(['confirmed', 'exploring']).default('exploring'),
  thumbnailUrl: z.string().optional(),
  source: z.enum(['manual', 'google_places', 'google_flights', 'booking.com', 'airbnb', 'expedia', 'tripadvisor', 'other']).optional(),
  address: z.string().optional(),
  description: z.string().optional(),
}).refine(data => {
  const startString = `${data.startDate}T${data.startTime}`;
  const endString = `${data.endDate}T${data.endTime}`;
  return startString <= endString; // Allow start and end to be the same
}, {
  message: "Start must be before or same as end time",
});

export type DestinationFormData = z.infer<typeof destinationEventSchema>;

// Function to render form fields
const renderDestinationFormFields = (form: UseFormReturn<DestinationFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        <FormField
            control={control}
            name="placeName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Place Name *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Museum, Park" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

        {/* Start Date/Time */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="startDate"
                render={({ field }) => {
                  let selectedDate: Date | undefined = undefined;
                  if (field.value) {
                    const parsed = parse(field.value, 'yyyy-MM-dd', new Date());
                    if (!isNaN(parsed.getTime())) {
                      selectedDate = parsed;
                    }
                  }
                  return (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date *</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !selectedDate && "text-muted-foreground")}
                                >
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar 
                              mode="single" 
                              selected={selectedDate}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                              }}
                              initialFocus 
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                  );
                 }}
                />
            <FormField
                control={control}
                name="startTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
         {/* End Date/Time */} 
         <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="endDate"
                render={({ field }) => {
                  let selectedDate: Date | undefined = undefined;
                  if (field.value) {
                    const parsed = parse(field.value, 'yyyy-MM-dd', new Date());
                    if (!isNaN(parsed.getTime())) {
                      selectedDate = parsed;
                    }
                  }
                  return (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date *</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !selectedDate && "text-muted-foreground")}
                                >
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar 
                              mode="single" 
                              selected={selectedDate}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                              }}
                              initialFocus 
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                  );
                }}
                />
            <FormField
                control={control}
                name="endTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>End Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
            control={control}
            name="address"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Address / Location</FormLabel>
                <FormControl>
                    <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

        <FormField
            control={control}
            name="description"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                    <Textarea placeholder="Optional description..." {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

        <FormField
            control={control}
            name="thumbnailUrl"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Thumbnail URL</FormLabel>
                <FormControl>
                    <Input 
                        placeholder="Enter image URL or leave empty for automatic thumbnail" 
                        {...field} 
                        value={field.value ?? ''} 
                    />
                </FormControl>
                <FormDescription>
                    If left empty, a relevant image will be automatically selected based on the destination details.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />

       {/* Notes */} 
        <FormField
            control={control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                    <Textarea placeholder="Optional notes..." {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
    </div>
  );
};

// Add the missing formatDateTime function
const formatDateTime = (isoString: string): string => {
  try {
    return format(new Date(isoString), 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Invalid Date';
  }
};

// Event Specification for Destinations
const destinationSpec: EventSpec<DestinationEvent> = {
  type: 'destination',
  icon: '📍',
  defaultThumbnail: 'https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=300',
  zodSchema: destinationEventSchema,
  formFields: renderDestinationFormFields,
  listSummary: (event) => `${event.placeName} on ${format(new Date(event.startDate), 'MMM d')}`,
  detailRows: (event) => {
    const isSinglePointInTime = event.startDate === event.endDate;
    const rows: [string, string][] = [
        ['Place', event.placeName],
        ['Time', isSinglePointInTime ? formatDateTime(event.startDate) : `${formatDateTime(event.startDate)} - ${formatDateTime(event.endDate)}`],
        ['Address', event.address || event.location?.address || 'N/A'],
        ['Description', event.description || 'N/A'],
        ['Status', event.status],
    ];
    return rows;
  },
  cardComponent: DestinationEventCard,
};

// Register the specification
registerEvent(destinationSpec); 