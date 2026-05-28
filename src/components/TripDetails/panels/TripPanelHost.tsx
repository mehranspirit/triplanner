import React from 'react';
import { Trip } from '@/types/eventTypes';
import { NotificationPreference, TripNotification } from '@/types/notificationTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { TripInsight } from '@/types/insightTypes';
import {
  TripReplanBriefingResponse,
  TripTodayBriefingResponse,
} from '@/types/assistantBriefingTypes';
import TripPanelContent from './TripPanelContent';
import TripSheet from './TripSheet';
import MapSheetPanelHeader from '../map/MapSheetPanelHeader';
import { TripPanel, TripPanelOptions } from '../hooks/useTripPanelManager';
import { panelCopy } from './tripPanelMeta';
import { cn } from '@/lib/utils';
import { ResolutionAction, TripHealthSummary, TripHealthIssue } from '@/types/tripHealthTypes';

interface TripPanelHostProps {
  activePanel: TripPanel | null;
  panelOptions?: TripPanelOptions;
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
  tripHealthSummary: TripHealthSummary;
  tripHealthIssues: TripHealthIssue[];
  isComputingTripHealth?: boolean;
  onExecuteHealthResolution: (action: ResolutionAction, payload?: Record<string, unknown>) => void;
  onOpenDecision: (decisionId: string) => void;
  onCreateDecision: () => void;
}

const TripPanelHost: React.FC<TripPanelHostProps> = (props) => {
  const {
    activePanel,
    panelOptions = {},
    trip,
    onClose,
    onOpenPanel,
    ...contentProps
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
        <MapSheetPanelHeader
          activePanel={activePanel}
          onOpenPanel={onOpenPanel}
          onClosePanel={onClose}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <TripPanelContent
            activePanel={activePanel}
            panelOptions={panelOptions}
            trip={trip}
            onClose={onClose}
            onOpenPanel={onOpenPanel}
            {...contentProps}
          />
        </div>
      </div>
    </TripSheet>
  );
};

export default TripPanelHost;
