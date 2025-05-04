import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StayEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { Clock, MapPin, Edit, Trash2, Info, Hotel } from 'lucide-react';

interface StayEventCardProps {
  event: StayEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const StayEventCard: React.FC<StayEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  // Output event object to console for debugging
  console.log('Stay Event:', {
    id: event.id,
    type: event.type,
    checkIn: event.checkIn,
    checkInTime: event.checkInTime,
    checkOut: event.checkOut,
    checkOutTime: event.checkOutTime,
    startDate: event.startDate,
    endDate: event.endDate
  });

  const formatDateTime = (dateString: string, timeString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parse(dateString, 'yyyy-MM-dd', new Date());
      if (timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        date.setHours(hours, minutes);
      }
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date/time:", error);
      return 'Invalid Date';
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img 
          src={thumbnail || 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={event.accommodationName} 
          className="w-full h-32 object-cover"
        />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Hotel className="h-5 w-5 mr-2 text-blue-600" />
          {event.accommodationName}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {event.status === 'confirmed' ? 'Confirmed Booking' : 'Exploring Options'}
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Check-in:</span> {formatDateTime(event.checkIn, event.checkInTime)}</span>
        </div>

        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Check-out:</span> {formatDateTime(event.checkOut, event.checkOutTime)}</span>
        </div>

        {event.address && (
          <div className="flex items-center text-sm space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Address:</span> {event.address}</span>
          </div>
        )}
        {event.reservationNumber && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Reservation:</span> {event.reservationNumber}</span>
          </div>
        )}
        {event.contactInfo && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Contact:</span> {event.contactInfo}</span>
          </div>
        )}
        {event.notes && (
          <div className="flex items-start text-sm space-x-2 pt-2 border-t mt-2">
            <Info className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
            <p><span className="font-semibold">Notes:</span> {event.notes}</p>
          </div>
        )}
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

export default StayEventCard; 