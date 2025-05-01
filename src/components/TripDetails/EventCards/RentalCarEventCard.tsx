import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RentalCarEvent } from '@/types/eventTypes';
import { format, parse, formatISO } from 'date-fns';
import { Car, Clock, MapPin, Edit, Trash2, Ticket, SquareAsterisk } from 'lucide-react';

interface RentalCarEventCardProps {
  event: RentalCarEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const RentalCarEventCard: React.FC<RentalCarEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {

  // Helper to format combined date & time from separate fields or ISO string
  const formatCarDateTime = (dateSource: string | undefined, timeString: string | undefined) => {
    if (!dateSource || !timeString) return 'N/A';
    try {
      let datePart: string;
      // Check if dateSource is likely an ISO string (contains T) or YYYY-MM-DD
      if (dateSource.includes('T')) {
        // Extract YYYY-MM-DD from ISO string
        datePart = formatISO(new Date(dateSource), { representation: 'date' });
      } else {
        // Assume it's already YYYY-MM-DD
        datePart = dateSource;
      }

      // Parse YYYY-MM-DD and HH:mm
      const dateObj = parse(`${datePart} ${timeString}`, 'yyyy-MM-dd HH:mm', new Date());
      // Format as desired
      return format(dateObj, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting car date/time:", { dateSource, timeString }, error);
      return 'Invalid Date/Time';
    }
  };

  // Use specific fields/dates for display
  const pickupDisplayDateTime = formatCarDateTime(event.startDate, event.pickupTime);
  const dropoffDisplayDateTime = formatCarDateTime(event.dropoffDate || event.endDate, event.dropoffTime);

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img src={thumbnail} alt={event.carCompany || 'Rental Car'} className="w-full h-32 object-cover" />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Car className="h-5 w-5 mr-2 text-red-600" />
          {event.carCompany || 'Rental Car'} {event.carType ? `(${event.carType})` : ''}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Car Rental Details
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span>Pickup: {event.pickupLocation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span>Time: {pickupDisplayDateTime}</span>
        </div>
        <div className="flex items-center text-sm space-x-2 mt-1">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span>Dropoff: {event.dropoffLocation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span>Time: {dropoffDisplayDateTime}</span>
        </div>
        {event.licensePlate && (
             <div className="flex items-center text-sm space-x-2">
                <SquareAsterisk className="h-4 w-4 text-gray-500"/>
                <span>License Plate: {event.licensePlate}</span>
            </div>
        )}
        {event.bookingReference && (
            <div className="flex items-center text-sm space-x-2 pt-2 border-t mt-2">
                <Ticket className="h-4 w-4 text-gray-500"/>
                <span>Booking Ref: {event.bookingReference}</span>
            </div>
        )}
        {event.notes && <p className="text-sm mt-2 border-t pt-2">Notes: {event.notes}</p>}
      </CardContent>
      {(onEdit || onDelete) && (
        <CardFooter className="p-2 bg-gray-50 border-t flex justify-end space-x-2">
          {onEdit && (
            <Button variant="outline" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default RentalCarEventCard; 