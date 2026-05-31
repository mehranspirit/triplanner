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
import PlanningPanel from './PlanningPanel';
import { TripPanel, TripPanelOptions } from '../hooks/useTripPanelManager';
import { ResolutionAction, TripHealthSummary, TripHealthIssue } from '@/types/tripHealthTypes';

export interface TripPanelContentProps {
  activePanel: TripPanel;
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

const TripPanelContent: React.FC<TripPanelContentProps> = ({
  activePanel,
  panelOptions = {},
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
  tripHealthSummary,
  tripHealthIssues,
  isComputingTripHealth = false,
  onExecuteHealthResolution,
  onOpenDecision,
  onCreateDecision,
}) => {
  if (activePanel === 'notifications') {
    return (
      <TripNotifications
        notifications={notifications}
        preferences={notificationPreferences}
        loading={isLoadingNotifications}
        error={notificationError}
        onClose={onClose}
        showCloseButton={false}
        onRefresh={onRefreshNotifications}
        onMarkRead={onMarkNotificationRead}
        onDismiss={onDismissNotification}
        onAction={onNotificationAction}
        onUpdatePreferences={onUpdateNotificationPreferences}
      />
    );
  }

  if (activePanel === 'today') {
    return (
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
        showCloseButton={false}
        onOpenChecklist={() => onOpenPanel('checklist')}
        onEditEvent={(event) => {
          onClose();
          onEditEvent(event);
        }}
        onDismissInsight={onDismissInsight}
      />
    );
  }

  if (activePanel === 'checklist') {
    return (
      <TripChecklist
        tripId={trip._id}
        trip={trip}
        canEdit={canEdit}
        onClose={onClose}
        showCloseButton={false}
      />
    );
  }

  if (activePanel === 'notes') {
    return (
      <TripNotes
        tripId={trip._id}
        canEdit={canEdit}
        onClose={onClose}
        showCloseButton={false}
      />
    );
  }

  if (activePanel === 'map') {
    return (
      <div className="h-full overflow-hidden">
        <TripMap trip={trip} />
      </div>
    );
  }

  if (activePanel === 'planning') {
    return (
      <PlanningPanel
        trip={trip}
        summary={tripHealthSummary}
        issues={tripHealthIssues}
        isLoading={isComputingTripHealth}
        canEdit={canEdit}
        highlightIssueId={panelOptions.issueId}
        onExecuteResolution={onExecuteHealthResolution}
        onOpenDecision={onOpenDecision}
        onCreateDecision={onCreateDecision}
      />
    );
  }

  return null;
};

export default TripPanelContent;
