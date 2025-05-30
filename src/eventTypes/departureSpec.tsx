import * as z from 'zod';
import { registerEvent, EventSpec } from './registry';
import { ArrivalDepartureEvent } from '@/types/eventTypes'; // Use common type
import DepartureEventCard from '../components/TripDetails/EventCards/DepartureEventCard';
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

// Helper function
const combineDateAndTime = (date: Date | undefined, time: string | undefined): string => {
  if (!date || !time) return "";
  try {
    const [hours, minutes] = time.split(':').map(Number);
    let combinedDate = setHours(date, hours);
    combinedDate = setMinutes(combinedDate, minutes);
    combinedDate = setSeconds(combinedDate, 0);
    return combinedDate.toISOString();
  } catch (e) {
    console.error("Error combining date and time:", e);
    return ""; 
  }
};

// Zod Schema for DepartureEvent
export const departureEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('departure'),
  startDate: z.string().datetime().optional(), // Combined departure time
  endDate: z.string().datetime().optional(),   // Often same as startDate
  departureDate: z.string({ required_error: "Departure date is required." })
                  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  departureTime: z.string({ required_error: "Departure time is required." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  location: z.object({ 
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  status: z.enum(['confirmed', 'exploring']).default('exploring'),
  thumbnailUrl: z.string().optional(),
  source: z.enum(['manual', 'google_places', 'google_flights', 'booking.com', 'airbnb', 'expedia', 'tripadvisor', 'other']).optional(),
  flightNumber: z.string().optional(),
  airline: z.string().optional(),
  airport: z.string().min(1, { message: "Departure location name is required" }), // Generic name
  terminal: z.string().optional(),
  gate: z.string().optional(),
  bookingReference: z.string().optional(),
});

export type DepartureFormData = z.infer<typeof departureEventSchema>;

// Function to render form fields
const renderDepartureFormFields = (form: UseFormReturn<DepartureFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
         <FormField
            control={control}
            name="airport"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Departure Airport *</FormLabel>
                <FormControl>
                    <Input placeholder="Airport, Station, Port, etc." {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        {/* Departure Date/Time */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="departureDate"
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
                        <FormLabel>Departure Date *</FormLabel>
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
                name="departureTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Departure Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
       {/* Transport Details (Optional) */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="airline"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Airline</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., United, Amtrak" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="flightNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Flight No.</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
        </div>
         {/* Terminal & Gate */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="terminal"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Terminal</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="gate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Gate</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
        </div>
         {/* Booking Reference */} 
          <FormField
            control={control}
            name="bookingReference"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Booking Reference</FormLabel>
                <FormControl>
                    <Input placeholder="Optional" {...field} value={field.value ?? ''} />
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
                    If left empty, a relevant image will be automatically selected based on the departure details.
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

// Simple helper to format naive YYYY-MM-DDTHH:mm:ss string for display
const formatNaiveDateTime = (naiveIsoString: string | undefined): string => {
  if (!naiveIsoString) return 'N/A';
  try {
    const datePart = naiveIsoString.substring(0, 10);
    const timePart = naiveIsoString.substring(11, 16); // HH:mm
    return `${datePart} ${timePart}`;
  } catch (e) {
    console.error("Error formatting naive date string:", naiveIsoString, e);
    return "Invalid Date/Time";
  }
};

// Helper to format date and time separately
const formatNaiveDateTimeWithSeparateParts = (dateStr?: string, timeStr?: string): string => {
  if (!dateStr || !timeStr) return 'N/A';
  try {
    // Combine date and time, parse without timezone interpretation
    const combinedStr = `${dateStr} ${timeStr}`;
    const date = parse(combinedStr, 'yyyy-MM-dd HH:mm', new Date()); // Use a dummy date for parsing
    return format(date, 'MMM d, yyyy h:mm a'); // Format for display
  } catch (error) {
    console.error("Error formatting naive date/time:", error);
    return 'Invalid Date/Time';
  }
};

// Optional: Helper for just the date part
const formatNaiveDate = (naiveIsoString: string | undefined): string => {
  if (!naiveIsoString) return 'N/A';
  try {
    return naiveIsoString.substring(0, 10); // YYYY-MM-DD
  } catch (e) {
    return "Invalid Date";
  }
};

// Event Specification for Departures
const departureSpec: EventSpec<ArrivalDepartureEvent> = {
  type: 'departure',
  icon: '🛫',
  defaultThumbnail: '/placeholders/departure-thumbnail.jpg',
  zodSchema: departureEventSchema,
  formFields: renderDepartureFormFields,
  listSummary: (event) => `Departure from ${event.airport} on ${formatNaiveDate(event.departureDate || event.startDate?.substring(0, 10))}`,
  detailRows: (event) => [
    ['Location', event.airport],
    ['Departure Time', event.departureDate && event.departureTime 
      ? formatNaiveDateTimeWithSeparateParts(event.departureDate, event.departureTime) 
      : formatNaiveDateTime(event.startDate)],
    ['Transport', `${event.airline || 'N/A'} ${event.flightNumber || ''}`],
    ['Terminal/Gate', `${event.terminal || 'N/A'} / ${event.gate || 'N/A'}`],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: DepartureEventCard,
};

// Register the specification
registerEvent(departureSpec); 