import React, { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DestinationEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { 
  Clock, 
  Edit, 
  Trash2, 
  Info, 
  MapPin, 
  MoreVertical, 
  CheckCircle2, 
  Search,
  Map,
  Share,
  Calendar,
  Globe,
  ExternalLink
} from 'lucide-react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { CollapsibleContent, ShowMoreButton } from './utils';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { isEventCurrentlyActive } from '@/utils/eventGlow';

interface DestinationEventCardProps {
  event: DestinationEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
}

const DestinationEventCard: React.FC<DestinationEventCardProps> = ({ event, thumbnail, onEdit, onDelete, onStatusChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event);

  const formatDateTime = (date: string, time: string) => {
    if (!date) return '';
    // Parse as local date, not UTC, to avoid timezone shift
    const parsed = parse(date, 'yyyy-MM-dd', new Date());
    if (isNaN(parsed.getTime())) return date + (time ? ` at ${time}` : '');
    return `${format(parsed, 'MMM d, yyyy')}${time ? ` at ${time}` : ''}`;
  };

  // Quick action handlers
  const handleMapClick = () => {
    const searchQuery = encodeURIComponent(event.address || event.placeName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${searchQuery}`, '_blank');
  };

  const handleCalendarClick = () => {
    const startDate = parse(event.startDate, 'yyyy-MM-dd', new Date());
    const endDate = parse(event.endDate, 'yyyy-MM-dd', new Date());
    
    if (event.startTime) {
      const [hours, minutes] = event.startTime.split(':').map(Number);
      startDate.setHours(hours, minutes);
    }
    if (event.endTime) {
      const [hours, minutes] = event.endTime.split(':').map(Number);
      endDate.setHours(hours, minutes);
    }
    
    const calendarUrl = new URL('https://calendar.google.com/calendar/render');
    calendarUrl.searchParams.append('action', 'TEMPLATE');
    calendarUrl.searchParams.append('text', `Visit ${event.placeName}`);
    calendarUrl.searchParams.append('details', `${event.description || ''}\n${event.notes || ''}\n${event.address ? `Location: ${event.address}` : ''}`);
    calendarUrl.searchParams.append('dates', `${format(startDate, 'yyyyMMdd\'T\'HHmmss')}/${format(endDate, 'yyyyMMdd\'T\'HHmmss')}`);
    
    window.open(calendarUrl.toString(), '_blank');
  };

  const handleShareClick = () => {
    const shareText = `Visiting ${event.placeName}\nDate: ${formatDateTime(event.startDate, event.startTime)} - ${formatDateTime(event.endDate, event.endTime)}\n${event.address ? `Location: ${event.address}\n` : ''}${event.description || ''}`;
    navigator.clipboard.writeText(shareText);
  };

  const handleSearchClick = () => {
    const searchQuery = encodeURIComponent(`${event.placeName} tourist information`);
    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
  };

  const hasLongContent = (event.description?.length || 0) > 100 || (event.notes?.length || 0) > 100;

  return (
    <Card className={cn(
      "overflow-hidden h-full transition-all duration-200 group relative",
      isExploring 
        ? "bg-white border-2 border-gray-300 border-dashed" 
        : "bg-white"
    )}>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleMapClick}
                title="View on Map"
              >
                <Map className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleSearchClick}
                title="Search Information"
              >
                <Globe className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleCalendarClick}
                title="Add to Calendar"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleShareClick}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleMapClick}
                title="View on Map"
              >
                <Map className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleSearchClick}
                title="Search Information"
              >
                <Globe className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleCalendarClick}
                title="Add to Calendar"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                onClick={handleShareClick}
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
              src={thumbnail || 'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.placeName}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-pink-500/10 to-pink-900/30"
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
            icon={<FaMapMarkerAlt />}
            isActive={isActive}
            isExploring={isExploring}
            eventType="destination"
          />
          
          <div className={cn(
            "absolute top-2 left-2 px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all duration-200",
            isExploring 
              ? "bg-white border-2 border-gray-300 border-dashed text-gray-600"
              : "bg-pink-600 text-white"
          )}>
            {isExploring ? (
              <>
                <Search className="w-3 h-3" />
                <span className="font-medium text-xs tracking-wide">DESTINATION</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium text-xs">Destination</span>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile Thumbnail */}
        <div className="absolute top-2 right-2 w-16 h-16 md:hidden block">
          <div className="relative w-full h-full rounded-lg overflow-hidden">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/21014/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.placeName || 'Destination'}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-pink-500/10 to-pink-900/30"
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
            : "bg-pink-600 text-white shadow-sm"
        )}>
          {isExploring ? (
            <>
              <Search className="w-3 h-3" />
              <span className="font-medium text-xs tracking-wide">DESTINATION</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium text-xs">Destination</span>
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
                "text-lg transition-all duration-200 md:pr-0 pr-20",
                isExploring ? "text-gray-600" : "text-gray-900"
              )}>
                {event.placeName}
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
                <span className="font-semibold">Start:</span> {formatDateTime(event.startDate, event.startTime)}
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
                <span className="font-semibold">End:</span> {formatDateTime(event.endDate, event.endTime)}
              </span>
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
                  <span className="font-semibold">Location:</span> {event.address}
                </span>
              </div>
            )}

            {/* Description and Notes Section */}
            {(event.description || event.notes) && (
              <div className="mt-2 space-y-2">
                {event.description && (
                  <CollapsibleContent
                    content={event.description}
                    label="Description"
                    isExpanded={isExpanded}
                    isExploring={isExploring}
                  />
                )}
                
                {event.notes && (
                  <CollapsibleContent
                    content={event.notes}
                    label="Notes"
                    isExpanded={isExpanded}
                    isExploring={isExploring}
                  />
                )}

                {hasLongContent && (
                  <ShowMoreButton
                    isExpanded={isExpanded}
                    onClick={() => setIsExpanded(!isExpanded)}
                    isExploring={isExploring}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default DestinationEventCard; 