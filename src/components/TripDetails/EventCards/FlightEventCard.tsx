import React from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlightEvent } from '@/types/eventTypes';
import { format } from 'date-fns'; // For date formatting
import { Clock, Edit, Trash2, MapPin, Info, MoreVertical, CheckCircle2, Search } from 'lucide-react'; // Icons
import { FaPlane } from 'react-icons/fa'; // Import FaPlane from react-icons
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface FlightEventCardProps {
  event: FlightEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
}

const FlightEventCard: React.FC<FlightEventCardProps> = ({ event, thumbnail, onEdit, onDelete, onStatusChange }) => {
  
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

  const isExploring = event.status === 'exploring';

  return (
    <Card className={cn(
      "overflow-hidden h-full transition-all duration-200",
      isExploring 
        ? "bg-white border-2 border-gray-300 border-dashed" 
        : "bg-white"
    )}>
      <div className="flex h-full">
        {/* Narrower thumbnail (25% instead of 33%) */}
        <div className="w-1/4 relative">
          <div className="absolute inset-0">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.airline || 'Flight'} 
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            {/* More subtle color overlay */}
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-sky-500/10 to-sky-900/30"
            )}></div>
            {isExploring && (
              <>
                <div className="absolute inset-0 opacity-[0.15] mix-blend-multiply">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_8px,_#000_9px)] bg-[length:12px_12px]"></div>
                </div>
                <div className="absolute inset-0">
                  <div className="absolute w-full h-full border-2 border-gray-300 border-dashed opacity-40"></div>
                  <div className="absolute left-2 top-2 w-[calc(100%-16px)] h-[calc(100%-16px)] border-2 border-gray-300 border-dashed opacity-30"></div>
                </div>
              </>
            )}
          </div>
          
          {/* Centered icon badge */}
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
            <div className={cn(
              "rounded-full p-4 transition-all duration-200",
              isExploring 
                ? "bg-transparent border-2 border-gray-400 border-dashed" 
                : "bg-white/90 shadow-lg"
            )}>
              <FaPlane className={cn(
                "h-8 w-8 transition-all duration-200",
                isExploring ? "text-gray-400" : "text-blue-500"
              )} />
            </div>
          </div>
          
          {/* Prominent event type badge at top left */}
          <div className={cn(
            "absolute top-2 left-2 px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all duration-200",
            isExploring 
              ? "bg-white border-2 border-gray-300 border-dashed text-gray-600"
              : "bg-sky-600 text-white"
          )}>
            {isExploring ? (
              <>
                <Search className="w-3 h-3" />
                <span className="font-medium text-xs tracking-wide">FLIGHT</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium text-xs">Flight</span>
              </>
            )}
          </div>
        </div>
        
        {/* Content taking up more space (75% instead of 67%) */}
        <div className={cn(
          "w-3/4 p-4 flex flex-col relative transition-all duration-200",
          isExploring && "bg-[linear-gradient(0deg,transparent_calc(1.5rem_-_1px),#e5e7eb_calc(1.5rem),transparent_calc(1.5rem_+_1px))] bg-[size:100%_1.5rem]"
        )}>
          <div className="flex-grow space-y-2 relative">
            <div className="flex justify-between items-start">
              <CardTitle className={cn(
                "text-lg transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                {event.airline || 'Flight'} {event.flightNumber || ''}
              </CardTitle>
              {(onEdit || onDelete || onStatusChange) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn(
                      "h-8 w-8",
                      isExploring && "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onStatusChange && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => onStatusChange(isExploring ? 'confirmed' : 'exploring')}
                          className="flex items-center"
                        >
                          {isExploring ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                              <span>Mark as Confirmed</span>
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2 text-gray-600" />
                              <span>Change to Exploring</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {onEdit && (
                      <DropdownMenuItem onClick={onEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center text-sm space-x-2">
              <Clock className={cn(
                "h-4 w-4 transition-all duration-200",
                isExploring ? "text-gray-400" : "text-gray-500"
              )} />
              <span className={cn(
                "transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                <span className="font-semibold">Departure:</span> {formatDateTime(event.departureTime)}
              </span>
            </div>

            <div className="flex items-center text-sm space-x-2">
              <Clock className={cn(
                "h-4 w-4 transition-all duration-200",
                isExploring ? "text-gray-400" : "text-gray-500"
              )} />
              <span className={cn(
                "transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                <span className="font-semibold">Arrival:</span> {formatDateTime(event.arrivalTime)}
              </span>
            </div>

            <div className="flex items-center text-sm space-x-2">
              <MapPin className={cn(
                "h-4 w-4 transition-all duration-200",
                isExploring ? "text-gray-400" : "text-gray-500"
              )} />
              <span className={cn(
                "transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                <span className="font-semibold">From:</span> {event.departureAirport}
              </span>
            </div>

            <div className="flex items-center text-sm space-x-2">
              <MapPin className={cn(
                "h-4 w-4 transition-all duration-200",
                isExploring ? "text-gray-400" : "text-gray-500"
              )} />
              <span className={cn(
                "transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                <span className="font-semibold">To:</span> {event.arrivalAirport}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
              {event.flightNumber && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Flight:</span> {event.flightNumber}
                  </span>
                </div>
              )}
              {event.airline && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Airline:</span> {event.airline}
                  </span>
                </div>
              )}
              {event.bookingReference && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Booking Ref:</span> {event.bookingReference}
                  </span>
                </div>
              )}
              {event.terminal && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Terminal:</span> {event.terminal}
                  </span>
                </div>
              )}
              {event.gate && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Gate:</span> {event.gate}
                  </span>
                </div>
              )}
            </div>
            
            {event.notes && (
              <div className="flex items-start text-xs space-x-1 pt-2 border-t mt-2">
                <Info className={cn(
                  "h-3 w-3 mt-1 flex-shrink-0 transition-all duration-200",
                  isExploring ? "text-gray-400" : "text-gray-500"
                )} />
                <p className={cn(
                  "transition-all duration-200",
                  isExploring ? "text-gray-600" : "text-gray-900"
                )}>
                  <span className="font-semibold">Notes:</span> {event.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default FlightEventCard; 