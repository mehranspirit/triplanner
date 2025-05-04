import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrainEvent } from '@/types/eventTypes';
import { format } from 'date-fns';
import { TrainFront, Clock, MapPin, Edit, Trash2, Ticket, Info } from 'lucide-react';

interface TrainEventCardProps {
  event: TrainEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TrainEventCard: React.FC<TrainEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img 
          src={thumbnail || 'https://images.pexels.com/photos/302428/pexels-photo-302428.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={event.trainOperator || 'Train'} 
          className="w-full h-32 object-cover"
        />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <TrainFront className="h-5 w-5 mr-2 text-green-600" />
          {event.trainOperator || 'Train'} {event.trainNumber || ''}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Train Journey Details
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">From:</span> {event.departureStation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Departs:</span> {formatDateTime(event.departureTime)}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">To:</span> {event.arrivalStation || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Arrives:</span> {formatDateTime(event.arrivalTime)}</span>
        </div>
        {event.trainNumber && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Train:</span> {event.trainNumber}</span>
          </div>
        )}
        {(event.carriageNumber || event.seatNumber) && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span>
              {event.carriageNumber && <span><span className="font-semibold">Carriage:</span> {event.carriageNumber}</span>}
              {event.carriageNumber && event.seatNumber && <span className="mx-1">•</span>}
              {event.seatNumber && <span><span className="font-semibold">Seat:</span> {event.seatNumber}</span>}
            </span>
          </div>
        )}
        {event.bookingReference && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Booking Ref:</span> {event.bookingReference}</span>
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

export default TrainEventCard; 