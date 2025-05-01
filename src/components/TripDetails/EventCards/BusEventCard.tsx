import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BusEvent } from '@/types/eventTypes';
import { format } from 'date-fns';
import { Bus, Clock, MapPin, Edit, Trash2, Ticket } from 'lucide-react';

interface BusEventCardProps {
  event: BusEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const BusEventCard: React.FC<BusEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {

  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      return format(new Date(isoString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img src={thumbnail} alt={event.busOperator || 'Bus'} className="w-full h-32 object-cover" />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Bus className="h-5 w-5 mr-2 text-orange-600" />
          {event.busOperator || 'Bus'} {event.busNumber || ''}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Bus Journey Details
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span>From: {event.departureStation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span>Departs: {formatDateTime(event.startDate)}</span>
        </div>
        <div className="flex items-center text-sm space-x-2 mt-1">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span>To: {event.arrivalStation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span>Arrives: {formatDateTime(event.endDate)}</span>
        </div>
        {event.seatNumber && <p className="text-sm">Seat: {event.seatNumber}</p>}
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

export default BusEventCard; 