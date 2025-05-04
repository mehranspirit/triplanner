import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlightEvent } from '@/types/eventTypes';
import { format } from 'date-fns'; // For date formatting
import { Clock, PlaneTakeoff, PlaneLanding, Edit, Trash2, MapPin, Info } from 'lucide-react'; // Icons

interface FlightEventCardProps {
  event: FlightEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const FlightEventCard: React.FC<FlightEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  
  // Helper to format date/time - adjust format as needed
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
          src={thumbnail || 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={event.airline || 'Flight'} 
          className="w-full h-32 object-cover"
        />
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
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Departure:</span> {formatDateTime(event.departureTime)}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Arrival:</span> {formatDateTime(event.arrivalTime)}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">From:</span> {event.departureAirport}</span>
        </div>
        <div className="flex items-center text-sm space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">To:</span> {event.arrivalAirport}</span>
        </div>
        {event.flightNumber && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Flight:</span> {event.flightNumber}</span>
          </div>
        )}
        {event.airline && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Airline:</span> {event.airline}</span>
          </div>
        )}
        {event.bookingReference && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Booking Ref:</span> {event.bookingReference}</span>
          </div>
        )}
        {event.terminal && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Terminal:</span> {event.terminal}</span>
          </div>
        )}
        {event.gate && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Gate:</span> {event.gate}</span>
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

export default FlightEventCard; 