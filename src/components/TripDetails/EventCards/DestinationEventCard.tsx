import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DestinationEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { Clock, MapPin, Edit, Trash2, Info } from 'lucide-react';

interface DestinationEventCardProps {
  event: DestinationEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const DestinationEventCard: React.FC<DestinationEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  const formatDateTime = (dateStr: string, timeStr: string): string => {
    if (!dateStr) return 'N/A';
    try {
      // Parse the date string directly without timezone conversion
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Format the date
      const formattedDate = format(date, 'MMM d, yyyy');
      
      // Format the time
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        const formattedTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        return `${formattedDate} at ${formattedTime}`;
      }
      
      return formattedDate;
    } catch (error) {
      console.error("Error formatting date/time:", error);
      return 'Invalid Date';
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img 
          src={thumbnail || 'https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={event.placeName} 
          className="w-full h-32 object-cover"
        />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-pink-600" />
          {event.placeName}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Destination Details
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Start:</span> {formatDateTime(event.startDate, event.startTime)}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">End:</span> {formatDateTime(event.endDate, event.endTime)}</span>
        </div>
        {event.address && (
          <div className="flex items-center text-sm space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Location:</span> {event.address}</span>
          </div>
        )}
        {event.description && (
          <div className="flex items-start text-sm space-x-2 pt-2 border-t mt-2">
            <Info className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
            <p><span className="font-semibold">Description:</span> {event.description}</p>
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

export default DestinationEventCard; 