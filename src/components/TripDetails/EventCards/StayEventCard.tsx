import React, { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StayEvent } from '@/types/eventTypes';
import { format, parse, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { 
  Clock, 
  MapPin, 
  Edit, 
  Trash2, 
  Info, 
  MoreVertical, 
  CheckCircle2, 
  Search,
  ChevronDown,
  ChevronUp,
  Map,
  Share,
  Calendar,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { FaHotel } from 'react-icons/fa';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { CollapsibleContent, ShowMoreButton } from './utils';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { isEventCurrentlyActive } from '@/utils/eventGlow';

interface StayEventCardProps {
  event: StayEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
}

const renderTextWithLinks = (text: string) => {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Split text by URLs and map each part
  const parts = text.split(urlPattern);
  
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return part;
  });
};

const StayEventCard: React.FC<StayEventCardProps> = ({ event, thumbnail, onEdit, onDelete, onStatusChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event);

  // Check if the stay event is currently active
  const isCurrentlyActive = () => {
    const today = new Date();
    const checkInDate = parse(event.checkIn, 'yyyy-MM-dd', new Date());
    const checkOutDate = parse(event.checkOut, 'yyyy-MM-dd', new Date());
    
    return isWithinInterval(today, {
      start: startOfDay(checkInDate),
      end: endOfDay(checkOutDate)
    });
  };

  const handleOpenInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`, '_blank');
    }
  };

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const title = `Stay at ${event.accommodationName}`;
    const details = `Check-in: ${event.checkInTime}\nCheck-out: ${event.checkOutTime}\n${event.address || ''}\n${event.notes || ''}`;
    const startDate = event.checkIn;
    const endDate = event.checkOut;
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate.replace(/-/g, '')}/${endDate.replace(/-/g, '')}&details=${encodeURIComponent(details)}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `Stay at ${event.accommodationName}\nCheck-in: ${event.checkIn} ${event.checkInTime}\nCheck-out: ${event.checkOut} ${event.checkOutTime}\n${event.address || ''}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Trip Stay Details',
          text: text
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(text);
    }
  };

  // Output event object to console for debugging
  // console.log('Stay Event:', {
  //   id: event.id,
  //   type: event.type,
  //   checkIn: event.checkIn,
  //   checkInTime: event.checkInTime,
  //   checkOut: event.checkOut,
  //   checkOutTime: event.checkOutTime,
  //   startDate: event.startDate,
  //   endDate: event.endDate
  // });

  const formatDateTime = (dateString: string, timeString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parse(dateString, 'yyyy-MM-dd', new Date());
      if (timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        date.setHours(hours, minutes);
      }
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date/time:", error);
      return 'Invalid Date';
    }
  };

  const hasLongContent = (event.description?.length || 0) > 100 || (event.notes?.length || 0) > 100;

  return (
    <Card className={cn(
      "overflow-hidden h-full transition-all duration-200 group relative",
      isExploring 
        ? "bg-white border-2 border-gray-300 border-dashed" 
        : "bg-white"
    )}>
      {/* Remove the card-level glow effect */}

      {/* Action Menu Button - Desktop */}
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 md:block hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm border border-gray-100/50 backdrop-blur-sm transition-all duration-200 data-[state=open]:bg-gray-100/80"
            >
              <MoreVertical className="h-4 w-4 text-gray-500 transition-transform duration-200 ease-in-out data-[state=open]:rotate-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-10 p-1 rounded-xl shadow-lg border border-gray-100/50 bg-white/95 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2" 
            align="center"
            side="bottom"
            alignOffset={-28}
            sideOffset={5}
          >
            <div 
              className="flex flex-col gap-1 relative before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:-translate-y-[6px] before:w-[2px] before:h-[6px] before:bg-gray-200"
            >
              {event.address && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={handleOpenInMaps}
                  title="Open in Maps"
                >
                  <Map className="h-4 w-4 text-gray-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleAddToCalendar}
                title="Add to Calendar"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleShare}
                title="Share"
              >
                <Share className="h-4 w-4 text-gray-500" />
              </Button>
              {onStatusChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => onStatusChange(isExploring ? 'confirmed' : 'exploring')}
                  title={isExploring ? "Mark as Confirmed" : "Change to Exploring"}
                >
                  {isExploring ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Search className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={onEdit}
                  title="Edit"
                >
                  <Edit className="h-4 w-4 text-gray-500" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                  onClick={onDelete}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Action Menu Button - Mobile */}
      <div className="absolute right-2 top-[4.5rem] opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 md:hidden block">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm border border-gray-100/50 backdrop-blur-sm transition-all duration-200 data-[state=open]:bg-gray-100/80"
            >
              <MoreVertical className="h-4 w-4 text-gray-500 transition-transform duration-200 ease-in-out data-[state=open]:rotate-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-10 p-1 rounded-xl shadow-lg border border-gray-100/50 bg-white/95 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2" 
            align="center"
            side="bottom"
            alignOffset={-28}
            sideOffset={5}
          >
            <div 
              className="flex flex-col gap-1 relative before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:-translate-y-[6px] before:w-[2px] before:h-[6px] before:bg-gray-200"
            >
              {event.address && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={handleOpenInMaps}
                  title="Open in Maps"
                >
                  <Map className="h-4 w-4 text-gray-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleAddToCalendar}
                title="Add to Calendar"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleShare}
                title="Share"
              >
                <Share className="h-4 w-4 text-gray-500" />
              </Button>
              {onStatusChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => onStatusChange(isExploring ? 'confirmed' : 'exploring')}
                  title={isExploring ? "Mark as Confirmed" : "Change to Exploring"}
                >
                  {isExploring ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Search className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  onClick={onEdit}
                  title="Edit"
                >
                  <Edit className="h-4 w-4 text-gray-500" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                  onClick={onDelete}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex h-full">
        <div className="w-1/4 relative md:block hidden">
          <div className="absolute inset-0">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.accommodationName}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-yellow-500/10 to-yellow-900/30"
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
          
          <GlowingIcon
            icon={<FaHotel />}
            isActive={isActive}
            isExploring={isExploring}
            eventType="stay"
          />
          
          <div className={cn(
            "absolute top-2 left-2 px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all duration-200",
            isExploring 
              ? "bg-white border-2 border-gray-300 border-dashed text-gray-600"
              : "bg-yellow-600 text-white"
          )}>
            {isExploring ? (
              <>
                <Search className="w-3 h-3" />
                <span className="font-medium text-xs tracking-wide">STAY</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium text-xs">Stay</span>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile Thumbnail */}
        <div className="absolute top-2 right-2 w-16 h-16 md:hidden block">
          <div className="relative w-full h-full rounded-lg overflow-hidden">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.accommodationName || 'Stay'}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-yellow-500/10 to-yellow-900/30"
            )}></div>
            {isExploring && (
              <>
                <div className="absolute inset-0 opacity-[0.15] mix-blend-multiply">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_8px,_#000_9px)] bg-[length:12px_12px]"></div>
                </div>
                <div className="absolute inset-0">
                  <div className="absolute w-full h-full border-2 border-gray-300 border-dashed opacity-40"></div>
                  <div className="absolute left-1 top-1 w-[calc(100%-8px)] h-[calc(100%-8px)] border-2 border-gray-300 border-dashed opacity-30"></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Event Badge */}
        <div className={cn(
          "absolute top-2 left-2 px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all duration-200 md:hidden",
          isExploring 
            ? "bg-white border-2 border-gray-300 border-dashed text-gray-600"
            : "bg-yellow-600 text-white shadow-sm"
        )}>
          {isExploring ? (
            <>
              <Search className="w-3 h-3" />
              <span className="font-medium text-xs tracking-wide">STAY</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium text-xs">Stay</span>
            </>
          )}
        </div>
        
        <div className={cn(
          "w-full md:w-3/4 p-4 flex flex-col relative transition-all duration-200",
          "pt-12 md:pt-4",
          isExploring && "bg-[linear-gradient(0deg,transparent_calc(1.5rem_-_1px),#e5e7eb_calc(1.5rem),transparent_calc(1.5rem_+_1px))] bg-[size:100%_1.5rem]"
        )}>
          <div className="flex-grow space-y-2 relative">
            <div className="flex justify-between items-start">
              <CardTitle className={cn(
                "text-lg transition-all duration-200",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                {event.accommodationName}
              </CardTitle>
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
                <span className="font-semibold">Check-in:</span> {formatDateTime(event.checkIn, event.checkInTime)}
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
                <span className="font-semibold">Check-out:</span> {formatDateTime(event.checkOut, event.checkOutTime)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
              {event.reservationNumber && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Reservation:</span> {event.reservationNumber}
                  </span>
                </div>
              )}
              {event.contactInfo && (
                <div className="flex items-center text-xs space-x-1">
                  <Info className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isExploring ? "text-gray-400" : "text-gray-500"
                  )} />
                  <span className={cn(
                    "transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-900"
                  )}>
                    <span className="font-semibold">Contact:</span> {event.contactInfo}
                  </span>
                </div>
              )}
            </div>
            
            {event.address && (
              <div className="flex items-center text-sm space-x-2">
                <MapPin className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isExploring ? "text-gray-400" : "text-gray-500"
                )} />
                <span className={cn(
                  "transition-all duration-200",
                  isExploring ? "text-gray-600" : "text-gray-900"
                )}>
                  <span className="font-semibold">Address:</span> {event.address}
                </span>
              </div>
            )}
            
            {/* Description and Notes Section */}
            {(event.description || event.notes) && (
              <div className="mt-2 space-y-2">
                {event.description && (
                  <div className={cn(
                    "text-sm transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-700",
                    !isExpanded && hasLongContent && "line-clamp-2"
                  )}>
                    <span className="font-semibold">Description: </span>
                    {renderTextWithLinks(event.description)}
              </div>
            )}
            
            {event.notes && (
                  <div className={cn(
                    "text-sm transition-all duration-200",
                    isExploring ? "text-gray-600" : "text-gray-700",
                    !isExpanded && hasLongContent && "line-clamp-2"
                  )}>
                    <span className="font-semibold">Notes: </span>
                    {renderTextWithLinks(event.notes)}
                  </div>
                )}

                {hasLongContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full mt-1 text-xs flex items-center justify-center gap-1",
                      isExploring ? "text-gray-600 hover:text-gray-900" : "text-gray-500 hover:text-gray-700"
                    )}
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <>
                        Show less <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StayEventCard; 