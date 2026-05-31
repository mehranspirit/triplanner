import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutList,
  MapIcon,
  MapPin,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { EventType } from '@/types/eventTypes';
import { TripDetailsView } from '@/types/tripDetailsViewTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { TripPanel } from './hooks/useTripPanelManager';

const eventIconForType = (type: EventType) => {
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

export interface TripToolbarActionMenusProps {
  tripId: string;
  canEdit: boolean;
  addableEventTypes: EventType[];
  activePanel: TripPanel | null;
  unreadNotificationCount: number;
  isImprovingLocations: boolean;
  improveLocationsLabel?: string;
  isMapView?: boolean;
  onOpenAIImport: () => void;
  onAddEvent: (eventType: EventType) => void;
  onOpenExploreSuggestions: () => void;
  onImproveLocations: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
  onViewChange: (view: TripDetailsView) => void;
  className?: string;
}

const TripToolbarActionMenus: React.FC<TripToolbarActionMenusProps> = ({
  tripId,
  canEdit,
  addableEventTypes,
  activePanel,
  unreadNotificationCount,
  isImprovingLocations,
  improveLocationsLabel,
  isMapView = false,
  onOpenAIImport,
  onAddEvent,
  onOpenExploreSuggestions,
  onImproveLocations,
  onOpenPanel,
  onOpenNotifications,
  onViewChange,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn('h-9 rounded-full bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 sm:h-10 sm:px-5', tripSurfaces.primaryCta)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Add to itinerary</DropdownMenuLabel>
            <DropdownMenuItem onClick={onOpenAIImport} className="font-medium">
              <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
              Import booking with AI
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenExploreSuggestions} className="font-medium">
              <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
              Suggest activities with AI
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plus className="mr-2 h-4 w-4" />
                Manual entry
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {addableEventTypes.map((type) => {
                  const eventType = EVENT_TYPES[type];
                  if (!eventType) return null;
                  return (
                    <DropdownMenuItem key={type} onClick={() => onAddEvent(type)}>
                      {eventIconForType(type)}
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-9 rounded-full border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 sm:h-10 sm:px-4',
              activePanel && 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50',
            )}
          >
            <Wand2 className="mr-2 h-4 w-4 shrink-0 text-teal-500" />
            <span className="truncate">Menu</span>
            {unreadNotificationCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                {unreadNotificationCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Travel day</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onOpenPanel('today')}>
            <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenNotifications}>
            <Bell className="mr-2 h-4 w-4 text-amber-500" />
            Notifications
            {unreadNotificationCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                {unreadNotificationCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Plan</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onOpenPanel('planning')}>
            <ClipboardList className="mr-2 h-4 w-4 text-blue-500" />
            Planning
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPanel('checklist')}>
            <CheckSquare className="mr-2 h-4 w-4 text-green-500" />
            Checklist
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPanel('notes')}>
            <FileText className="mr-2 h-4 w-4 text-purple-500" />
            Notes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenAIImport}>
            <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
            Import inbox
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Explore</DropdownMenuLabel>
          {canEdit && (
            <>
              <DropdownMenuItem onClick={onOpenExploreSuggestions}>
                <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                AI suggestions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImproveLocations} disabled={isImprovingLocations}>
                <MapPin className="mr-2 h-4 w-4 text-teal-500" />
                {isImprovingLocations
                  ? (improveLocationsLabel || 'Reviewing...')
                  : 'Review locations'}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => onViewChange(isMapView ? 'itinerary' : 'map')}>
            {isMapView ? (
              <>
                <LayoutList className="mr-2 h-4 w-4 text-blue-500" />
                Standard view
              </>
            ) : (
              <>
                <MapIcon className="mr-2 h-4 w-4 text-blue-500" />
                Map view
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Money</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigate(`/trips/${tripId}/expenses`)}>
            <CreditCard className="mr-2 h-4 w-4 text-emerald-600" />
            Expenses and settlements
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Trip</DropdownMenuLabel>
          <DropdownMenuItem disabled>
            Collaborators, export, and trip settings are in the header menu
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default TripToolbarActionMenus;
