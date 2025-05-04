import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrivalDepartureEvent } from '@/types/eventTypes'; // Use common type
import { format, parse } from 'date-fns';
import { PlaneLanding, Clock, MapPin, Edit, Trash2, Ticket, Info } from 'lucide-react'; // Changed icon

interface ArrivalEventCardProps {
  event: ArrivalDepartureEvent; // Use common type
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ArrivalEventCard: React.FC<ArrivalEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  // Output event object to console for debugging
  console.log('Arrival Event:', {
    id: event.id,
    type: event.type,
    startDate: event.startDate,
    date: event.date,
    time: event.time,
    hasDirectFields: Boolean(event.date && event.time)
  });

  // Format raw date and time strings without timezone conversion
  const formatRawDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return 'N/A';
    try {
      // Combine date and time, parse without timezone interpretation
      const combinedStr = `${dateStr} ${timeStr}`;
      console.log('Formatting raw date/time:', combinedStr);
      const date = parse(combinedStr, 'yyyy-MM-dd HH:mm', new Date());
      console.log('Parsed date:', date.toString());
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting raw date/time:", error);
      return 'Invalid Date/Time';
    }
  };

  // Use date String constructor to avoid timezone issues
  const formatRawDateTimeDirect = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return 'N/A';
    try {
      // Just display the raw values with simple formatting
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      
      return `${monthNames[month-1]} ${day}, ${year} ${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch (error) {
      console.error("Error directly formatting date/time:", error);
      return 'Invalid Date/Time';
    }
  };

  // Determine which time display method to use
  const arrivalTimeDisplay = () => {
    // Get time directly from event object
    const hasDateTimeFields = event.date && event.time && 
                            event.date !== "" && event.time !== "";
    
    console.log("ArrivalEventCard: Attempting to display time with data:", {
      date: event.date,
      time: event.time,
      hasDateTimeFields,
      fullEvent: JSON.stringify(event)
    });
    
    // Try using direct fields if available
    if (hasDateTimeFields) {
      console.log('Using raw date/time fields from event object', event.date, event.time);
      return formatRawDateTimeDirect(event.date, event.time);
    }
    
    // Fall back to providing a message if the event appears to be incomplete
    console.log('No valid dates found, returning message');
    return 'Time not set';
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img 
          src={thumbnail || 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300'} 
          alt={`Arrival at ${event.airport}`} 
          className="w-full h-32 object-cover"
        />
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <PlaneLanding className="h-5 w-5 mr-2 text-cyan-600" /> {/* Changed icon */}
          Arrival at {event.airport}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
           {event.airline || 'Flight'} {event.flightNumber || ''}
        </CardDescription>
        
        <div className="flex items-center text-sm space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span><span className="font-semibold">Arrives:</span> {arrivalTimeDisplay()}</span>
        </div>
        
        {(event.terminal || event.gate) && (
          <div className="flex items-center text-sm space-x-2">
            <Info className="h-4 w-4 text-gray-500" />
            <span>
              {event.terminal && <span><span className="font-semibold">Terminal:</span> {event.terminal}</span>}
              {event.terminal && event.gate && <span className="mx-1">•</span>}
              {event.gate && <span><span className="font-semibold">Gate:</span> {event.gate}</span>}
            </span>
          </div>
        )}
        
        {event.bookingReference && (
          <div className="flex items-center text-sm space-x-2">
            <Ticket className="h-4 w-4 text-gray-500"/>
            <span><span className="font-semibold">Booking Ref:</span> {event.bookingReference}</span>
          </div>
        )}
        {event.location?.address && (
          <div className="flex items-center text-sm space-x-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span><span className="font-semibold">Location:</span> {event.location.address}</span>
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

export default ArrivalEventCard; 