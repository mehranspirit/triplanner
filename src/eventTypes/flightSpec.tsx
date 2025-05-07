import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { FlightEvent } from '@/types/eventTypes';
import FlightEventCard from '../components/TripDetails/EventCards/FlightEventCard';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format, parse, setHours, setMinutes, setSeconds } from 'date-fns';
import { cn } from "@/lib/utils"; // Forshadcn UI class merging
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Form, 
    FormControl, 
    FormDescription, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage 
} from "@/components/ui/form";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Zod Schema for FlightEvent validation
export const flightEventSchema = z.object({
  id: z.string().optional(), 
  type: z.literal('flight'),
  startDate: z.string().datetime().optional(), // Will be populated by form logic
  endDate: z.string().datetime().optional(),   // Will be populated by form logic
  departureDate: z.string({ required_error: "Departure date is required." })
                    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  departureTime: z.string({ required_error: "Departure time is required." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  arrivalDate: z.string({ required_error: "Arrival date is required." })
                  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  arrivalTime: z.string({ required_error: "Arrival time is required." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  status: z.enum(['confirmed', 'exploring']).default('exploring'),
  thumbnailUrl: z.string().optional(),
  source: z.enum(['manual', 'google_places', 'google_flights', 'booking.com', 'airbnb', 'expedia', 'tripadvisor', 'other']).optional(),
  airline: z.string().optional(),
  flightNumber: z.string().optional(),
  departureAirport: z.string().min(3, { message: "Departure airport code required (e.g., SFO)" })
    .max(10, { message: "Airport code seems too long" }),
  arrivalAirport: z.string().min(3, { message: "Arrival airport code required (e.g., JFK)" })
    .max(10, { message: "Airport code seems too long" }),
  terminal: z.string().optional(),
  gate: z.string().optional(),
  bookingReference: z.string().optional(),
}).refine(data => {
  // Refine based on the string date/time parts
  if (!data.departureDate || !data.departureTime || !data.arrivalDate || !data.arrivalTime) return false;
  const startString = `${data.departureDate}T${data.departureTime}`;
  const endString = `${data.arrivalDate}T${data.arrivalTime}`;
  // Simple string comparison works for YYYY-MM-DDTHH:mm format
  return startString < endString;
}, {
    message: "Departure must be before arrival",
    path: ["arrivalDate"], // Attach error to arrival date
});

// Type for the form data based on the schema
export type FlightFormData = z.infer<typeof flightEventSchema>;

// Function to render form fields
const renderFlightFormFields = (form: UseFormReturn<FlightFormData>): React.ReactNode => {
    const { control } = form;
  return (
    <div className="space-y-4">
        {/* Airline & Flight Number */} 
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={control}
            name="airline"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Airline</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., United" {...field} value={field.value ?? ''} />
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
                <FormLabel>Flight Number</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., UA 123" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
      </div>

        {/* Departure Airport & DateTime */} 
        <FormField
            control={control}
            name="departureAirport"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Departure Airport *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., SFO" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="departureDate" // String field
                render={({ field }) => {
                  const selectedDate = field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined;
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
                name="departureTime" // Use the actual schema field name
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
        {/* Hidden fields are no longer needed */} 
        {/* <FormField control={control} name="startDate" render={({ field }) => <Input type="hidden" {...field} />} /> */}
        {/* <FormField control={control} name="endDate" render={({ field }) => <Input type="hidden" {...field} />} /> */}

         {/* Arrival Airport & DateTime */} 
        <FormField
            control={control}
            name="arrivalAirport"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Arrival Airport *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., JFK" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="arrivalDate" // String field
                render={({ field }) => {
                   const selectedDate = field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined;
                   return (
                    <FormItem className="flex flex-col">
                        <FormLabel>Arrival Date *</FormLabel>
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
                name="arrivalTime" // Use the actual schema field name
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Arrival Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
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
                    If left empty, a relevant image will be automatically selected based on the flight details.
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

// Optional: Helper for just the date part
const formatNaiveDate = (naiveIsoString: string | undefined): string => {
  if (!naiveIsoString) return 'N/A';
  try {
    return naiveIsoString.substring(0, 10); // YYYY-MM-DD
  } catch (e) {
    return "Invalid Date";
  }
};

// Define the Event Specification for Flights
const flightSpec: EventSpec<FlightEvent> = {
  type: 'flight',
  icon: '✈️',
  defaultThumbnail: '/placeholders/flight-thumbnail.jpg',
  zodSchema: flightEventSchema,
  formFields: renderFlightFormFields, 
  listSummary: (event) => `${event.airline || 'Flight'} ${event.flightNumber || ''} (${event.departureAirport} -> ${event.arrivalAirport}) on ${formatNaiveDate(event.startDate)}`,
  detailRows: (event) => [
    ['Airline', `${event.airline || 'N/A'} ${event.flightNumber || ''}`],
    ['Departure', `${event.departureAirport || 'N/A'} at ${formatNaiveDateTime(event.startDate)}`],
    ['Arrival', `${event.arrivalAirport || 'N/A'} at ${formatNaiveDateTime(event.endDate)}`],
    ['Terminal/Gate', `${event.terminal || 'N/A'} / ${event.gate || 'N/A'}`],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: FlightEventCard,
};

// Register the specification
registerEvent(flightSpec); 