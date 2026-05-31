import React, { useState } from 'react';
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
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
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
import { TripPanel } from './hooks/useTripPanelManager';

interface MobileTripActionsFabProps {
  tripId: string;
  canEdit: boolean;
  addableEventTypes: EventType[];
  activePanel: TripPanel | null;
  unreadNotificationCount: number;
  isImprovingLocations: boolean;
  improveLocationsLabel?: string;
  highlightToday?: boolean;
  isMapView?: boolean;
  onOpenAIImport: () => void;
  onAddEvent: (eventType: EventType) => void;
  onOpenExploreSuggestions: () => void;
  onImproveLocations: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
  onViewChange: (view: TripDetailsView) => void;
  onClosePanel: () => void;
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

const actionShellClass = 'flex items-center gap-2 rounded-full shadow-lg transition-transform';
const fabMenuContentClass = 'z-[200] max-h-[min(70vh,520px)] overflow-y-auto';

const fabPositionClass = (isMapView: boolean) => cn(
  'fixed right-4 z-[150] pb-[env(safe-area-inset-bottom)] lg:hidden',
  isMapView
    ? 'bottom-[calc(5.75rem+1rem)]'
    : 'bottom-6',
);

const MobileTripActionsFab: React.FC<MobileTripActionsFabProps> = ({
  tripId,
  canEdit,
  addableEventTypes,
  activePanel,
  unreadNotificationCount,
  isImprovingLocations,
  improveLocationsLabel,
  highlightToday = false,
  isMapView = false,
  onOpenAIImport,
  onAddEvent,
  onOpenExploreSuggestions,
  onImproveLocations,
  onOpenPanel,
  onOpenNotifications,
  onViewChange,
  onClosePanel,
}) => {
  const navigate = useNavigate();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const closeSpeedDial = () => {
    setSpeedDialOpen(false);
    setFabMenuOpen(false);
  };

  const handleOpenPanel = (panel: TripPanel) => {
    closeSpeedDial();
    onOpenPanel(panel);
  };

  const handleOpenNotifications = () => {
    closeSpeedDial();
    onOpenNotifications();
  };

  const handleAddAction = (action: () => void) => {
    closeSpeedDial();
    action();
  };

  if (activePanel) {
    return (
      <div className={fabPositionClass(isMapView)}>
        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-950/30 hover:bg-slate-800"
          onClick={onClosePanel}
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Close trip panel</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      {speedDialOpen && !fabMenuOpen && (
        <button
          type="button"
          aria-label="Close trip actions"
          className="fixed inset-0 z-[140] bg-slate-950/25 lg:hidden"
          onClick={closeSpeedDial}
        />
      )}

      <div
        className={cn(
          fabPositionClass(isMapView),
          'flex flex-col items-end gap-2.5',
          speedDialOpen && 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-end gap-2.5 transition-all duration-200',
            speedDialOpen
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-3 opacity-0',
          )}
        >
          {canEdit && (
            <DropdownMenu
              modal={false}
              onOpenChange={(open) => {
                setFabMenuOpen(open);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    actionShellClass,
                    'h-12 bg-blue-600 pl-4 pr-3 text-sm font-semibold text-white hover:bg-blue-700',
                  )}
                >
                  <span>Add event</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Plus className="h-5 w-5" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                sideOffset={12}
                avoidCollisions={false}
                className={cn('w-64', fabMenuContentClass)}
              >
                <DropdownMenuLabel>Add to itinerary</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleAddAction(onOpenAIImport)} className="font-medium">
                  <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                  Import booking with AI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddAction(onOpenExploreSuggestions)} className="font-medium">
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  Suggest activities with AI
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Plus className="mr-2 h-4 w-4" />
                    Manual entry
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="z-[200]">
                    {addableEventTypes.map((type) => {
                      const eventType = EVENT_TYPES[type];
                      if (!eventType) return null;
                      return (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleAddAction(() => onAddEvent(type))}
                        >
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

          <button
            type="button"
            className={cn(
              actionShellClass,
              'h-12 pl-4 pr-3 text-sm font-semibold text-white',
              highlightToday
                ? 'bg-violet-600 hover:bg-violet-700 ring-2 ring-violet-200 ring-offset-2'
                : 'bg-teal-600 hover:bg-teal-700',
            )}
            onClick={() => handleOpenPanel('today')}
          >
            <span>Today</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <CalendarDays className="h-5 w-5" />
            </span>
          </button>

          <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
              setFabMenuOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  actionShellClass,
                  'h-10 border border-slate-200 bg-white/95 pl-3 pr-2 text-xs font-medium text-slate-600 shadow-md hover:bg-slate-50',
                )}
              >
                <span>More</span>
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <MoreHorizontal className="h-4 w-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={12}
              avoidCollisions={false}
              className={cn('w-72', fabMenuContentClass)}
            >
              <DropdownMenuLabel>Travel day</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleOpenPanel('today')}>
                <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenNotifications}>
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
              <DropdownMenuItem onClick={() => handleOpenPanel('planning')}>
                <ClipboardList className="mr-2 h-4 w-4 text-blue-500" />
                Planning
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenPanel('checklist')}>
                <CheckSquare className="mr-2 h-4 w-4 text-green-500" />
                Checklist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenPanel('notes')}>
                <FileText className="mr-2 h-4 w-4 text-purple-500" />
                Notes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddAction(onOpenAIImport)}>
                <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                Import inbox
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Explore</DropdownMenuLabel>
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => handleAddAction(onOpenExploreSuggestions)}>
                    <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                    AI suggestions
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddAction(onImproveLocations)}
                    disabled={isImprovingLocations}
                  >
                    <MapPin className="mr-2 h-4 w-4 text-teal-500" />
                    {isImprovingLocations
                      ? (improveLocationsLabel || 'Reviewing...')
                      : 'Review locations'}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleAddAction(() => (
                  isMapView ? onViewChange('itinerary') : onViewChange('map')
                ))}
              >
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
              <DropdownMenuItem onClick={() => handleAddAction(() => navigate(`/trips/${tripId}/expenses`))}>
                <CreditCard className="mr-2 h-4 w-4 text-emerald-600" />
                Expenses and settlements
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          size="icon"
          className={cn(
            'pointer-events-auto h-14 w-14 rounded-full shadow-2xl transition-colors',
            speedDialOpen
              ? 'bg-slate-950 text-white shadow-slate-950/30 hover:bg-slate-800'
              : 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700',
          )}
          onClick={() => setSpeedDialOpen((open) => !open)}
        >
          {speedDialOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          <span className="sr-only">{speedDialOpen ? 'Close trip actions' : 'Open trip actions'}</span>
        </Button>
      </div>
    </>
  );
};

export default MobileTripActionsFab;
