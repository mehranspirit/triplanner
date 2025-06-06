import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrivalDepartureEvent } from '@/types/eventTypes'; // Use common type
import { format, parse } from 'date-fns';
import { PlaneLanding, Clock, MapPin, Edit, Trash2, Ticket } from 'lucide-react'; // Changed icon

interface ArrivalEventCardProps {
  event: ArrivalDepartureEvent; // Use common type
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ArrivalEventCard: React.FC<ArrivalEventCardProps> = ({ event, thumbnail, onEdit, onDelete }) => {
  // Output event object to console for debugging
  // console.log('Arrival Event:', {
  //   id: event.id,
  //   type: event.type,
  //   startDate: event.startDate,
  //   arrivalDate: event.arrivalDate,
  //   arrivalTime: event.arrivalTime,
  //   hasDirectFields: Boolean(event.arrivalDate && event.arrivalTime)
  // });

  const formatDateTime = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
        // Arrival is typically a point in time
        const date = new Date(isoString);
        //console.log('Formatting ISO string:', isoString, 'results in date:', date.toString());
        return format(date, 'MMM d, yyyy h:mm a'); 
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  // Format ISO string directly to extract UTC time without timezone conversion
  const formatIsoStringAsUTC = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      // Extract date and time directly from the ISO string
      // Format: "2025-06-28T21:55:00.000Z"
      const dateString = isoString.substring(0, 10); // "2025-06-28"
      const timeString = isoString.substring(11, 16); // "21:55"
      
      // Format using our direct formatting method
      return formatRawDateTimeDirect(dateString, timeString);
    } catch (error) {
      console.error("Error formatting ISO string as UTC:", error);
      return 'Invalid Date';
    }
  };

  // Format raw date and time strings without timezone conversion
  const formatRawDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return 'N/A';
    try {
      // Combine date and time, parse without timezone interpretation
      const combinedStr = `${dateStr} ${timeStr}`;
      //console.log('Formatting raw date/time:', combinedStr);
      const date = parse(combinedStr, 'yyyy-MM-dd HH:mm', new Date());
      //console.log('Parsed date:', date.toString());
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
    if (event.arrivalDate && event.arrivalTime) {
      //console.log('Using raw date/time fields', event.arrivalDate, event.arrivalTime);
      // Use direct method to avoid any Date object timezone issues
      return formatRawDateTimeDirect(event.arrivalDate, event.arrivalTime);
    }
    //console.log('Falling back to startDate', event.startDate);
    // Use the UTC time from startDate without timezone conversion
    return formatIsoStringAsUTC(event.startDate);
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="p-0 relative">
        <img src={thumbnail} alt={`Arrival at ${event.airport}`} className="w-full h-32 object-cover" />
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
          <span>Arrives: {arrivalTimeDisplay()}</span> 
        </div>
        
        {(event.terminal || event.gate) && (
            <p className="text-sm">Terminal: {event.terminal || 'N/A'}, Gate: {event.gate || 'N/A'}</p>
        )}
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

export default ArrivalEventCard; 