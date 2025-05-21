import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { ActivityEvent } from '@/types/eventTypes';
import ActivityEventCard from '../components/TripDetails/EventCards/ActivityEventCard';
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

// Zod Schema for ActivityEvent
export const activityEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('activity'),
  title: z.string().min(1, { message: "Activity title is required" }),
  activityType: z.string().min(1, { message: "Activity type is required" }),
  startDate: z.string({ required_error: "Start date is required." })
              .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  startTime: z.string({ required_error: "Start time is required." })
              .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  endDate: z.string({ required_error: "End date is required." })
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
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
  cost: z.preprocess(
    (val) => val === '' || val === undefined ? undefined : Number(val),
    z.number().min(0, { message: "Cost must be a positive number" }).optional()
  ),
}).refine(data => {
  const startString = `${data.startDate}T${data.startTime}`;
  const endString = `${data.endDate}T${data.endTime}`;
  return startString <= endString; // Allow start and end to be the same
}, {
  message: "Start must be before or same as end time",
});

export type ActivityFormData = z.infer<typeof activityEventSchema>;

// Function to render form fields
const renderActivityFormFields = (form: UseFormReturn<ActivityFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        <FormField
            control={control}
            name="title"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Activity Title *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Museum Visit, Dinner" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
         <FormField
            control={control}
            name="activityType"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Activity Type *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Sightseeing, Food, Tour" {...field} />
                     {/* TODO: Consider a predefined list/tags? */} 
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
                    If left empty, a relevant image will be automatically selected based on the activity details.
                </FormDescription>
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
                    try {
                      // Handle both ISO and simple YYYY-MM-DD formats
                      const datePart = field.value.includes('T') ? field.value.split('T')[0] : field.value;
                      const [year, month, day] = datePart.split('-').map(Number);
                      
                      // Validate date parts
                      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        selectedDate = new Date(year, month - 1, day);
                        // Validate the date
                        if (isNaN(selectedDate.getTime())) {
                          selectedDate = undefined;
                        }
                      }
                    } catch (error) {
                      console.warn('Error parsing date:', error, field.value);
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
                    try {
                      // Handle both ISO and simple YYYY-MM-DD formats
                      const datePart = field.value.includes('T') ? field.value.split('T')[0] : field.value;
                      const [year, month, day] = datePart.split('-').map(Number);
                      
                      // Validate date parts
                      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        selectedDate = new Date(year, month - 1, day);
                        // Validate the date
                        if (isNaN(selectedDate.getTime())) {
                          selectedDate = undefined;
                        }
                      }
                    } catch (error) {
                      console.warn('Error parsing date:', error, field.value);
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
        {/* Status */} 
         <FormField
            control={control}
            name="status"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Status</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                         <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="exploring">Exploring</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={control}
            name="cost"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Cost</FormLabel>
                <FormControl>
                    <Input type="number" min={0} step="0.01" placeholder="e.g., 25.00" {...field} />
                </FormControl>
                <FormDescription>
                    Optional. Enter the cost for this activity (in your default currency).
                </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
  );
};

// Helper to format date/time for display
const formatDateTime = (isoString: string): string => {
  if (!isoString) return 'N/A';
  try {
    return format(new Date(isoString), 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Invalid Date';
  }
};

// Event Specification for Activities
const activitySpec: EventSpec<ActivityEvent> = {
  type: 'activity',
  icon: '🎉',
  defaultThumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=300',
  zodSchema: activityEventSchema,
  formFields: renderActivityFormFields,
  listSummary: (event) => `${event.title} (${event.activityType}) on ${format(new Date(event.startDate), 'MMM d')}`,
  detailRows: (event) => [
    ['Activity', event.title],
    ['Type', event.activityType],
    ['Starts', formatDateTime(event.startDate)],
    ['Ends', formatDateTime(event.endDate)], // Assuming endDate is useful here
    ['Location', event.address || event.location?.address || 'N/A'],
    ['Description', event.description || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: ActivityEventCard,
};

// Register the specification
registerEvent(activitySpec); 