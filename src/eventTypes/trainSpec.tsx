import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { TrainEvent } from '@/types/eventTypes';
import TrainEventCard from '../components/TripDetails/EventCards/TrainEventCard';
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
    FormMessage 
} from "@/components/ui/form";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from 'lucide-react';

// Zod Schema for TrainEvent
export const trainEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('train'),
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
  trainNumber: z.string().optional(),
  trainOperator: z.string().optional(),
  departureStation: z.string().min(1, { message: "Departure station is required" }),
  arrivalStation: z.string().min(1, { message: "Arrival station is required" }),
  carriageNumber: z.string().optional(),
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

export type TrainFormData = z.infer<typeof trainEventSchema>;

// Function to render form fields
const renderTrainFormFields = (form: UseFormReturn<TrainFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        {/* Operator & Number */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="trainOperator"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Train Operator</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Amtrak" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="trainNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Train Number</FormLabel>
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
                <FormLabel>Departure Station *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Penn Station" {...field} />
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
                <FormLabel>Arrival Station *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Union Station" {...field} />
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
         {/* Carriage & Seat */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="carriageNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Carriage Number</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
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

// Event Specification for Trains
const trainSpec: EventSpec<TrainEvent> = {
  type: 'train',
  icon: '🚂', 
  defaultThumbnail: '/placeholders/train-thumbnail.jpg',
  zodSchema: trainEventSchema,
  formFields: renderTrainFormFields,
  listSummary: (event) => `${event.trainOperator || 'Train'} (${event.departureStation} -> ${event.arrivalStation}) on ${formatNaiveDate(event.startDate)}`,
  detailRows: (event) => [
    ['Operator', `${event.trainOperator || 'N/A'} ${event.trainNumber || ''}`],
    ['Departure', `${event.departureStation} at ${formatNaiveDateTime(event.startDate)}`],
    ['Arrival', `${event.arrivalStation} at ${formatNaiveDateTime(event.endDate)}`],
    ['Carriage/Seat', `${event.carriageNumber || 'N/A'} / ${event.seatNumber || 'N/A'}`],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: TrainEventCard,
};

// Register the specification
registerEvent(trainSpec); 