import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { RentalCarEvent } from '@/types/eventTypes';
import RentalCarEventCard from '../components/TripDetails/EventCards/RentalCarEventCard';
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
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Zod Schema for RentalCarEvent
export const rentalCarEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('rental_car'),
  date: z.string({ required_error: "Pickup date is required." })
         .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  pickupTime: z.string({ required_error: "Pickup time is required." })
               .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  dropoffDate: z.string({ required_error: "Dropoff date is required." })
                .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  dropoffTime: z.string({ required_error: "Dropoff time is required." })
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
  carCompany: z.string().optional(),
  pickupLocation: z.string().min(1, { message: "Pickup location required" }),
  dropoffLocation: z.string().min(1, { message: "Dropoff location required" }),
  carType: z.string().optional(),
  bookingReference: z.string().optional(),
  licensePlate: z.string().optional(),
}).refine(data => {
  if (!data.date || !data.pickupTime || !data.dropoffDate || !data.dropoffTime) return false;
  const startString = `${data.date}T${data.pickupTime}`;
  const endString = `${data.dropoffDate}T${data.dropoffTime}`;
  return startString < endString;
}, {
    message: "Pickup must be before dropoff",
    path: ["dropoffDate"],
});

export type RentalCarFormData = z.infer<typeof rentalCarEventSchema>;

// Function to render form fields
const renderRentalCarFormFields = (form: UseFormReturn<RentalCarFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        {/* Company & Type */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="carCompany"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Car Company</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Hertz" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="carType"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Car Type</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Sedan, SUV" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
        </div>
        {/* Pickup Location & DateTime */} 
         <FormField
            control={control}
            name="pickupLocation"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Pickup Location *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., SFO Airport" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="date"
                render={({ field }) => {
                  const selectedDate = field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined;
                  return (
                    <FormItem className="flex flex-col">
                        <FormLabel>Pickup Date *</FormLabel>
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
                name="pickupTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pickup Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        {/* Dropoff Location & DateTime */} 
          <FormField
            control={control}
            name="dropoffLocation"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Dropoff Location *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., LAX Airport" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="dropoffDate"
                render={({ field }) => {
                  const selectedDate = field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined;
                  return (
                    <FormItem className="flex flex-col">
                        <FormLabel>Dropoff Date *</FormLabel>
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
                name="dropoffTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Dropoff Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
         {/* License Plate & Booking Ref */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="licensePlate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>License Plate</FormLabel>
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

// Event Specification for Rental Cars
const rentalCarSpec: EventSpec<RentalCarEvent> = {
  type: 'rental_car',
  icon: '🚗',
  defaultThumbnail: '/placeholders/car-thumbnail.jpg',
  zodSchema: rentalCarEventSchema,
  formFields: renderRentalCarFormFields,
  listSummary: (event) => `${event.carCompany || 'Rental Car'} (${format(new Date(event.date), 'MMM d')} - ${format(new Date(event.dropoffDate), 'MMM d')})`,
  detailRows: (event) => [
    ['Company', `${event.carCompany || 'N/A'} ${event.carType ? `(${event.carType})` : ''}`],
    ['Pickup', `${event.pickupLocation} at ${formatDateTime(event.date)}`],
    ['Dropoff', `${event.dropoffLocation} at ${formatDateTime(event.dropoffDate)}`],
    ['License Plate', event.licensePlate || 'N/A'],
    ['Booking Ref', event.bookingReference || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: RentalCarEventCard,
};

// Register the specification
registerEvent(rentalCarSpec); 