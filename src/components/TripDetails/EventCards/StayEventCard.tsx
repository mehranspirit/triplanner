import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StayEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { BedDouble, CalendarDays, Clock, Edit, Trash2 } from 'lucide-react';

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

  const formatDisplayDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const dateObj = parse(dateString, 'yyyy-MM-dd', new Date());
      return format(dateObj, 'MMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Invalid Date';
    }
  };

  const formatDisplayTime = (timeString: string | undefined) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch (error) {
      console.error("Error formatting time:", timeString, error);
      return '';
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img src={thumbnail} alt={event.accommodationName} className="w-full h-32 object-cover" />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <BedDouble className="h-5 w-5 mr-2 text-blue-600" />
          {event.accommodationName}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {event.status === 'confirmed' ? 'Confirmed Booking' : 'Exploring Options'}
        </CardDescription>
        
        <div className="space-y-1">
          <div className="flex items-center text-sm space-x-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <span>Check-in: {formatDisplayDate(event.checkIn)}</span>
          </div>
          <div className="flex items-center text-sm space-x-2 ml-6">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>at {formatDisplayTime(event.checkInTime || '14:00')}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center text-sm space-x-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <span>Check-out: {formatDisplayDate(event.checkOut)}</span>
          </div>
          <div className="flex items-center text-sm space-x-2 ml-6">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>at {formatDisplayTime(event.checkOutTime || '11:00')}</span>
          </div>
        </div>

        {event.address && <p className="text-sm">Address: {event.address}</p>}
        {event.reservationNumber && <p className="text-sm">Reservation: {event.reservationNumber}</p>}
        {event.contactInfo && <p className="text-sm">Contact: {event.contactInfo}</p>}
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

export default StayEventCard; 