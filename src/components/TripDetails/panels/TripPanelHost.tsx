import React from 'react';
import TripMap from '@/components/TripMap';
import TripNotes from '@/components/TripNotes';
import { Trip } from '@/types/eventTypes';
import { NotificationPreference, TripNotification } from '@/types/notificationTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  TripReplanBriefingResponse,
  TripTodayBriefingResponse,
} from '@/types/assistantBriefingTypes';
import TripChecklist from '../TripChecklist';
import InTripAssistant from '../InTripAssistant';
import TripNotifications from '../TripNotifications';
import TripSheet from './TripSheet';
import { TripPanel } from '../hooks/useTripPanelManager';
import { cn } from '@/lib/utils';

interface TripPanelHostProps {
  activePanel: TripPanel | null;
  trip: Trip;
  canEdit: boolean;
  insights: TripInsight[];
  notifications: TripNotification[];
  notificationPreferences: NotificationPreference | null;
  isLoadingNotifications: boolean;
  notificationError: string | null;
  weatherSnapshots: WeatherSnapshot[];
  flightStatusSnapshots: FlightStatusSnapshot[];
  todayBriefing: TripTodayBriefingResponse['briefing'] | undefined;
  todayBriefingGeneratedAt: string | undefined;
  todayBriefingError: string | null;
  isGeneratingTodayBriefing: boolean;
  replanBriefing: TripReplanBriefingResponse['briefing'] | undefined;
  replanBriefingGeneratedAt: string | undefined;
  replanBriefingError: string | null;
  isGeneratingReplanBriefing: boolean;
  onClose: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onRefreshNotifications: () => void;
  onMarkNotificationRead: (notification: TripNotification) => void;
  onDismissNotification: (notification: TripNotification) => void;
  onNotificationAction: (notification: TripNotification) => void;
  onUpdateNotificationPreferences: (preferences: Partial<NotificationPreference>) => Promise<void>;
  onGenerateTodayBriefing: () => void;
  onGenerateReplanBriefing: () => void;
  onEditEvent: (event: Trip['events'][number]) => void;
  onDismissInsight?: (insightId: string) => void;
}

const panelCopy: Record<TripPanel, { title: string; description: string; className?: string }> = {
  notifications: {
    title: 'Trip notifications',
    description: 'Reminder and attention items for this trip.',
  },
  today: {
    title: 'Today',
    description: 'Current day assistant, briefings, and replanning.',
  },
  checklist: {
    title: 'Trip checklist',
    description: 'Shared and personal preparation tasks.',
    className: 'md:w-[430px]',
  },
  notes: {
    title: 'Trip notes',
    description: 'Shared rich text notes for this trip.',
    className: 'md:w-[430px]',
  },
  map: {
    title: 'Trip map',
    description: 'Map view of trip events.',
    className: 'md:w-[560px]',
  },
};

const panelGroups: Array<{
  label: string;
  panels: Array<{ id: TripPanel; label: string }>;
}> = [
  {
    label: 'Travel Day',
    panels: [
      { id: 'today', label: 'Today' },
      { id: 'notifications', label: 'Alerts' },
    ],
  },
  {
    label: 'Plan',
    panels: [
      { id: 'checklist', label: 'Checklist' },
      { id: 'notes', label: 'Notes' },
    ],
  },
  {
    label: 'Explore',
    panels: [
      { id: 'map', label: 'Map' },
    ],
  },
];

const TripPanelHost: React.FC<TripPanelHostProps> = (props) => {
  const {
    activePanel,
    trip,
    canEdit,
    insights,
    notifications,
    notificationPreferences,
    isLoadingNotifications,
    notificationError,
    weatherSnapshots,
    flightStatusSnapshots,
    todayBriefing,
    todayBriefingGeneratedAt,
    todayBriefingError,
    isGeneratingTodayBriefing,
    replanBriefing,
    replanBriefingGeneratedAt,
    replanBriefingError,
    isGeneratingReplanBriefing,
    onClose,
    onOpenPanel,
    onRefreshNotifications,
    onMarkNotificationRead,
    onDismissNotification,
    onNotificationAction,
    onUpdateNotificationPreferences,
    onGenerateTodayBriefing,
    onGenerateReplanBriefing,
    onEditEvent,
    onDismissInsight,
  } = props;

  if (!activePanel) return null;

  const copy = panelCopy[activePanel];

  return (
    <TripSheet
      open={Boolean(activePanel)}
      title="Trip detail"
      description="Focused details opened from the trip menu or a relevant context card."
      className={cn('md:w-[520px]', copy.className)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/95 px-4 py-3">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Trip detail</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-950">{copy.title}</h2>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{copy.description}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {panelGroups.map((group) => (
            <div key={group.label} className="flex shrink-0 items-center gap-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="flex gap-1">
                {group.panels.map((panel) => (
                  <button
                    key={panel.id}
                    type="button"
                    className={cn(
                      'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      activePanel === panel.id
                        ? 'border-blue-200 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    )}
                    onClick={() => onOpenPanel(panel.id)}
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
      {activePanel === 'notifications' && (
        <TripNotifications
          notifications={notifications}
          preferences={notificationPreferences}
          loading={isLoadingNotifications}
          error={notificationError}
          onClose={onClose}
          onRefresh={onRefreshNotifications}
          onMarkRead={onMarkNotificationRead}
          onDismiss={onDismissNotification}
          onAction={onNotificationAction}
          onUpdatePreferences={onUpdateNotificationPreferences}
        />
      )}
      {activePanel === 'today' && (
        <InTripAssistant
          trip={trip}
          insights={insights}
          canEdit={canEdit}
          weatherSnapshots={weatherSnapshots}
          flightStatusSnapshots={flightStatusSnapshots}
          todayBriefing={todayBriefing}
          todayBriefingGeneratedAt={todayBriefingGeneratedAt}
          todayBriefingError={todayBriefingError}
          isGeneratingTodayBriefing={isGeneratingTodayBriefing}
          onGenerateTodayBriefing={onGenerateTodayBriefing}
          replanBriefing={replanBriefing}
          replanBriefingGeneratedAt={replanBriefingGeneratedAt}
          replanBriefingError={replanBriefingError}
          isGeneratingReplanBriefing={isGeneratingReplanBriefing}
          onGenerateReplanBriefing={onGenerateReplanBriefing}
          onClose={onClose}
          onOpenChecklist={() => onOpenPanel('checklist')}
          onEditEvent={(event) => {
            onClose();
            onEditEvent(event);
          }}
          onDismissInsight={onDismissInsight}
        />
      )}
      {activePanel === 'checklist' && (
        <TripChecklist
          tripId={trip._id}
          trip={trip}
          canEdit={canEdit}
          onClose={onClose}
        />
      )}
      {activePanel === 'notes' && (
        <TripNotes
          tripId={trip._id}
          canEdit={canEdit}
          onClose={onClose}
        />
      )}
      {activePanel === 'map' && (
        <div className="h-full overflow-hidden">
          <TripMap trip={trip} />
        </div>
      )}
      </div>
      </div>
    </TripSheet>
  );
};

export default TripPanelHost;
