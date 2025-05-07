import { z } from 'zod';
import { registerEvent, EventSpec } from './registry';
import { StayEvent } from '@/types/eventTypes';
import StayEventCard from '../components/TripDetails/EventCards/StayEventCard';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from 'lucide-react';

// Zod Schema for StayEvent
export const stayEventSchema = z.object({
  id: z.string().optional(),
  type: z.literal('stay'),
  startDate: z.string().optional(), // Will be populated by form logic
  endDate: z.string().optional(),   // Will be populated by form logic
  checkInDate: z.string({ required_error: "Check-in date is required." })
                .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  checkInTime: z.string({ required_error: "Check-in time is required." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  checkOutDate: z.string({ required_error: "Check-out date is required." })
                 .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }),
  checkOutTime: z.string({ required_error: "Check-out time is required." }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:mm)" }),
  location: z.object({ 
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  status: z.enum(['confirmed', 'exploring']).default('exploring'),
  thumbnailUrl: z.string().optional(),
  source: z.enum(['manual', 'google_places', 'google_flights', 'booking.com', 'airbnb', 'expedia', 'tripadvisor', 'other']).optional(),
  accommodationName: z.string().min(1, { message: "Accommodation name is required" }),
  address: z.string().optional(),
  reservationNumber: z.string().optional(),
  contactInfo: z.string().optional(),
}).refine(data => {
  if (!data.checkInDate || !data.checkInTime || !data.checkOutDate || !data.checkOutTime) return false;
  const startString = `${data.checkInDate}T${data.checkInTime}`;
  const endString = `${data.checkOutDate}T${data.checkOutTime}`;
  return startString < endString;
}, {
    message: "Check-in must be before Check-out",
    path: ["checkOutDate"], // Attach error to check-out date
});

export type StayFormData = z.infer<typeof stayEventSchema>;

// Function to render form fields
const renderStayFormFields = (form: UseFormReturn<StayFormData>): React.ReactNode => {
  const { control } = form;
  return (
    <div className="space-y-4">
        <FormField
            control={control}
            name="accommodationName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Accommodation Name *</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., Grand Hyatt" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <FormField
            control={control}
            name="address"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                    <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                </FormControl>
                 {/* TODO: Add map integration? */} 
                <FormMessage />
                </FormItem>
            )}
            />
        {/* Check-in Date/Time */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="checkInDate"
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
                        <FormLabel>Check-in Date *</FormLabel>
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
                name="checkInTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Check-in Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
         {/* Check-out Date/Time */} 
         <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="checkOutDate"
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
                        <FormLabel>Check-out Date *</FormLabel>
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
                name="checkOutTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Check-out Time *</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
         {/* Reservation & Contact */} 
        <div className="grid grid-cols-2 gap-4">
             <FormField
                control={control}
                name="reservationNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reservation Number</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
             <FormField
                control={control}
                name="contactInfo"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contact Info</FormLabel>
                        <FormControl>
                            <Input placeholder="Optional (phone/email)" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
        </div>
       {/* Notes */} 
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
                    If left empty, a relevant image will be automatically selected based on the accommodation details.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />
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

// Event Specification for Stays
const staySpec: EventSpec<StayEvent> = {
  type: 'stay',
  icon: '🏨',
  defaultThumbnail: '/placeholders/stay-thumbnail.jpg',
  zodSchema: stayEventSchema,
  formFields: renderStayFormFields,
  listSummary: (event) => `${event.accommodationName} (${formatNaiveDate(event.startDate)} - ${formatNaiveDate(event.endDate)})`,
  detailRows: (event) => [
    ['Accommodation', event.accommodationName],
    ['Check-in', formatNaiveDateTime(event.startDate)],
    ['Check-out', formatNaiveDateTime(event.endDate)],
    ['Address', event.address || event.location?.address || 'N/A'],
    ['Reservation #', event.reservationNumber || 'N/A'],
    ['Contact', event.contactInfo || 'N/A'],
    ['Status', event.status],
  ],
  cardComponent: StayEventCard,
};

// Register the specification
registerEvent(staySpec); 