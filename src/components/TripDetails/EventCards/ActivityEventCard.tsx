import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityEvent } from '@/types/eventTypes';
import { format } from 'date-fns';
import { CalendarClock, MapPin, Edit, Trash2, Info, Activity } from 'lucide-react';

interface ActivityEventCardProps {
  event: ActivityEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {

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
        <img src={thumbnail} alt={event.title} className="w-full h-32 object-cover" />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Activity className="h-5 w-5 mr-2 text-green-600" />
          {event.title}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {event.activityType || 'Activity'}
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <CalendarClock className="h-4 w-4 text-gray-500" />
          <span>Starts: {formatDateTime(event.startDate)}</span>
        </div>
        {/* Assuming endDate might be relevant for activities */} 
        <div className="flex items-center text-sm space-x-2">
           <CalendarClock className="h-4 w-4 text-gray-500" />
           <span>Ends: {formatDateTime(event.endDate)}</span>
        </div>

        {(event.address || event.location?.address) && (
          <div className="flex items-center text-sm space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>{event.address || event.location?.address}</span>
          </div>
        )}

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

export default ActivityEventCard; 