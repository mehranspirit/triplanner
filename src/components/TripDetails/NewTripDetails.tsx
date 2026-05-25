import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripDetails } from './hooks';
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI Button
import { Event, EventType, ActivityEvent, DestinationEvent } from '@/types/eventTypes'; // Import EventType
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Sparkles, Clock } from 'lucide-react';
import TripDetailsToolbar from '@/components/TripDetails/TripDetailsToolbar';
import MobileTripActionsFab from '@/components/TripDetails/MobileTripActionsFab';
import TripDetailsHero from '@/components/TripDetails/TripDetailsHero';
import ProactiveTripContext from '@/components/TripDetails/ProactiveTripContext';
import TripPanelHost from '@/components/TripDetails/panels/TripPanelHost';
import { useTripPanelManager } from '@/components/TripDetails/hooks/useTripPanelManager';
import TripTimeline from '@/components/TripDetails/timeline/TripTimeline';
import TravelImportDialog, { ImportInboxFilter } from '@/components/TripDetails/imports/TravelImportDialog';
import { getTripContextSignals } from '@/components/TripDetails/context/getTripContextSignals';
import { ProactiveContextCard as ProactiveContextCardData, ProactiveContextCardType } from '@/components/TripDetails/context/tripContextTypes';
import { generateTripInsights, getMissingLocationInsightId } from '@/services/tripInsights';
import { eventNeedsMapLocation } from '@/utils/eventLocation';
import { buildParsedEventCandidates, ParsedEventCandidate } from '@/services/travelImportValidation';
import { api } from '@/services/api';
import { hashText } from '@/utils/hash';
import { NotificationPreference, TripNotification } from '@/types/notificationTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { ExpenseSummary } from '@/types/expenseTypes';
import { TravelImport, TravelImportStatus } from '@/types/travelImportTypes';
import {
  AssistantActionTarget,
  AssistantChecklistItem,
  AssistantSuggestionFeedback,
  TripAssistantBriefingResponse,
  TripQuestionAnswerResponse,
  TripReplanBriefingResponse,
  TripTodayBriefingResponse
} from '@/types/assistantBriefingTypes';
import { networkAwareApi } from '@/services/networkAwareApi';
import EventFormModalRouter from './EventFormModalRouter';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TripLoading from '@/components/ui/trip-loading';

// Function to process text and make links clickable
const processText = (text: string | undefined | null): string => {
  if (!text) return '';
  try {
    // First decode any URL-encoded content
    const decodedText = decodeURIComponent(text);
    // Then handle HTML entities and links
    return decodedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-200 hover:text-blue-100 underline">$1</a>')
      .replace(/\n/g, '<br>');
  } catch (e) {
    console.warn('Failed to process text:', text, e);
    return text || '';
  }
};

const getAssistantChecklistItemId = (item: AssistantChecklistItem) => (
  `${item.scope}:${item.text.trim().toLowerCase()}`
);

const getProviderLabel = (provider: string) => {
  if (provider === 'aviationstack') return 'Aviationstack';
  if (provider === 'aerodatabox') return 'AeroDataBox';
  if (provider === 'open-meteo') return 'Open-Meteo';
  return provider;
};

const getImportInboxStatus = (candidates: ParsedEventCandidate[]): TravelImportStatus => {
  if (candidates.length === 0) return 'unsupported';
  if (candidates.some(candidate => candidate.validation.duplicateEventIds.length > 0)) return 'duplicate';
  if (candidates.some(candidate => candidate.validation.errors.length > 0)) return 'missing_info';
  return 'needs_review';
};

const redactImportSourceText = (text: string) => (
  text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .replace(/\b[A-Z0-9]{8,}\b/g, '[code]')
    .replace(/\s+/g, ' ')
    .trim()
);

const buildImportSourceSummary = (text: string) => {
  const redacted = redactImportSourceText(text);
  const firstLine = redactImportSourceText(text.split(/\r?\n/).find(line => line.trim()) || '');
  return {
    sourceTitle: (firstLine || 'Pasted import').slice(0, 140),
    sourceExcerpt: redacted.slice(0, 500),
  };
};

const NewTripDetails: React.FC = () => {
  const navigate = useNavigate();
  const {
    trip,
    loading,
    error,
    tripThumbnail,
    eventThumbnails, // Get event thumbnails
    addEvent, // Function to add event
    updateEvent, // Function to update event
    deleteEvent, // Function to delete event
    handleExportHTML,
    canEdit,
    isOwner, 
    user,
    handleTripUpdate,
    fetchTrip
  } = useTripDetails();

  const [modalType, setModalType] = useState<EventType | null>(null); // State to track which modal to show
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isCondensedView, setIsCondensedView] = useState(false);
  const { activePanel, openPanel, closePanel } = useTripPanelManager();
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [weatherSnapshots, setWeatherSnapshots] = useState<WeatherSnapshot[]>([]);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [flightStatusSnapshots, setFlightStatusSnapshots] = useState<FlightStatusSnapshot[]>([]);
  const [flightStatusError, setFlightStatusError] = useState<string | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [assistantBriefing, setAssistantBriefing] = useState<TripAssistantBriefingResponse | null>(null);
  const [assistantBriefingError, setAssistantBriefingError] = useState<string | null>(null);
  const [isGeneratingAssistantBriefing, setIsGeneratingAssistantBriefing] = useState(false);
  const [todayBriefing, setTodayBriefing] = useState<TripTodayBriefingResponse | null>(null);
  const [todayBriefingError, setTodayBriefingError] = useState<string | null>(null);
  const [isGeneratingTodayBriefing, setIsGeneratingTodayBriefing] = useState(false);
  const [replanBriefing, setReplanBriefing] = useState<TripReplanBriefingResponse | null>(null);
  const [replanBriefingError, setReplanBriefingError] = useState<string | null>(null);
  const [isGeneratingReplanBriefing, setIsGeneratingReplanBriefing] = useState(false);
  const [tripQuestionAnswer, setTripQuestionAnswer] = useState<TripQuestionAnswerResponse | null>(null);
  const [tripQuestionError, setTripQuestionError] = useState<string | null>(null);
  const [isAskingTripQuestion, setIsAskingTripQuestion] = useState(false);
  const [assistantSuggestionFeedback, setAssistantSuggestionFeedback] = useState<AssistantSuggestionFeedback[]>([]);
  const [isAIParseModalOpen, setIsAIParseModalOpen] = useState(false);
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCandidates, setParsedCandidates] = useState<ParsedEventCandidate[]>([]);
  const [isAddingParsedEvents, setIsAddingParsedEvents] = useState(false);
  const [activeTravelImportId, setActiveTravelImportId] = useState<string | null>(null);
  const [travelImports, setTravelImports] = useState<TravelImport[]>([]);
  const [importInboxFilter, setImportInboxFilter] = useState<ImportInboxFilter>('open');
  const [showAllTravelImports, setShowAllTravelImports] = useState(false);
  const [isLoadingTravelImports, setIsLoadingTravelImports] = useState(false);
  const [travelImportError, setTravelImportError] = useState<string | null>(null);
  const parseWarning = parsedCandidates.length === 1 && /Flight\s+1\s+of\s+\d+/i.test(parseText)
    ? 'This looks like a multi-flight receipt, but only one event was extracted. Review the text or try parsing again before saving.'
    : null;
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<Event[]>([]);
  const [deletingEvents, setDeletingEvents] = useState<Set<string>>(new Set());
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);
  const [isImprovingLocations, setIsImprovingLocations] = useState(false);
  const [addingProgress, setAddingProgress] = useState(0);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);
  const [dismissedContextCardTypes, setDismissedContextCardTypes] = useState<ProactiveContextCardType[]>([]);
  const tripInsights = useMemo(
    () => trip ? generateTripInsights({ trip, events: trip.events, weatherSnapshots, flightStatusSnapshots }) : [],
    [trip, weatherSnapshots, flightStatusSnapshots]
  );
  const visibleTripInsights = useMemo(
    () => tripInsights.filter(insight => !dismissedInsightIds.includes(insight.id)),
    [tripInsights, dismissedInsightIds]
  );

  useEffect(() => {
    setDismissedInsightIds((current) => (
      current.filter((insightId) => tripInsights.some((insight) => insight.id === insightId))
    ));
  }, [tripInsights]);
  const contextSignals = useMemo(
    () => trip ? getTripContextSignals({
      trip,
      notifications,
      travelImports,
      insights: visibleTripInsights,
      weatherSnapshots,
      flightStatusSnapshots,
      dismissedInsightIds,
      dismissedContextCardTypes,
    }) : null,
    [trip, notifications, travelImports, visibleTripInsights, weatherSnapshots, flightStatusSnapshots, dismissedInsightIds, dismissedContextCardTypes]
  );
  const unreadNotificationCount = notifications.filter(notification => !notification.readAt).length;
  const handledAssistantChecklistItemIds = assistantSuggestionFeedback
    .filter(feedback => feedback.suggestionType === 'assistant_checklist_item')
    .map(feedback => feedback.suggestionId);

  const fetchNotifications = async (generate = true) => {
    if (!trip?._id) return;

    try {
      setIsLoadingNotifications(true);
      setNotificationError(null);
      const [data, preferences] = await Promise.all([
        api.getTripNotifications(trip._id, { generate }),
        api.getNotificationPreferences(trip._id),
      ]);
      setNotifications(data);
      setNotificationPreferences(preferences);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotificationError(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const fetchTravelImports = async () => {
    if (!trip?._id) return;

    try {
      setIsLoadingTravelImports(true);
      setTravelImportError(null);
      const imports = await api.getTravelImports(trip._id);
      setTravelImports(imports);
    } catch (error) {
      console.error('Error loading travel imports:', error);
      setTravelImportError(error instanceof Error ? error.message : 'Failed to load import inbox');
    } finally {
      setIsLoadingTravelImports(false);
    }
  };

  const handleGenerateAssistantBriefing = async () => {
    if (!trip?._id) return;

    try {
      setIsGeneratingAssistantBriefing(true);
      setAssistantBriefingError(null);
      const data = await api.generateTripAssistantBriefing(trip._id);
      setAssistantBriefing(data);
    } catch (error) {
      console.error('Error generating assistant briefing:', error);
      setAssistantBriefingError(error instanceof Error ? error.message : 'Failed to generate assistant briefing');
    } finally {
      setIsGeneratingAssistantBriefing(false);
    }
  };

  const handleGenerateTodayBriefing = async () => {
    if (!trip?._id) return;

    try {
      setIsGeneratingTodayBriefing(true);
      setTodayBriefingError(null);
      const data = await api.generateTripTodayBriefing(trip._id);
      setTodayBriefing(data);
    } catch (error) {
      console.error('Error generating Today briefing:', error);
      setTodayBriefingError(error instanceof Error ? error.message : 'Failed to generate Today briefing');
    } finally {
      setIsGeneratingTodayBriefing(false);
    }
  };

  const handleGenerateReplanBriefing = async () => {
    if (!trip?._id) return;

    try {
      setIsGeneratingReplanBriefing(true);
      setReplanBriefingError(null);
      const data = await api.generateTripReplanBriefing(trip._id);
      setReplanBriefing(data);
    } catch (error) {
      console.error('Error generating day replan briefing:', error);
      setReplanBriefingError(error instanceof Error ? error.message : 'Failed to generate day replan briefing');
    } finally {
      setIsGeneratingReplanBriefing(false);
    }
  };

  const handleAskTripQuestion = async (question: string) => {
    if (!trip?._id) return;

    try {
      setIsAskingTripQuestion(true);
      setTripQuestionError(null);
      const data = await api.askTripQuestion(trip._id, question);
      setTripQuestionAnswer(data);
    } catch (error) {
      console.error('Error asking trip question:', error);
      setTripQuestionError(error instanceof Error ? error.message : 'Failed to answer trip question');
    } finally {
      setIsAskingTripQuestion(false);
    }
  };

  const saveAssistantChecklistFeedback = async (
    item: AssistantChecklistItem,
    status: 'accepted' | 'dismissed'
  ) => {
    if (!trip?._id) return;
    const id = getAssistantChecklistItemId(item);
    const optimisticFeedback: AssistantSuggestionFeedback = {
      _id: `temp-${id}`,
      userId: user?._id || '',
      tripId: trip._id,
      suggestionId: id,
      suggestionType: 'assistant_checklist_item',
      status,
      scope: item.scope,
      title: item.text,
      reason: item.reason,
      payload: item,
      acceptedAt: status === 'accepted' ? new Date().toISOString() : undefined,
      dismissedAt: status === 'dismissed' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAssistantSuggestionFeedback(prev => [
      optimisticFeedback,
      ...prev.filter(feedback => feedback.suggestionId !== id)
    ]);

    const savedFeedback = await api.saveAssistantSuggestionFeedback(trip._id, {
      suggestionId: id,
      suggestionType: 'assistant_checklist_item',
      status,
      scope: item.scope,
      title: item.text,
      reason: item.reason,
      payload: item,
    });

    setAssistantSuggestionFeedback(prev => [
      savedFeedback,
      ...prev.filter(feedback => feedback.suggestionId !== id)
    ]);
  };

  const handleAssistantAction = (target: AssistantActionTarget, eventId?: string) => {
    if (!trip) return;

    switch (target) {
      case 'event': {
        const event = trip.events.find(tripEvent => tripEvent.id === eventId);
        if (event) {
          handleEditEventClick(event);
        }
        break;
      }
      case 'checklist':
        openPanel('checklist');
        break;
      case 'expenses':
        navigate(`/trips/${trip._id}/expenses`);
        break;
      case 'today':
        openPanel('today');
        break;
      case 'ai_import':
        setIsAIParseModalOpen(true);
        closePanel();
        break;
      case 'add_event':
        handleAddEventClick('activity');
        break;
      default:
        break;
    }
  };

  const handleAcceptAssistantChecklistItem = async (item: AssistantChecklistItem) => {
    if (!trip?._id || !canEdit) return;

    try {
      const checklistType = item.scope === 'personal' ? 'personal' : 'shared';
      const bins = await networkAwareApi.getChecklist(trip._id, checklistType);
      const normalizedText = item.text.trim().toLowerCase();
      const alreadyExists = bins.some((bin) => (
        bin.items.some((existingItem) => existingItem.text.trim().toLowerCase() === normalizedText)
      ));

      if (!alreadyExists) {
        const targetBin = bins[0] || { id: crypto.randomUUID(), title: 'To Do', items: [] };
        const nextBins = bins.length > 0
          ? bins.map((bin) => (
              bin.id === targetBin.id
                ? { ...bin, items: [...bin.items, { id: crypto.randomUUID(), text: item.text.trim(), completed: false }] }
                : bin
            ))
          : [{ ...targetBin, items: [{ id: crypto.randomUUID(), text: item.text.trim(), completed: false }] }];
        await networkAwareApi.updateChecklist(trip._id, checklistType, nextBins);
      }

      await saveAssistantChecklistFeedback(item, 'accepted');
      openPanel('checklist');
      setSuccess(`Added "${item.text}" to the ${checklistType} checklist.`);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error accepting assistant checklist item:', error);
      setAssistantBriefingError(error instanceof Error ? error.message : 'Failed to add checklist item');
    }
  };

  const handleDismissAssistantChecklistItem = async (item: AssistantChecklistItem) => {
    try {
      await saveAssistantChecklistFeedback(item, 'dismissed');
    } catch (error) {
      console.error('Error dismissing assistant checklist item:', error);
      setAssistantBriefingError(error instanceof Error ? error.message : 'Failed to dismiss checklist suggestion');
    }
  };

  useEffect(() => {
    if (!trip?._id) return;

    try {
      const stored = localStorage.getItem(`dismissedTripInsights:${trip._id}`);
      setDismissedInsightIds(stored ? JSON.parse(stored) : []);
      const storedCards = localStorage.getItem(`dismissedTripContextCards:${trip._id}`);
      setDismissedContextCardTypes(storedCards ? JSON.parse(storedCards) : []);
    } catch (error) {
      console.warn('Failed to load dismissed trip insights:', error);
      setDismissedInsightIds([]);
      setDismissedContextCardTypes([]);
    }
  }, [trip?._id]);

  useEffect(() => {
    setAssistantBriefing(null);
    setAssistantBriefingError(null);
    setTodayBriefing(null);
    setTodayBriefingError(null);
    setReplanBriefing(null);
    setReplanBriefingError(null);
    setTripQuestionAnswer(null);
    setTripQuestionError(null);
    if (!trip?._id) {
      setAssistantSuggestionFeedback([]);
      return;
    }

    const fetchAssistantFeedback = async () => {
      try {
        const feedback = await api.getAssistantSuggestionFeedback(trip._id);
        setAssistantSuggestionFeedback(feedback);
      } catch (error) {
        console.error('Error loading assistant feedback:', error);
        setAssistantSuggestionFeedback([]);
      }
    };

    fetchAssistantFeedback();
  }, [trip?._id]);

  useEffect(() => {
    if (!trip?._id) return;
    fetchNotifications();
  }, [trip?._id, trip?.updatedAt]);

  useEffect(() => {
    if (!trip?._id || !isAIParseModalOpen) return;
    fetchTravelImports();
  }, [trip?._id, isAIParseModalOpen]);

  useEffect(() => {
    if (!trip?._id) {
      setExpenseSummary(null);
      return;
    }

    let isMounted = true;
    const fetchExpenseSummary = async () => {
      try {
        const summary = await networkAwareApi.getExpenseSummary(trip._id);
        if (isMounted) {
          setExpenseSummary(summary || null);
        }
      } catch (error) {
        console.warn('Failed to load trip expense summary:', error);
        if (isMounted) {
          setExpenseSummary(null);
        }
      }
    };

    fetchExpenseSummary();

    return () => {
      isMounted = false;
    };
  }, [trip?._id, trip?.updatedAt]);

  useEffect(() => {
    if (!trip?._id) return;

    const fetchWeather = async () => {
      try {
        setWeatherError(null);
        const data = await api.getTripWeather(trip._id);
        setWeatherSnapshots(data.snapshots || []);
        const status = data.diagnostics?.status;
        if (status && !['available', 'partial'].includes(status)) {
          setWeatherError(`${getProviderLabel(data.provider)}: ${data.diagnostics?.message || 'Weather context is unavailable.'}`);
        }
      } catch (error) {
        console.error('Error loading weather:', error);
        setWeatherError(error instanceof Error ? error.message : 'Failed to load trip weather');
        setWeatherSnapshots([]);
      }
    };

    fetchWeather();
  }, [trip?._id, trip?.updatedAt]);

  useEffect(() => {
    if (!trip?._id) return;

    const fetchFlightStatuses = async () => {
      try {
        setFlightStatusError(null);
        const data = await api.getTripFlightStatuses(trip._id);
        setFlightStatusSnapshots(data.snapshots || []);
        const status = data.diagnostics?.status;
        if (status && !['available', 'partial', 'no_targets'].includes(status)) {
          setFlightStatusError(`${getProviderLabel(data.provider)}: ${data.diagnostics?.message || 'Flight status context is unavailable.'}`);
        } else if (!data.configured) {
          setFlightStatusError(`${getProviderLabel(data.provider)} API key is not configured.`);
        }
      } catch (error) {
        console.error('Error loading flight statuses:', error);
        setFlightStatusError(error instanceof Error ? error.message : 'Failed to load flight statuses');
        setFlightStatusSnapshots([]);
      }
    };

    fetchFlightStatuses();
  }, [trip?._id, trip?.updatedAt]);

  const handleDismissInsight = (insightId: string) => {
    if (!trip?._id) return;

    setDismissedInsightIds(prev => {
      const next = Array.from(new Set([...prev, insightId]));
      localStorage.setItem(`dismissedTripInsights:${trip._id}`, JSON.stringify(next));
      return next;
    });
  };

  const handleDismissContextCard = (card: ProactiveContextCardData) => {
    if (!trip?._id) return;

    if (card.type === 'location_issues') {
      const locationInsightIds = trip.events
        .filter(event => eventNeedsMapLocation(event))
        .map(event => getMissingLocationInsightId(event.id));

      if (locationInsightIds.length === 0) return;

      setDismissedInsightIds(prev => {
        const next = Array.from(new Set([...prev, ...locationInsightIds]));
        localStorage.setItem(`dismissedTripInsights:${trip._id}`, JSON.stringify(next));
        return next;
      });
      return;
    }

    setDismissedContextCardTypes(prev => {
      const next = Array.from(new Set([...prev, card.type]));
      localStorage.setItem(`dismissedTripContextCards:${trip._id}`, JSON.stringify(next));
      return next;
    });
  };

  const handleRestoreDismissedInsights = () => {
    if (!trip?._id) return;

    localStorage.removeItem(`dismissedTripInsights:${trip._id}`);
    setDismissedInsightIds([]);
  };

  const handleUpdateNotification = async (
    notification: TripNotification,
    data: { read?: boolean; dismissed?: boolean }
  ) => {
    if (!trip?._id) return;

    try {
      const updated = await api.updateTripNotification(trip._id, notification._id, data);
      if (data.dismissed) {
        setNotifications(prev => prev.filter(item => item._id !== notification._id));
      } else {
        setNotifications(prev => prev.map(item => item._id === notification._id ? updated : item));
      }
    } catch (error) {
      console.error('Error updating notification:', error);
      setNotificationError(error instanceof Error ? error.message : 'Failed to update notification');
    }
  };

  const handleNotificationAction = (notification: TripNotification) => {
    if (!trip) return;

    if (!notification.readAt) {
      handleUpdateNotification(notification, { read: true });
    }

    switch (notification.actionTarget) {
      case 'event': {
        const event = trip.events.find(tripEvent => tripEvent.id === notification.eventId);
        if (event) {
          closePanel();
          handleEditEventClick(event);
        }
        break;
      }
      case 'checklist':
        openPanel('checklist');
        break;
      case 'expenses':
        navigate(`/trips/${trip._id}/expenses`);
        break;
      case 'today':
        openPanel('today');
        break;
      case 'ai_import':
        closePanel();
        setIsAIParseModalOpen(true);
        break;
      case 'add_event':
        closePanel();
        handleAddEventClick(notification.title.toLowerCase().includes('stay') ? 'stay' : 'rental_car');
        break;
      default:
        closePanel();
        break;
    }
  };

  const handleImproveLocations = async () => {
    if (!trip?._id) return;

    try {
      setIsImprovingLocations(true);
      const result = await api.geocodeTripEvents(trip._id);
      await handleTripUpdate(result.trip);
      setSuccess(
        result.updatedCount > 0
          ? `Improved ${result.updatedCount} event location${result.updatedCount === 1 ? '' : 's'}.`
          : 'No event locations needed updates.'
      );
    } catch (error) {
      console.error('Error improving locations:', error);
      setSuccess(error instanceof Error ? error.message : 'Failed to improve event locations');
    } finally {
      setIsImprovingLocations(false);
    }
  };

  const handleUpdateNotificationPreferences = async (
    updates: Partial<Pick<NotificationPreference, 'inAppEnabled' | 'disabledTypes'>>
  ) => {
    if (!trip?._id || !notificationPreferences) return;

    try {
      const nextPreferences = {
        ...notificationPreferences,
        ...updates,
      };
      setNotificationPreferences(nextPreferences);
      const savedPreferences = await api.updateNotificationPreferences(trip._id, updates);
      setNotificationPreferences(savedPreferences);
      await fetchNotifications();
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setNotificationError(error instanceof Error ? error.message : 'Failed to update notification preferences');
    }
  };

  const handleAddEventClick = (type: EventType) => {
    setEditingEvent(null);
    setModalType(type);
  };

  const handleEditEventClick = (event: Event) => {
    setEditingEvent(event);
    setModalType(event.type); // Open the modal corresponding to the event type
    // setIsModalOpen(true); // No longer needed
  };

  const handleCloseModal = () => {
    setModalType(null); // Close by clearing the type
    setEditingEvent(null);
  };

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => {
    try {
    if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        // We are editing an existing event
        const eventToUpdate = { ...editingEvent, ...eventData } as Event;
        const updatedEvent = await updateEvent(eventToUpdate);
        
        // Update the local state immediately
        if (trip && updatedEvent) {
          const updatedEvents = trip.events.map(event => 
            event.id === updatedEvent.id ? updatedEvent : event
          );
          trip.events = updatedEvents;
        }
    } else {
        // We are adding a new event
        const newEvent = await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);
        
        // Update the local state immediately
        if (trip && newEvent) {
          trip.events = [...trip.events, newEvent];
        }
      }
      
      // Close the modal
      handleCloseModal();
    } catch (error) {
      console.error('NewTripDetails: Error saving event:', error);
      alert('Failed to save event. Please try again.');
    }
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    if (!trip) return;
    
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        // Add event to deleting set
        setDeletingEvents(prev => new Set(prev).add(eventId));
        
        // Wait for animation to complete (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Delete the event from the backend
        await deleteEvent(eventId);
        
        // Update the local state after successful deletion
          const updatedEvents = trip.events.filter(event => event.id !== eventId);
        
        // Update the trip object with the new events array
        const updatedTrip = {
          ...trip,
          events: updatedEvents
        };
        
        // Update the trip state without refetching
        await handleTripUpdate(updatedTrip);
        
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
      } finally {
        // Remove event from deleting set
        setDeletingEvents(prev => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
      }
    } 
  };

  const handleStatusChange = async (event: Event, newStatus: 'confirmed' | 'exploring') => {
    try {
      const updatedEvent = { ...event, status: newStatus };
      await updateEvent(updatedEvent);
      
      // Update the local state immediately
      if (trip) {
        const updatedEvents = trip.events.map(e => 
          e.id === event.id ? { ...e, status: newStatus } : e
        );
        trip.events = updatedEvents;
      }
    } catch (error) {
      console.error('Error updating event status:', error);
      alert('Failed to update event status. Please try again.');
    }
  };

  const handleAIParse = async () => {
    if (!trip || !user) return;
    
    setIsParsing(true);
    setParseError(null);
    
    try {
      const parsedEvents = await api.parseEventFromText({
        text: parseText,
        trip: {
          _id: trip._id,
          name: trip.name,
          description: trip.description || '',
          startDate: trip.startDate,
          endDate: trip.endDate,
          events: trip.events
        },
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl || null
        }
      });
      
      // Handle both single event and array of events
      const eventsToReview = Array.isArray(parsedEvents) ? parsedEvents : [parsedEvents];
      const candidates = buildParsedEventCandidates(eventsToReview, trip.events);
      setParsedCandidates(candidates);

      try {
        const sourceHash = await hashText(parseText);
        const sourceSummary = buildImportSourceSummary(parseText);
        const travelImport = await api.createTravelImport(trip._id, {
          sourceType: 'manual_text',
          sourceHash,
          ...sourceSummary,
          status: getImportInboxStatus(candidates),
          model: 'gemini-2.5-flash',
          parsedEvents: eventsToReview,
          validationErrors: candidates.flatMap(candidate => candidate.validation.errors),
        });
        setActiveTravelImportId(travelImport._id);
        setTravelImports(prev => [travelImport, ...prev.filter(item => item._id !== travelImport._id)]);
      } catch (historyError) {
        console.warn('Failed to record travel import history:', historyError);
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse text';
      setParseError(message);

      try {
        const sourceHash = await hashText(parseText);
        const sourceSummary = buildImportSourceSummary(parseText);
        await api.createTravelImport(trip._id, {
          sourceType: 'manual_text',
          sourceHash,
          ...sourceSummary,
          status: 'failed',
          model: 'gemini-2.5-flash',
          validationErrors: [message],
        }).then((travelImport) => {
          setTravelImports(prev => [travelImport, ...prev.filter(item => item._id !== travelImport._id)]);
        });
      } catch (historyError) {
        console.warn('Failed to record failed travel import:', historyError);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const resetAIParseModal = () => {
    setIsAIParseModalOpen(false);
    setParseText('');
    setParseError(null);
    setParsedCandidates([]);
    setActiveTravelImportId(null);
  };

  const handleAddParsedCandidates = async () => {
    if (!trip) return;

    const selectedCandidates = parsedCandidates.filter(candidate => candidate.selected && candidate.validation.valid);
    if (selectedCandidates.length === 0) return;

    try {
      setIsAddingParsedEvents(true);
      const createdEventIds: string[] = [];
      for (const candidate of selectedCandidates) {
        await handleSaveEvent(candidate.event);
        createdEventIds.push(candidate.event.id);
      }

      if (activeTravelImportId) {
        try {
          const updatedImport = await api.updateTravelImport(trip._id, activeTravelImportId, {
            status: createdEventIds.length === selectedCandidates.length ? 'accepted' : 'partially_accepted',
            createdEventIds,
            validationErrors: parsedCandidates.flatMap(candidate => [
              ...candidate.validation.errors,
              ...candidate.validation.warnings,
            ]),
          });
          setTravelImports(prev => prev.map(item => item._id === updatedImport._id ? updatedImport : item));
        } catch (historyError) {
          console.warn('Failed to update travel import history:', historyError);
        }
      }
      resetAIParseModal();
    } catch (error) {
      console.error('Error adding parsed events:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to add parsed events');
    } finally {
      setIsAddingParsedEvents(false);
    }
  };

  const handleReviewTravelImport = (travelImport: TravelImport) => {
    if (!trip) return;
    const candidates = buildParsedEventCandidates(travelImport.parsedEvents || [], trip.events);
    setParsedCandidates(candidates);
    setActiveTravelImportId(travelImport._id);
    setParseError(null);
    setParseText('');
  };

  const handleDismissTravelImport = async (travelImport: TravelImport) => {
    if (!trip?._id) return;

    try {
      const updatedImport = await api.updateTravelImport(trip._id, travelImport._id, {
        status: 'dismissed',
      });
      setTravelImports(prev => prev.map(item => item._id === updatedImport._id ? updatedImport : item));
    } catch (error) {
      console.error('Error dismissing travel import:', error);
      setTravelImportError(error instanceof Error ? error.message : 'Failed to dismiss import');
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!trip || !user) return;

    try {
      setIsGeneratingSuggestions(true);
      setSuccess(null);

      // Calculate trip dates from events
      const sortedEvents = [...trip.events].sort((a, b) => {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        return dateA - dateB;
      });

      const startDate = trip.startDate || sortedEvents[0]?.startDate || new Date().toISOString();
      const endDate = trip.endDate || sortedEvents[sortedEvents.length - 1]?.endDate || startDate;

      const suggestions = await api.generateDestinationSuggestions(
        trip.events,
        { startDate, endDate },
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl || null
        }
      );
      
      // Store suggestions for the success dialog
      setGeneratedSuggestions(suggestions);
      setShowSuccessDialog(true);
      
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setSuccess('Failed to generate suggestions. Please try again.');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleAddSelectedSuggestions = async (selectedSuggestions: Event[]) => {
    if (!trip) return;

    try {
      setIsAddingSuggestions(true);
      setAddingProgress(0);
      
      const selectedEvents = selectedSuggestions.filter(s => s.selected);
      const totalEvents = selectedEvents.length;
      
      // Add each selected suggestion to the trip
      for (let i = 0; i < selectedEvents.length; i++) {
        const suggestion = selectedEvents[i];
        await handleSaveEvent(suggestion);
        setAddingProgress(((i + 1) / totalEvents) * 100);
      }
      
      setShowSuccessDialog(false);
      setGeneratedSuggestions([]);
    } catch (error) {
      console.error('Error adding selected suggestions:', error);
      alert('Failed to add some suggestions. Please try again.');
    } finally {
      setIsAddingSuggestions(false);
      setAddingProgress(0);
    }
  };

  if (loading) return <TripLoading />;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!trip) return <div className="p-4">Trip not found.</div>;

  // Define which event types can be added from the dropdown
  // Adjust this array as needed
  const addableEventTypes: EventType[] = [
    'arrival', 'departure', 'stay', 'flight', 'train', 'bus', 'rental_car', 'activity', 'destination'
  ];

  const handleProactiveCardAction = (card: ProactiveContextCardData) => {
    switch (card.type) {
      case 'next_up':
        if (card.event) handleEditEventClick(card.event);
        break;
      case 'travel_day':
      case 'travel_status':
      case 'urgent_insights':
        openPanel('today');
        break;
      case 'alerts':
        openPanel('notifications');
        fetchNotifications(false);
        break;
      case 'pending_imports':
        setIsAIParseModalOpen(true);
        break;
      case 'location_issues':
        handleImproveLocations();
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <TripDetailsHero
        trip={trip}
        tripThumbnail={tripThumbnail}
        currentUserId={user?._id}
        isOwner={isOwner}
        canEdit={canEdit}
        descriptionHtml={processText(trip.description)}
        expenseSummary={expenseSummary}
        onExport={handleExportHTML}
        onTripUpdate={async (updatedTrip) => {
          try {
            await handleTripUpdate(updatedTrip);
            return Promise.resolve();
          } catch (error) {
            console.error('Error updating trip:', error);
            return Promise.reject(error);
          }
        }}
      />

      <TripDetailsToolbar
        tripId={trip._id}
        canEdit={canEdit}
        addableEventTypes={addableEventTypes}
        activePanel={activePanel}
        unreadNotificationCount={unreadNotificationCount}
        isCondensedView={isCondensedView}
        isGeneratingSuggestions={isGeneratingSuggestions}
        isImprovingLocations={isImprovingLocations}
        onOpenAIImport={() => setIsAIParseModalOpen(true)}
        onAddEvent={handleAddEventClick}
        onGenerateSuggestions={handleGenerateSuggestions}
        onImproveLocations={handleImproveLocations}
        onOpenPanel={openPanel}
        onOpenNotifications={() => {
          openPanel('notifications');
          fetchNotifications();
        }}
        onCondensedViewChange={setIsCondensedView}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="min-w-0 space-y-6">
          <TripTimeline
            events={trip.events}
            tripStartDate={trip.startDate}
            tripEndDate={trip.endDate}
            eventThumbnails={eventThumbnails}
            isCondensedView={isCondensedView}
            canEdit={canEdit}
            deletingEvents={deletingEvents}
            weatherSnapshots={weatherSnapshots}
            flightStatusSnapshots={flightStatusSnapshots}
            notifications={notifications}
            onEditEvent={handleEditEventClick}
            onDeleteEvent={handleDeleteEvent}
            onStatusChange={handleStatusChange}
            onAddEvent={canEdit ? () => handleAddEventClick('stay') : undefined}
          />
        </main>

        <div className="space-y-4">
          {contextSignals && (
            <ProactiveTripContext
              signals={contextSignals}
              onCardAction={handleProactiveCardAction}
              onDismissCard={handleDismissContextCard}
            />
          )}
        </div>
      </div>

      <MobileTripActionsFab
        activePanel={activePanel}
        unreadNotificationCount={unreadNotificationCount}
        onOpenPanel={openPanel}
        onOpenNotifications={() => {
          openPanel('notifications');
          fetchNotifications();
        }}
        onClosePanel={closePanel}
      />

      <TripPanelHost
        activePanel={activePanel}
        trip={trip}
        canEdit={canEdit}
        insights={visibleTripInsights}
        notifications={notifications}
        notificationPreferences={notificationPreferences}
        isLoadingNotifications={isLoadingNotifications}
        notificationError={notificationError}
        weatherSnapshots={weatherSnapshots}
        flightStatusSnapshots={flightStatusSnapshots}
        todayBriefing={todayBriefing?.briefing}
        todayBriefingGeneratedAt={todayBriefing?.generatedAt}
        todayBriefingError={todayBriefingError}
        isGeneratingTodayBriefing={isGeneratingTodayBriefing}
        replanBriefing={replanBriefing?.briefing}
        replanBriefingGeneratedAt={replanBriefing?.generatedAt}
        replanBriefingError={replanBriefingError}
        isGeneratingReplanBriefing={isGeneratingReplanBriefing}
        onClose={closePanel}
        onOpenPanel={openPanel}
        onRefreshNotifications={() => fetchNotifications()}
        onMarkNotificationRead={(notification) => handleUpdateNotification(notification, { read: true })}
        onDismissNotification={(notification) => handleUpdateNotification(notification, { dismissed: true })}
        onNotificationAction={handleNotificationAction}
        onUpdateNotificationPreferences={handleUpdateNotificationPreferences}
        onGenerateTodayBriefing={handleGenerateTodayBriefing}
        onGenerateReplanBriefing={handleGenerateReplanBriefing}
        onEditEvent={handleEditEventClick}
        onDismissInsight={handleDismissInsight}
      />

      <TravelImportDialog
        open={isAIParseModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAIParseModalOpen(true);
          } else {
            resetAIParseModal();
          }
        }}
        parseText={parseText}
        onParseTextChange={(text) => {
          setParseText(text);
          setParsedCandidates([]);
        }}
        isParsing={isParsing}
        parseError={parseError}
        parseWarning={parseWarning}
        parsedCandidates={parsedCandidates}
        onParsedCandidatesChange={setParsedCandidates}
        isAddingParsedEvents={isAddingParsedEvents}
        travelImports={travelImports}
        importInboxFilter={importInboxFilter}
        onImportInboxFilterChange={setImportInboxFilter}
        showAllTravelImports={showAllTravelImports}
        onShowAllTravelImportsChange={setShowAllTravelImports}
        isLoadingTravelImports={isLoadingTravelImports}
        travelImportError={travelImportError}
        existingEvents={trip.events}
        onRefreshTravelImports={fetchTravelImports}
        onReviewTravelImport={handleReviewTravelImport}
        onDismissTravelImport={handleDismissTravelImport}
        onCancel={resetAIParseModal}
        onParse={handleAIParse}
        onAddParsedCandidates={handleAddParsedCandidates}
      />

      <EventFormModalRouter
        modalType={modalType}
        editingEvent={editingEvent}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
      />

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI Suggestions Added Successfully
            </DialogTitle>
            <DialogDescription>
              Select the suggestions you want to add to your trip:
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-2 min-h-0">
            {generatedSuggestions.map((suggestion, index) => (
              <div key={suggestion.id} className="p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`suggestion-${index}`}
                    checked={suggestion.selected}
                    onChange={(e) => {
                      const updatedSuggestions = [...generatedSuggestions];
                      updatedSuggestions[index] = {
                        ...suggestion,
                        selected: e.target.checked
                      };
                      setGeneratedSuggestions(updatedSuggestions);
                    }}
                    disabled={isAddingSuggestions}
                  />
                  <label htmlFor={`suggestion-${index}`} className="flex-1">
                    <h4 className="font-medium">
                      {suggestion.type === 'activity' 
                        ? (suggestion as ActivityEvent).title 
                        : (suggestion as DestinationEvent).placeName}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {suggestion.type === 'activity' 
                        ? (suggestion as ActivityEvent).description 
                        : (suggestion as DestinationEvent).description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(suggestion.startDate), 'MMM d, yyyy')} at{' '}
                        {format(new Date(suggestion.startDate), 'h:mm a')}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {isAddingSuggestions && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Adding events...</span>
                <span>{Math.round(addingProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-in-out"
                  style={{ width: `${addingProgress}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button 
              onClick={() => handleAddSelectedSuggestions(generatedSuggestions)}
              disabled={!generatedSuggestions.some(s => s.selected) || isAddingSuggestions}
            >
              {isAddingSuggestions ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Adding Events...
                </div>
              ) : (
                'Add Selected Suggestions'
              )}
            </Button>
            <Button 
              onClick={() => setShowSuccessDialog(false)}
              disabled={isAddingSuggestions}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

// Add the animation keyframes to your global CSS or tailwind config
const styles = `
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
}

.animate-fade-out {
  animation: fadeOut 0.3s ease-out forwards;
}
`;

export default NewTripDetails;
