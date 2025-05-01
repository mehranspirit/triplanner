import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DestinationEvent } from '@/types/eventTypes';
import { format } from 'date-fns';
import { MapPin, Edit, Trash2, Info, Clock } from 'lucide-react';

interface DestinationEventCardProps {
  event: DestinationEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const DestinationEventCard: React.FC<DestinationEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {

  // Destination might be a point in time or span a duration
  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      return format(new Date(isoString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };
  
  const isSinglePointInTime = event.startDate === event.endDate;

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img src={thumbnail} alt={event.placeName} className="w-full h-32 object-cover" />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-purple-600" />
          {event.placeName}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Destination / Point of Interest
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          {isSinglePointInTime ? (
             <span>Time: {formatDateTime(event.startDate)}</span>
          ) : (
             <span>From: {formatDateTime(event.startDate)} To: {formatDateTime(event.endDate)}</span>
          )}
        </div>

        {(event.address || event.location?.address) && (
          <div className="flex items-center text-sm space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>{event.address || event.location?.address}</span>
          </div>
        )}
        {event.openingHours && <p className="text-sm">Hours: {event.openingHours}</p>}
        {event.description && (
           <div className="flex items-start text-sm space-x-2 pt-2 border-t mt-2">
             <Info className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
             <p>{event.description}</p>
           </div>
        )}
         {event.notes && (
              <p className="text-sm mt-2 border-t pt-2">Notes: {event.notes}</p>
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