import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { Clock, MapPin, Edit, Trash2, Info } from 'lucide-react';
import { FaMountain } from 'react-icons/fa';

interface ActivityEventCardProps {
  event: ActivityEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  const formatDateTime = (date: string, time: string) => {
    if (!date) return '';
    // Parse as local date, not UTC, to avoid timezone shift
    const parsed = parse(date, 'yyyy-MM-dd', new Date());
    if (isNaN(parsed.getTime())) return date + (time ? ` at ${time}` : '');
    return `${format(parsed, 'MMM d, yyyy')}${time ? ` at ${time}` : ''}`;
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img 
          src={thumbnail || 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={event.title} 
          className="w-full h-32 object-cover"
        />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <FaMountain className="h-5 w-5 mr-2 text-indigo-600" />
          {event.title}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {event.activityType}
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

export default ActivityEventCard; 