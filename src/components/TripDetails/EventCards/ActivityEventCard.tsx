import React, { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { 
  Clock, 
  MapPin, 
  Edit, 
  Trash2, 
  Info, 
  MoreVertical, 
  CheckCircle2, 
  Search,
  Map,
  Share,
  Calendar,
  ExternalLink,
  Ticket
} from 'lucide-react';
import { FaMountain } from 'react-icons/fa';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { CollapsibleContent, ShowMoreButton } from './utils';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { isEventCurrentlyActive } from '@/utils/eventGlow';

interface ActivityEventCardProps {
  event: ActivityEvent;
  thumbnail: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
}

const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event, thumbnail, onEdit, onDelete, onStatusChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event);

  const handleOpenInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`, '_blank');
    }
  };

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const title = event.title;
    const details = `${event.description || ''}\n${event.notes || ''}\n${event.address || ''}`;
    
    // Format dates for Google Calendar
    const startDate = event.startDate.replace(/-/g, '');
    const endDate = event.endDate.replace(/-/g, '');
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `Activity: ${event.title}\nDate: ${formatDateTime(event.startDate, event.startTime)} - ${formatDateTime(event.endDate, event.endTime)}\n${event.address ? `Location: ${event.address}\n` : ''}${event.description || ''}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Activity Details',
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

  const formatDateTime = (date: string, time: string) => {
    if (!date) return '';
    // Parse as local date, not UTC, to avoid timezone shift
    const parsed = parse(date, 'yyyy-MM-dd', new Date());
    if (isNaN(parsed.getTime())) return date + (time ? ` at ${time}` : '');
    return `${format(parsed, 'MMM d, yyyy')}${time ? ` at ${time}` : ''}`;
  };

  const hasLongContent = (event.description?.length || 0) > 100 || (event.notes?.length || 0) > 100;

  return (
    <Card className={cn(
      "overflow-hidden h-full transition-all duration-200 group relative",
      isExploring 
        ? "bg-white border-2 border-gray-300 border-dashed" 
        : "bg-white"
    )}>
      {/* Action Menu Button */}
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
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
        <div className="w-1/4 relative">
          <div className="absolute inset-0">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/2647922/pexels-photo-2647922.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.title}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "grayscale opacity-30 contrast-125"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-white/80 to-transparent"
                : "bg-gradient-to-br from-indigo-500/10 to-indigo-900/30"
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
            icon={<FaMountain />}
            isActive={isActive}
            isExploring={isExploring}
            eventType="activity"
          />
          
          <div className={cn(
            "absolute top-2 left-2 px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all duration-200",
            isExploring 
              ? "bg-white border-2 border-gray-300 border-dashed text-gray-600"
              : "bg-indigo-600 text-white"
          )}>
            {isExploring ? (
              <>
                <Search className="w-3 h-3" />
                <span className="font-medium text-xs tracking-wide">ACTIVITY</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium text-xs">Activity</span>
              </>
            )}
          </div>
        </div>
        
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
                {event.title}
              </CardTitle>
            </div>
            
            <div className={cn(
              "text-xs mb-2 transition-all duration-200",
              isExploring ? "text-gray-500" : "text-gray-600"
            )}>
              {event.activityType}
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

export default ActivityEventCard; 