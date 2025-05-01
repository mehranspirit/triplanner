import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { BusEvent } from '@/types/eventTypes';
import BusEventCard from '../components/TripDetails/EventCards/BusEventCard';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format, parse } from 'date-fns';
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
    FormMessage 
} from "@/components/ui/form";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Zod Schema for BusEvent
export const busEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('bus'),
  startDate: z.string().datetime().optional(), // Combined departure
  endDate: z.string().datetime().optional(),   // Combined arrival
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
  busNumber: z.string().optional(),
  busOperator: z.string().optional(),
  departureStation: z.string().min(1, { message: "Departure station/stop is required" }),
  arrivalStation: z.string().min(1, { message: "Arrival station/stop is required" }),
  seatNumber: z.string().optional(),
  bookingReference: z.string().optional(),
}).refine(data => {
  if (!data.departureDate || !data.departureTime || !data.arrivalDate || !data.arrivalTime) return false;
  const startString = `${data.departureDate}T${data.departureTime}`;
  const endString = `${data.arrivalDate}T${data.arrivalTime}`;
  return startString < endString;
}, {
    message: "Departure must be before arrival",
    path: ["arrivalDate"],
});

export type BusFormData = z.infer<typeof busEventSchema>;

// Helper to format naive date string (YYYY-MM-DD HH:mm)
const formatNaiveDateTime = (dateStr?: string, timeStr?: string): string => {
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

// Helper to format naive date string (YYYY-MM-DD)
const formatNaiveDate = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date()); // Use a dummy date for parsing
    return format(date, 'MMM d, yyyy'); // Format for display
  } catch (error) {
    console.error("Error formatting naive date:", error);
    return 'Invalid Date';
  }
};

// Function to render form fields
const renderBusFormFields = (form: UseFormReturn<BusFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        {/* Operator & Number */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="busOperator"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bus Operator</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Greyhound" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="busNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bus Number</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
        </div>
         {/* Departure Station & DateTime */} 
         <FormField
            control={control}
            name="departureStation"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Departure Station/Stop *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Port Authority" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="departureDate"
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
         {/* Arrival Station & DateTime */} 
          <FormField
            control={control}
            name="arrivalStation"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Arrival Station/Stop *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., South Station" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="arrivalDate"
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
                name="arrivalTime"
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
         {/* Seat & Booking Ref */} 
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={control}
                name="seatNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Seat Number</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
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
        </div>
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

// Event Specification for Buses
const busSpec: EventSpec<BusEvent> = {
  type: 'bus',
  icon: '🚌', 
  defaultThumbnail: '/placeholders/bus-thumbnail.jpg',
  zodSchema: busEventSchema,
  formFields: renderBusFormFields,
  listSummary: (event) => `${event.busOperator || 'Bus'} (${event.departureStation} -> ${event.arrivalStation}) on ${formatNaiveDate(event.departureDate)}`,
  detailRows: (event) => [
    ['Operator', `${event.busOperator || 'N/A'} ${event.busNumber || ''}`],
    ['Departure', `${event.departureStation} at ${formatNaiveDateTime(event.departureDate, event.departureTime)}`],
    ['Arrival', `${event.arrivalStation} at ${formatNaiveDateTime(event.arrivalDate, event.arrivalTime)}`],
    ['Seat', event.seatNumber || 'N/A'],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: BusEventCard,
};

// Register the specification
registerEvent(busSpec); 