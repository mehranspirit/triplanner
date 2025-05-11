import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { BusEvent } from '@/types/eventTypes';
import BusEventCard from '../components/TripDetails/EventCards/BusEventCard';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format, parse, setHours, setMinutes, setSeconds } from 'date-fns';
import { cn } from "@/lib/utils"; 
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

// Zod Schema for BusEvent validation
export const busEventSchema = z.object({
  id: z.string().optional(), 
  type: z.literal('bus'),
  startDate: z.string().optional(), // Will be populated by form logic
  endDate: z.string().optional(),   // Will be populated by form logic
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
  busOperator: z.string().optional(),
  busNumber: z.string().optional(),
  departureStation: z.string().min(2, { message: "Departure station required" }),
  arrivalStation: z.string().min(2, { message: "Arrival station required" }),
  seatNumber: z.string().optional(),
  bookingReference: z.string().optional(),
  cost: z.preprocess(
    (val) => val === '' || val === undefined ? undefined : Number(val),
    z.number().min(0, { message: "Cost must be a positive number" }).optional()
  ),
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
export type BusFormData = z.infer<typeof busEventSchema>;

// Function to render form fields
const renderBusFormFields = (form: UseFormReturn<BusFormData>): React.ReactNode => {
    const { control } = form;
  return (
    <div className="space-y-4">
        {/* Bus Operator & Bus Number */} 
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={control}
            name="busOperator"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Bus Company</FormLabel>
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
                    <Input placeholder="e.g., 123" {...field} value={field.value ?? ''} />
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
                    <Input placeholder="e.g., Central Bus Terminal" {...field} />
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

        {/* Arrival Station & DateTime */} 
        <FormField
            control={control}
            name="arrivalStation"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Arrival Station *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Downtown Bus Station" {...field} />
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

        {/* Seat Number */} 
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
                    If left empty, a relevant image will be automatically selected based on the bus journey details.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />

        {/* Cost */} 
        <FormField
            control={control}
            name="cost"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Cost</FormLabel>
                <FormControl>
                    <Input type="number" min={0} step="0.01" placeholder="e.g., 20.00" {...field} />
                </FormControl>
                <FormDescription>
                    Optional. Enter the cost for this bus ride (in your default currency).
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

// Helper for just the date part
const formatNaiveDate = (naiveIsoString: string | undefined): string => {
  if (!naiveIsoString) return 'N/A';
  try {
    return naiveIsoString.substring(0, 10); // YYYY-MM-DD
  } catch (e) {
    return "Invalid Date";
  }
};

// Event Specification for Buses
const busSpec: EventSpec<BusEvent> = {
  type: 'bus',
  icon: '🚌',
  defaultThumbnail: 'https://images.pexels.com/photos/1178448/pexels-photo-1178448.jpeg?auto=compress&cs=tinysrgb&w=300',
  zodSchema: busEventSchema,
  formFields: renderBusFormFields,
  listSummary: (event) => `Bus ${event.busNumber ? `#${event.busNumber}` : ''} from ${event.departureStation} to ${event.arrivalStation}`,
  detailRows: (event) => [
    ['Operator', event.busOperator || 'N/A'],
    ['Bus Number', event.busNumber || 'N/A'],
    ['From', event.departureStation || 'N/A'],
    ['To', event.arrivalStation || 'N/A'],
    ['Departure', formatNaiveDateTime(event.startDate)],
    ['Arrival', formatNaiveDateTime(event.endDate)],
    ['Seat', event.seatNumber || 'N/A'],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: BusEventCard,
};

// Register the specification
registerEvent(busSpec); 