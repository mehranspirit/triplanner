import React from 'react';
import { Bell, CalendarDays, CheckSquare, FileText, MapIcon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TripPanel } from './hooks/useTripPanelManager';

interface MobileTripActionsFabProps {
  activePanel: TripPanel | null;
  unreadNotificationCount: number;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
  onClosePanel: () => void;
}

const MobileTripActionsFab: React.FC<MobileTripActionsFabProps> = ({
  activePanel,
  unreadNotificationCount,
  onOpenPanel,
  onOpenNotifications,
  onClosePanel,
}) => (
  <div className="fixed bottom-6 right-6 z-[150] lg:hidden">
    {activePanel ? (
      <Button
        size="icon"
        className="h-14 w-14 rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-950/30 hover:bg-slate-800"
        onClick={onClosePanel}
      >
        <X className="h-6 w-6" />
        <span className="sr-only">Close trip panel</span>
      </Button>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="relative h-14 w-14 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/30 hover:bg-blue-700"
          >
            <Menu className="h-6 w-6" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                {unreadNotificationCount}
              </span>
            )}
            <span className="sr-only">Open trip tools</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="w-56 rounded-2xl">
          <DropdownMenuItem onClick={() => onOpenPanel('today')}>
            <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
            Travel Day
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
          <DropdownMenuItem onClick={() => onOpenPanel('checklist')}>
            <CheckSquare className="mr-2 h-4 w-4 text-green-500" />
            Plan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPanel('notes')}>
            <FileText className="mr-2 h-4 w-4 text-purple-500" />
            Notes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPanel('map')}>
            <MapIcon className="mr-2 h-4 w-4 text-blue-500" />
            Explore
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);

export default MobileTripActionsFab;
