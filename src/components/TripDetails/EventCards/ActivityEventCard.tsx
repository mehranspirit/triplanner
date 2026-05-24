import React, { useState } from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityEvent } from '@/types/eventTypes';
import { format, parse } from 'date-fns';
import { 
  Clock, 
  MapPin, 
  Info, 
  CheckCircle2, 
  Search,
  Map,
  ExternalLink,
  Ticket
} from 'lucide-react';
import { FaMountain } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { CollapsibleContent, ShowMoreButton } from './utils';
import GlowingIcon from '@/components/ui/GlowingIcon';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { formatCurrency } from '@/utils/format';
import EventCardActions from './EventCardActions';
import EventCardShell from './EventCardShell';

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
    <EventCardShell isExploring={isExploring}>
      <EventCardActions
        isExploring={isExploring}
        onAddToCalendar={handleAddToCalendar}
        onShare={handleShare}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
      >
        {event.address && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-colors duration-200 hover:bg-slate-50"
            onClick={handleOpenInMaps}
            title="Open in Maps"
          >
            <Map className="h-4 w-4 text-slate-500" />
          </Button>
        )}
      </EventCardActions>

      <div className="flex h-full">
        <div className="w-1/4 relative md:block hidden">
          <div className="absolute inset-0">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/2647922/pexels-photo-2647922.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.title}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "saturate-75 opacity-50 contrast-110"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-amber-100/80 to-transparent"
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
              ? "bg-amber-100 border border-amber-200 text-amber-800"
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

        {/* Mobile Thumbnail */}
        <div className="absolute top-2 right-2 w-16 h-16 md:hidden block">
          <div className="relative w-full h-full rounded-lg overflow-hidden">
            <img 
              src={thumbnail || 'https://images.pexels.com/photos/2647922/pexels-photo-2647922.jpeg?auto=compress&cs=tinysrgb&w=300'} 
              alt={event.title}
              className={cn(
                "w-full h-full object-cover transition-all duration-200",
                isExploring && "saturate-75 opacity-50 contrast-110"
              )}
            />
            <div className={cn(
              "absolute inset-0 transition-all duration-200",
              isExploring 
                ? "bg-gradient-to-br from-amber-100/80 to-transparent"
                : "bg-gradient-to-br from-indigo-500/10 to-indigo-900/30"
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
            : "bg-indigo-600 text-white shadow-sm"
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

            {/* Cost Section - moved above description/notes */}
            {typeof event.cost === 'number' && (
              <div className="flex items-center text-sm space-x-2 mt-2">
                <Ticket className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isExploring ? "text-gray-400" : "text-gray-500"
                )} />
                <span className={cn(
                  "transition-all duration-200",
                  isExploring ? "text-gray-600" : "text-gray-900"
                )}>
              <span className="font-semibold">Cost:</span> {formatCurrency(event.cost, 'USD')}
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
    </EventCardShell>
  );
};

export default ActivityEventCard; 