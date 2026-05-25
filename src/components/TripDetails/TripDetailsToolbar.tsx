import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import { Bell, CalendarDays, CheckSquare, CreditCard, FileText, MapIcon, MapPin, Plus, Sparkles, Users, Wand2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { EventType } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import { TripPanel } from './hooks/useTripPanelManager';

interface TripDetailsToolbarProps {
  tripId: string;
  canEdit: boolean;
  addableEventTypes: EventType[];
  activePanel: TripPanel | null;
  unreadNotificationCount: number;
  isCondensedView: boolean;
  isImprovingLocations: boolean;
  improveLocationsLabel?: string;
  onOpenAIImport: () => void;
  onAddEvent: (eventType: EventType) => void;
  onOpenExploreSuggestions: () => void;
  onImproveLocations: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
  onCondensedViewChange: (value: boolean) => void;
}

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

const TripDetailsToolbar: React.FC<TripDetailsToolbarProps> = ({
  tripId,
  canEdit,
  addableEventTypes,
  activePanel,
  unreadNotificationCount,
  isCondensedView,
  isImprovingLocations,
  improveLocationsLabel,
  onOpenAIImport,
  onAddEvent,
  onOpenExploreSuggestions,
  onImproveLocations,
  onOpenPanel,
  onOpenNotifications,
  onCondensedViewChange,
}) => {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-40 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lg shadow-slate-900/5 backdrop-blur lg:rounded-3xl lg:p-3 lg:shadow-xl">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        <div className="flex items-center gap-2">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 flex-1 rounded-full bg-blue-600 px-4 text-sm text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 sm:h-10 sm:flex-none sm:px-5 lg:shadow-lg">
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
                  'h-9 flex-1 rounded-full border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 sm:h-10 sm:flex-none sm:px-4',
                  activePanel && 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50'
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
                      ? (improveLocationsLabel || 'Improving...')
                      : 'Improve locations'}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => onOpenPanel('map')}>
                <MapIcon className="mr-2 h-4 w-4 text-blue-500" />
                Map
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Money</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate(`/trips/${tripId}/expenses`)}>
                <CreditCard className="mr-2 h-4 w-4 text-emerald-600" />
                Expenses and settlements
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="lg:hidden">View</DropdownMenuLabel>
              <DropdownMenuItem
                className="flex items-center justify-between lg:hidden"
                onSelect={(event) => event.preventDefault()}
              >
                <span>Condensed timeline</span>
                <Switch
                  checked={isCondensedView}
                  onCheckedChange={onCondensedViewChange}
                  aria-label="Condensed timeline"
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator className="lg:hidden" />
              <DropdownMenuLabel>Trip</DropdownMenuLabel>
              <DropdownMenuItem disabled>
                <Users className="mr-2 h-4 w-4 text-slate-500" />
                Collaborators, export, and trip settings are in the header menu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden items-center justify-between gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 lg:flex lg:justify-end">
          <Label htmlFor="condensed-view" className="cursor-pointer text-sm font-medium text-slate-700">
            Condensed
          </Label>
          <Switch
            id="condensed-view"
            checked={isCondensedView}
            onCheckedChange={onCondensedViewChange}
          />
        </div>
      </div>
    </div>
  );
};

export default TripDetailsToolbar;
