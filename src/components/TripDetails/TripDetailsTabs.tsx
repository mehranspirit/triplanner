import React from 'react';
import { CalendarDays, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { TripDetailsTab } from '@/types/tripDetailsTabTypes';

interface TripDetailsTabsProps {
  activeTab: TripDetailsTab;
  onTabChange: (tab: TripDetailsTab) => void;
}

const TABS: Array<{
  id: TripDetailsTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'itinerary', label: 'Itinerary', icon: <LayoutList className="h-3.5 w-3.5" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-3.5 w-3.5" /> },
];

const TripDetailsTabs: React.FC<TripDetailsTabsProps> = ({
  activeTab,
  onTabChange,
}) => (
  <nav
    aria-label="Trip views"
    className={cn(tripSurfaces.float, 'px-2 py-2 lg:rounded-3xl')}
  >
    <div className={cn('flex w-full sm:w-auto', tripSurfaces.segmentTrack)}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm',
            activeTab === tab.id
              ? tripSurfaces.segmentActive
              : 'text-slate-600 hover:text-slate-900',
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  </nav>
);

export default TripDetailsTabs;
