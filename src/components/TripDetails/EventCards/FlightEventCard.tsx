import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlightEvent } from '@/types/eventTypes';
import { format } from 'date-fns'; // For date formatting
import { Clock, PlaneTakeoff, PlaneLanding, Edit, Trash2 } from 'lucide-react'; // Icons

interface FlightEventCardProps {
  event: FlightEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const FlightEventCard: React.FC<FlightEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  
  // Helper to format date/time - adjust format as needed
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
        <img src={thumbnail} alt={event.airline || 'Flight'} className="w-full h-32 object-cover" />
        {/* Optional: Add overlay or event type badge */}
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          {event.airline || 'Flight'} {event.flightNumber || ''}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Flight Details
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <PlaneTakeoff className="h-4 w-4 text-gray-500" />
          <span>{event.departureAirport || 'N/A'}</span>
          <Clock className="h-4 w-4 text-gray-500" />
          <span>{formatDateTime(event.startDate)}</span> 
        </div>
        <div className="flex items-center text-sm space-x-2">
          <PlaneLanding className="h-4 w-4 text-gray-500" />
          <span>{event.arrivalAirport || 'N/A'}</span>
          <Clock className="h-4 w-4 text-gray-500" />
          <span>{formatDateTime(event.endDate)}</span>
        </div>
        {event.terminal && <p className="text-sm">Terminal: {event.terminal}</p>}
        {event.gate && <p className="text-sm">Gate: {event.gate}</p>}
        {event.bookingReference && <p className="text-sm">Booking Ref: {event.bookingReference}</p>}
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

export default FlightEventCard; 