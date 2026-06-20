import React from 'react';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import { MapPin, Plus, Sparkles } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { EventType } from '@/types/eventTypes';

export const eventIconForType = (type: EventType) => {
  if (type === 'flight') return <FaPlane className="mr-2 h-4 w-4 text-blue-500" />;
  if (type === 'arrival') return <FaPlane className="mr-2 h-4 w-4 rotate-45 text-green-500" />;
  if (type === 'departure') return <FaPlane className="mr-2 h-4 w-4 -rotate-45 text-red-500" />;
  if (type === 'train') return <FaTrain className="mr-2 h-4 w-4 text-green-500" />;
  if (type === 'bus') return <FaBus className="mr-2 h-4 w-4 text-purple-500" />;
  if (type === 'rental_car') return <FaCar className="mr-2 h-4 w-4 text-red-500" />;
  if (type === 'stay') return <FaHotel className="mr-2 h-4 w-4 text-yellow-500" />;
  if (type === 'destination') return <FaMapMarkerAlt className="mr-2 h-4 w-4 text-pink-500" />;
  if (type === 'activity') return <FaMountain className="mr-2 h-4 w-4 text-indigo-500" />;
  return <Plus className="mr-2 h-4 w-4" />;
};

export interface TripAddEventMenuItemsProps {
  addableEventTypes: EventType[];
  onOpenAIImport: () => void;
  onOpenExploreSuggestions: () => void;
  onOpenPlaceSearch?: () => void;
  onAddEvent: (eventType: EventType) => void;
  manualEntrySubContentClassName?: string;
  onSelect?: () => void;
}

const TripAddEventMenuItems: React.FC<TripAddEventMenuItemsProps> = ({
  addableEventTypes,
  onOpenAIImport,
  onOpenExploreSuggestions,
  onOpenPlaceSearch,
  onAddEvent,
  manualEntrySubContentClassName,
  onSelect,
}) => {
  const wrap = (action: () => void) => () => {
    action();
    onSelect?.();
  };

  return (
    <>
      <DropdownMenuLabel>Add to itinerary</DropdownMenuLabel>
      <DropdownMenuItem onClick={wrap(onOpenAIImport)} className="font-medium">
        <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
        Import booking with AI
      </DropdownMenuItem>
      <DropdownMenuItem onClick={wrap(onOpenExploreSuggestions)} className="font-medium">
        <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
        Suggest activities with AI
      </DropdownMenuItem>
      {onOpenPlaceSearch && (
        <DropdownMenuItem onClick={wrap(onOpenPlaceSearch)} className="font-medium">
          <MapPin className="mr-2 h-4 w-4 text-teal-600" />
          Search a place
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Plus className="mr-2 h-4 w-4" />
          Manual entry
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={manualEntrySubContentClassName}>
          {addableEventTypes.map((type) => {
            const eventType = EVENT_TYPES[type];
            if (!eventType) return null;
            return (
              <DropdownMenuItem key={type} onClick={wrap(() => onAddEvent(type))}>
                {eventIconForType(type)}
                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export default TripAddEventMenuItems;
