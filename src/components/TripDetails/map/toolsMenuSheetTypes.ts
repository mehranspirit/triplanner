import { EventType } from '@/types/eventTypes';
import { TripPanel } from '../hooks/useTripPanelManager';

export interface ToolsMenuSheetProps {
  open: boolean;
  tripId: string;
  canEdit: boolean;
  addableEventTypes: EventType[];
  unreadNotificationCount: number;
  isImprovingLocations: boolean;
  improveLocationsLabel?: string;
  onOpenChange: (open: boolean) => void;
  onOpenAIImport: () => void;
  onAddEvent: (eventType: EventType) => void;
  onOpenExploreSuggestions: () => void;
  onOpenPlaceSearch?: () => void;
  onImproveLocations: () => void;
  onOpenPanel: (panel: TripPanel) => void;
  onOpenNotifications: () => void;
}
