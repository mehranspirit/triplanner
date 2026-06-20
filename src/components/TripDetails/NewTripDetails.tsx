import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripDetails } from './hooks';
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI Button
import { Event, EventType, Trip } from '@/types/eventTypes'; // Import EventType
import { cn } from '@/lib/utils';
import ExploreSuggestionsModal from '@/components/TripDetails/ExploreSuggestionsModal';
import PlaceAddEventDialog from '@/components/TripDetails/PlaceAddEventDialog';
import ReviewUnresolvedLocationsDialog from '@/components/TripDetails/ReviewUnresolvedLocationsDialog';
import LocationConfirmDialog from '@/components/TripDetails/LocationConfirmDialog';
import { useLocationConfirmQueue } from '@/components/TripDetails/hooks/useLocationConfirmQueue';
import TripDetailsToolbar from '@/components/TripDetails/TripDetailsToolbar';
import TripDetailsHero from '@/components/TripDetails/TripDetailsHero';
import ProactiveTripContext from '@/components/TripDetails/ProactiveTripContext';
import TripPanelHost from '@/components/TripDetails/panels/TripPanelHost';
import { useTripPanelManager, TripPanel, TripPanelOptions } from '@/components/TripDetails/hooks/useTripPanelManager';
import { useMapView } from '@/components/TripDetails/hooks/useMapView';
import { useTripDetailsTab } from '@/components/TripDetails/hooks/useTripDetailsTab';
import MapTripView from '@/components/TripDetails/map/MapTripView';
import MapSheetBody from '@/components/TripDetails/map/MapSheetBody';
import MapViewSuggestPrompt from '@/components/TripDetails/map/MapViewSuggestPrompt';
import TripTimeline, { TripTimelineHandle } from '@/components/TripDetails/timeline/TripTimeline';
import TripDayStrip from '@/components/TripDetails/TripDayStrip';
import TripCalendarView from '@/components/TripDetails/TripCalendarView';
import { TripDetailsView } from '@/types/tripDetailsViewTypes';
import TravelImportDialog, { ImportInboxFilter } from '@/components/TripDetails/imports/TravelImportDialog';
import { getTripContextSignals } from '@/components/TripDetails/context/getTripContextSignals';
import { ProactiveContextCard as ProactiveContextCardData, ProactiveContextCardType } from '@/components/TripDetails/context/tripContextTypes';
import { generateTripInsights, getMissingLocationInsightId } from '@/services/tripInsights';
import { computeTripHealth } from '@/services/tripHealth';
import { executeResolution, ExploreScope } from '@/services/resolutionDispatcher';
import { HealthDismissalReason, ResolutionAction } from '@/types/tripHealthTypes';
import { buildEventDraftFromPrefill } from '@/utils/eventFormPrefill';
import { useEventVotes } from '@/components/TripDetails/hooks/useEventVotes';
import { useElementHeight } from '@/components/TripDetails/hooks/useElementHeight';
import { useStickyChromeOffsets } from '@/components/TripDetails/hooks/useTimelineStickyTop';
import { useDecisions } from '@/components/TripDetails/hooks/useDecisions';
import DecisionComparisonView from '@/components/TripDetails/decisions/DecisionComparisonView';
import CreateDecisionDialog from '@/components/TripDetails/decisions/CreateDecisionDialog';
import AddDecisionOptionDialog from '@/components/TripDetails/decisions/AddDecisionOptionDialog';
import {
  getExploreScopeForDecisionEvent,
  getOrphanExploringEvents,
  inferDecisionSlotFromEvents,
  normalizePreselectedDecisionIds,
  suggestDecisionTitle,
} from '@/utils/decisionHelpers';
import { DecisionLoserAction } from '@/types/decisionTypes';
import { eventNeedsMapLocation, getTripMapLocationProgress } from '@/utils/eventLocation';
import { buildParsedEventCandidates, ParsedEventCandidate } from '@/services/travelImportValidation';
import { api } from '@/services/api';
import { hashText } from '@/utils/hash';
import { NotificationPreference, TripNotification } from '@/types/notificationTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { TimelineTransferLeg } from '@/types/timelineTransferLegTypes';
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
import EventDetailSheet from '@/components/TripDetails/EventCards/EventDetailSheet';
import {
  getEventDetailWeatherLabel,
  resolveOutboundTransferForEvent,
} from '@/utils/eventDetailContent';
import { EVENT_TYPES } from '@/eventTypes/registry';
import TripLoading from '@/components/ui/trip-loading';
import { getTripStatusSummary } from '@/services/tripStatus';
import {
  hasTripMapViewPreference,
  loadMapViewSuggestDismissed,
  saveMapViewSuggestDismissed,
} from '@/utils/mapViewPreferences';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { buildTripDayStripItems, ALL_DAYS_FILTER_KEY, getTimelineDateKey, getTimelineAutoScrollDependencyKey, resolveActiveTimelineDayKey } from '@/utils/timelineDates';
import { useTripSimulatedDate } from '@/components/TripDetails/hooks/useTripSimulatedDate';
import { TripReferenceNowProvider } from '@/components/TripDetails/TripReferenceNowContext';
import MobileTripActionsFab from '@/components/TripDetails/MobileTripActionsFab';

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
    addEvents,
    updateEvent, // Function to update event
    deleteEvent, // Function to delete event
    replaceTripEvents,
    handleExportHTML,
    canEdit,
    isOwner, 
    user,
    handleTripUpdate,
    patchTripLocal,
    fetchTrip
  } = useTripDetails();

  const simulatedDate = useTripSimulatedDate(trip);

  const locationConfirmQueue = useLocationConfirmQueue({
    tripId: trip?._id,
    onTripUpdated: replaceTripEvents,
  });

  const [modalType, setModalType] = useState<EventType | null>(null); // State to track which modal to show
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventFormDraft, setEventFormDraft] = useState<Partial<Event> | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  const { activePanel, panelOptions, openPanel, closePanel } = useTripPanelManager();
  const { isMapView, isHydrated, setMapView } = useMapView(trip?._id);
  const { activeTab: detailsTab, setActiveTab: setDetailsTab } = useTripDetailsTab(trip?._id);
  const timelineRef = useRef<TripTimelineHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dayStripRef = useRef<HTMLElement>(null);
  const [activeDayKey, setActiveDayKey] = useState(ALL_DAYS_FILTER_KEY);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

  const handleSetMapView = useCallback((next: boolean) => {
    if (next) closePanel();
    setMapView(next);
  }, [closePanel, setMapView]);

  const handleDetailsViewChange = useCallback((view: TripDetailsView) => {
    if (view === 'map') {
      handleSetMapView(true);
      return;
    }
    if (view === 'calendar' && isMobileLayout) {
      return;
    }
    handleSetMapView(false);
    setDetailsTab(view);
  }, [handleSetMapView, isMobileLayout, setDetailsTab]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const syncMobileLayout = () => setIsMobileLayout(media.matches);
    syncMobileLayout();
    media.addEventListener('change', syncMobileLayout);
    return () => media.removeEventListener('change', syncMobileLayout);
  }, []);

  useEffect(() => {
    if (isMobileLayout && detailsTab === 'calendar') {
      setDetailsTab('itinerary');
    }
  }, [detailsTab, isMobileLayout, setDetailsTab]);

  const [showMapSuggest, setShowMapSuggest] = useState(false);
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [weatherSnapshots, setWeatherSnapshots] = useState<WeatherSnapshot[]>([]);
  const [timelineTransferLegs, setTimelineTransferLegs] = useState<TimelineTransferLeg[]>([]);
  const eventLocationSignature = useMemo(() => {
    if (!trip?.events) return '';

    return trip.events.map((event) => {
      const transport = event as Event & {
        departureLocation?: { lat?: number; lng?: number };
        arrivalLocation?: { lat?: number; lng?: number };
      };
      const loc = event.location;

      return [
        event.id,
        loc?.lat,
        loc?.lng,
        transport.departureLocation?.lat,
        transport.departureLocation?.lng,
        transport.arrivalLocation?.lat,
        transport.arrivalLocation?.lng,
      ].join(':');
    }).join('|');
  }, [trip?.events]);
  const weatherLocationSignature = useMemo(
    () => weatherSnapshots.map((snapshot) => (
      `${snapshot.eventId}:${snapshot.originalEventId ?? ''}:${snapshot.locationRole}:${snapshot.lat}:${snapshot.lng}`
    )).join('|'),
    [weatherSnapshots],
  );
  const prevEventLocationSignatureRef = useRef<string | null>(null);
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
  const [deletingEvents, setDeletingEvents] = useState<Set<string>>(new Set());
  const [isReviewUnresolvedOpen, setIsReviewUnresolvedOpen] = useState(false);
  const [isExploreSuggestionsOpen, setIsExploreSuggestionsOpen] = useState(false);
  const [isPlaceAddOpen, setIsPlaceAddOpen] = useState(false);
  const [exploreScope, setExploreScope] = useState<ExploreScope | null>(null);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [isCreateDecisionOpen, setIsCreateDecisionOpen] = useState(false);
  const [createDecisionPreselectedIds, setCreateDecisionPreselectedIds] = useState<string[]>([]);
  const [isAddDecisionOptionOpen, setIsAddDecisionOptionOpen] = useState(false);
  const [decisionActionError, setDecisionActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
  const tripHealth = useMemo(
    () => (trip
      ? computeTripHealth({
          trip,
          dismissals: trip.healthDismissals ?? [],
          decisions: trip.decisions ?? [],
          weatherSnapshots,
        })
      : null),
    [trip, weatherSnapshots],
  );
  const { handleVote } = useEventVotes(trip, replaceTripEvents);

  const handleDecisionsUpdated = useCallback(async (
    updates: Partial<Pick<Trip, 'decisions' | 'events'>>,
  ) => {
    if (!trip) return;

    // Decisions are persisted via dedicated API routes — merge locally only.
    if (updates.events) {
      await handleTripUpdate(updates);
      return;
    }

    if (updates.decisions) {
      patchTripLocal({ decisions: updates.decisions });
    }
  }, [trip, handleTripUpdate, patchTripLocal]);

  const {
    createDecision,
    updateDecision,
    deleteDecision,
    confirmDecision,
    generateComparisonOverview,
  } = useDecisions(trip, handleDecisionsUpdated);

  const activeDecision = useMemo(
    () => trip?.decisions?.find((decision) => decision.id === activeDecisionId) ?? null,
    [trip?.decisions, activeDecisionId],
  );

  useEffect(() => {
    if (!panelOptions.issueId?.startsWith('open_decision:')) return;
    const decisionId = panelOptions.issueId.slice('open_decision:'.length);
    if (decisionId) {
      setActiveDecisionId(decisionId);
    }
  }, [panelOptions.issueId]);

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
      tripHealth,
      now: simulatedDate.referenceNow,
    }) : null,
    [trip, notifications, travelImports, visibleTripInsights, weatherSnapshots, flightStatusSnapshots, dismissedInsightIds, dismissedContextCardTypes, tripHealth, simulatedDate.referenceNow]
  );
  const mapLocationProgress = useMemo(
    () => getTripMapLocationProgress(trip?.events ?? []),
    [trip?.events],
  );
  const toolbarHeight = useElementHeight(toolbarRef, [
    canEdit,
    detailsTab,
    isMobileLayout,
    mapLocationProgress.geocoded,
    mapLocationProgress.total,
    locationConfirmQueue.open,
    simulatedDate.isUiTestTrip,
    simulatedDate.isSimulating,
  ]);
  const dayStripItems = useMemo(
    () => buildTripDayStripItems(trip?.events ?? [], trip?.startDate, trip?.endDate, simulatedDate.referenceNow),
    [trip?.endDate, trip?.events, trip?.startDate, simulatedDate.referenceNow],
  );
  const stickyChromeOffsets = useStickyChromeOffsets(
    toolbarRef,
    dayStripRef,
    !isMapView && isMobileLayout && detailsTab === 'itinerary',
    [
      toolbarHeight,
      detailsTab,
      dayStripItems.length,
      simulatedDate.isUiTestTrip,
      simulatedDate.isSimulating,
    ],
  );
  const mobileToolbarStickyTop = stickyChromeOffsets.toolbarBottom > 0
    ? stickyChromeOffsets.toolbarBottom
    : (toolbarHeight ?? 0);
  const resolvedTimelineStickyTop = stickyChromeOffsets.timelineStickyTop > 0
    ? stickyChromeOffsets.timelineStickyTop
    : (toolbarHeight ?? 112);
  const resolvedToolbarHeight = isMobileLayout && !isMapView
    ? mobileToolbarStickyTop
    : (toolbarHeight ?? 112);

  useEffect(() => {
    setActiveDayKey(ALL_DAYS_FILTER_KEY);
  }, [trip?._id]);

  const timelineAutoScrollKey = useMemo(
    () => getTimelineAutoScrollDependencyKey(trip?.events ?? []),
    [trip?.events],
  );

  useEffect(() => {
    if (!trip?._id || !isHydrated || isMapView || detailsTab !== 'itinerary') return;

    const activeDayKey = resolveActiveTimelineDayKey(
      trip.events ?? [],
      trip.startDate,
      trip.endDate,
      simulatedDate.referenceNow,
    );
    if (!activeDayKey) return;

    const frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        timelineRef.current?.scrollToDay(activeDayKey);
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    trip?._id,
    timelineAutoScrollKey,
    trip?.startDate,
    trip?.endDate,
    detailsTab,
    isHydrated,
    isMapView,
    simulatedDate.referenceNow,
  ]);

  const handleDaySelect = useCallback((dateKey: string) => {
    setActiveDayKey(dateKey);
  }, []);

  const handleCalendarEventSelect = useCallback((event: Event) => {
    setSelectedEventId(event.id);
    setDetailsTab('itinerary');
    const dateKey = getTimelineDateKey(event);
    setActiveDayKey(dateKey || ALL_DAYS_FILTER_KEY);
    window.requestAnimationFrame(() => {
      timelineRef.current?.scrollToEvent(event.id);
    });
  }, [setDetailsTab]);

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

  const handleOpenPanelForMap = useCallback((panel: TripPanel, options?: TripPanelOptions) => {
    if (panel === 'map') {
      closePanel();
      return;
    }
    openPanel(panel, options);
    if (panel === 'notifications') {
      fetchNotifications();
    }
  }, [closePanel, openPanel, fetchNotifications]);

  useEffect(() => {
    if (!trip?._id || !isHydrated || isMapView) {
      setShowMapSuggest(false);
      return;
    }

    const status = getTripStatusSummary(trip);
    setShowMapSuggest(
      status.status === 'active'
        && !hasTripMapViewPreference(trip._id)
        && !loadMapViewSuggestDismissed(trip._id),
    );
  }, [trip, isHydrated, isMapView]);

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
          handleNavigateToEventDetail(event);
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

    const fetchTimelineLegs = async () => {
      const refresh = prevEventLocationSignatureRef.current !== null
        && prevEventLocationSignatureRef.current !== eventLocationSignature;
      prevEventLocationSignatureRef.current = eventLocationSignature;

      try {
        const data = await api.getTripTimelineLegs(trip._id, { refresh });
        setTimelineTransferLegs(data.legs || []);
      } catch (error) {
        console.error('Error loading timeline transfer legs:', error);
        setTimelineTransferLegs([]);
      }
    };

    fetchTimelineLegs();
  }, [trip?._id, trip?.updatedAt, eventLocationSignature, weatherLocationSignature]);

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
          handleNavigateToEventDetail(event);
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

  const handleImproveLocations = () => {
    setIsReviewUnresolvedOpen(true);
  };

  const handleStartLocationReview = (eventsToReview: Event[]) => {
    const started = locationConfirmQueue.startUnresolvedReview(eventsToReview);
    if (started) {
      setIsReviewUnresolvedOpen(false);
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

  const handleOpenDecision = useCallback((decisionId: string) => {
    setActiveDecisionId(decisionId);
    openPanel('planning');
  }, [openPanel]);

  const handleOpenHealthIssue = useCallback((issueId: string) => {
    openPanel('planning', { issueId });
  }, [openPanel]);

  const handleCreateDecisionClick = useCallback((preselectedEventIds: string[] = []) => {
    if (trip) {
      const orphanEvents = getOrphanExploringEvents(trip);
      setCreateDecisionPreselectedIds(
        normalizePreselectedDecisionIds(orphanEvents, preselectedEventIds),
      );
    } else {
      setCreateDecisionPreselectedIds(preselectedEventIds);
    }
    setIsCreateDecisionOpen(true);
    openPanel('planning');
  }, [openPanel, trip]);

  const handleExploreDecisionAlternative = useCallback((event: Event) => {
    const scope = getExploreScopeForDecisionEvent(event);
    setExploreScope({
      date: scope.date,
      endDate: scope.endDate,
      defaultKeywords: scope.defaultKeywords,
    });
    setIsCreateDecisionOpen(false);
    setIsExploreSuggestionsOpen(true);
  }, []);

  const handleCreateDecision = useCallback(async (payload: {
    title: string;
    optionEventIds: string[];
    slot?: { date?: string; endDate?: string; label?: string };
  }) => {
    setDecisionActionError(null);
    const decisions = await createDecision(payload);
    if (!decisions?.length) {
      throw new Error('Failed to create decision');
    }

    const created = decisions.find((decision) => (
      decision.optionEventIds.length === payload.optionEventIds.length
      && payload.optionEventIds.every((eventId) => decision.optionEventIds.includes(eventId))
    )) ?? decisions[decisions.length - 1];

    const hasOverview = Boolean(
      created.comparisonOverview && !created.comparisonOverview.stale,
    );

    if (!hasOverview) {
      try {
        await generateComparisonOverview(created.id);
      } catch (error) {
        setDecisionActionError(
          error instanceof Error ? error.message : 'Failed to generate comparison overview',
        );
      }
    }

    setActiveDecisionId(created.id);
    setIsCreateDecisionOpen(false);
  }, [createDecision, generateComparisonOverview]);

  const handleRemoveDecisionOption = useCallback(async (decisionId: string, eventId: string) => {
    setDecisionActionError(null);
    await updateDecision(decisionId, { removeOptionEventIds: [eventId] });
  }, [updateDecision]);

  const handleAddDecisionOption = useCallback(async (eventId: string) => {
    if (!activeDecisionId) return;
    setDecisionActionError(null);
    await updateDecision(activeDecisionId, { addOptionEventIds: [eventId] });
  }, [activeDecisionId, updateDecision]);

  const handleExploreNewDecisionOption = useCallback(() => {
    if (!activeDecision) return;
    setExploreScope(activeDecision.slot?.date ? {
      date: activeDecision.slot.date,
      endDate: activeDecision.slot.endDate,
    } : null);
    setIsExploreSuggestionsOpen(true);
  }, [activeDecision]);

  const handleOpenAddDecisionOption = useCallback((decisionId: string) => {
    setActiveDecisionId(decisionId);
    setIsAddDecisionOptionOpen(true);
  }, []);

  const handleGenerateComparisonOverview = useCallback(async (
    decisionId: string,
    options?: { refresh?: boolean },
  ) => {
    setDecisionActionError(null);
    await generateComparisonOverview(decisionId, options);
  }, [generateComparisonOverview]);

  const handleDeferDecision = useCallback(async (decisionId: string) => {
    setDecisionActionError(null);
    await updateDecision(decisionId, { status: 'deferred' });
  }, [updateDecision]);

  const handleDeleteDecision = useCallback(async (decisionId: string) => {
    setDecisionActionError(null);
    await deleteDecision(decisionId);
    if (activeDecisionId === decisionId) {
      setActiveDecisionId(null);
    }
  }, [deleteDecision, activeDecisionId]);

  const handleConfirmDecision = useCallback(async (
    decisionId: string,
    winnerEventId: string,
    loserAction: DecisionLoserAction,
  ) => {
    setDecisionActionError(null);
    await confirmDecision(decisionId, { winnerEventId, loserAction });
    setActiveDecisionId(null);
  }, [confirmDecision]);

  const handleAddEventClick = useCallback((type: EventType, prefill?: Record<string, unknown>) => {
    setEditingEvent(null);
    setEventFormDraft(
      trip ? buildEventDraftFromPrefill(type, prefill, trip.events) : null,
    );
    setModalType(type);
  }, [trip]);

  const handleEditEventClick = (event: Event) => {
    setEventFormDraft(null);
    setEditingEvent(event);
    setModalType(event.type); // Open the modal corresponding to the event type
    // setIsModalOpen(true); // No longer needed
  };

  const detailEvent = useMemo(
    () => (detailEventId && trip?.events
      ? trip.events.find((candidate) => candidate.id === detailEventId) ?? null
      : null),
    [detailEventId, trip?.events],
  );

  const detailEventThumbnail = useMemo(() => {
    if (!detailEvent) return undefined;
    const registryItem = EVENT_TYPES[detailEvent.type];
    return eventThumbnails[detailEvent.id] || registryItem?.defaultThumbnail;
  }, [detailEvent, eventThumbnails]);

  const detailEventContext = useMemo(() => {
    if (!detailEvent || !trip) {
      return {
        weatherLabel: null,
        flightStatus: null,
        outboundTransfer: null,
        currency: 'USD',
      };
    }

    const currency = trip.settings?.defaultCurrency || trip.budget?.currency || 'USD';

    return {
      weatherLabel: getEventDetailWeatherLabel(detailEvent, weatherSnapshots),
      flightStatus: flightStatusSnapshots.find(
        (snapshot) => snapshot.eventId === detailEvent.id,
      ) ?? null,
      outboundTransfer: resolveOutboundTransferForEvent(
        detailEvent,
        trip.events,
        weatherSnapshots,
        timelineTransferLegs,
      ),
      currency,
    };
  }, [detailEvent, trip, weatherSnapshots, flightStatusSnapshots, timelineTransferLegs]);

  const handleOpenEventDetail = useCallback((event: Event) => {
    setDetailEventId(event.id);
  }, []);

  const handleNavigateToEventDetail = useCallback((event: Event) => {
    closePanel();
    setDetailEventId(event.id);
  }, [closePanel]);

  const handleNavigateToEventDetailById = useCallback((eventId: string) => {
    if (!trip) return;
    const event = trip.events.find((candidate) => candidate.id === eventId);
    if (event) {
      handleNavigateToEventDetail(event);
    }
  }, [trip, handleNavigateToEventDetail]);

  const handleCloseEventDetail = useCallback(() => {
    setDetailEventId(null);
  }, []);

  const handleDetailEdit = useCallback(() => {
    if (!detailEvent) return;
    setDetailEventId(null);
    handleEditEventClick(detailEvent);
  }, [detailEvent]);

  const handleDismissHealthIssue = useCallback(async (
    issueKey: string,
    reason: HealthDismissalReason,
    note?: string,
    reopenBeforeTripDays?: number,
  ) => {
    if (!trip?._id) return;

    const dismissals = await api.patchHealthDismissals(trip._id, {
      issueKey,
      reason,
      note,
      reopenBeforeTripDays,
    });
    await handleTripUpdate({ healthDismissals: dismissals });
  }, [trip?._id, handleTripUpdate]);

  const handleExecuteHealthResolution = useCallback(async (
    action: ResolutionAction,
    payload?: Record<string, unknown>,
  ) => {
    if (!trip) return;

    await executeResolution(action, payload, {
      tripId: trip._id,
      openPanel,
      onAddEvent: handleAddEventClick,
      onOpenEventDetail: handleNavigateToEventDetailById,
      onOpenExplore: (scope) => {
        setExploreScope(scope ?? null);
        setIsExploreSuggestionsOpen(true);
      },
      onReviewLocation: (eventId) => {
        const event = trip.events.find((candidate) => candidate.id === eventId);
        if (event) {
          locationConfirmQueue.startUnresolvedReview([event]);
        }
      },
      onOpenImport: () => setIsAIParseModalOpen(true),
      onOpenDecision: (decisionId) => {
        if (decisionId) {
          handleOpenDecision(decisionId);
        } else {
          openPanel('planning');
        }
      },
      onDeferDecision: handleDeferDecision,
      onCreateDecisionGroup: (optionEventIds) => handleCreateDecisionClick(optionEventIds),
      onAddDecisionOption: handleOpenAddDecisionOption,
      onDismissIssue: handleDismissHealthIssue,
    });
  }, [
    trip,
    openPanel,
    handleAddEventClick,
    handleDismissHealthIssue,
    locationConfirmQueue,
    handleOpenDecision,
    handleDeferDecision,
    handleCreateDecisionClick,
    handleOpenAddDecisionOption,
    handleNavigateToEventDetailById,
  ]);

  const handleCloseModal = () => {
    setModalType(null); // Close by clearing the type
    setEditingEvent(null);
    setEventFormDraft(null);
  };

  const handleCloseExploreSuggestions = () => {
    setIsExploreSuggestionsOpen(false);
    setExploreScope(null);
  };

  const handleAddPlaceEvent = async (
    eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>,
  ) => {
    const newEvent = await addEvent(eventData);
    if (newEvent) {
      locationConfirmQueue.enqueue({
        event: newEvent,
        previousEvent: null,
      });

      if (trip) {
        trip.events = [...trip.events, newEvent];
      }
    }
  };

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => {
    try {
    if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        const eventToUpdate = { ...editingEvent, ...eventData } as Event;
        const result = await updateEvent(eventToUpdate);

        if (result) {
          locationConfirmQueue.enqueue({
            event: result.event,
            previousEvent: result.previousEvent,
          });

          if (trip) {
            const updatedEvents = trip.events.map(event =>
              event.id === result.event.id ? result.event : event
            );
            trip.events = updatedEvents;
          }
        }
    } else {
        const newEvent = await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);

        if (newEvent) {
          locationConfirmQueue.enqueue({
            event: newEvent,
            previousEvent: null,
          });

          if (trip) {
            trip.events = [...trip.events, newEvent];
          }
        }
      }

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

  const handleDetailDelete = useCallback(async () => {
    if (!detailEvent) return;
    await handleDeleteEvent(detailEvent.id);
    setDetailEventId(null);
  }, [detailEvent, trip]);

  const handleDetailStatusChange = useCallback(async (status: 'confirmed' | 'exploring') => {
    if (!detailEvent) return;
    await handleStatusChange(detailEvent, status);
  }, [detailEvent, trip]);

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

  const handleAddExploreSuggestions = async (
    eventsToAdd: Event[],
    options?: { groupAsDecision?: boolean; decisionTitle?: string },
  ) => {
    const eventDataList = eventsToAdd.map((event) => {
      const {
        id: _id,
        createdBy: _createdBy,
        createdAt: _createdAt,
        updatedBy: _updatedBy,
        updatedAt: _updatedAt,
        likes: _likes,
        dislikes: _dislikes,
        selected: _selected,
        ...eventData
      } = event as Event & { selected?: boolean };
      return eventData;
    });

    const newEvents = await addEvents(eventDataList);
    locationConfirmQueue.enqueueSavedEvents(newEvents);

    if (options?.groupAsDecision && newEvents.length >= 2) {
      const title = options.decisionTitle?.trim() || suggestDecisionTitle(newEvents);
      await handleCreateDecision({
        title,
        optionEventIds: newEvents.map((event) => event.id),
        slot: inferDecisionSlotFromEvents(newEvents),
      });
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
        if (card.event) handleOpenEventDetail(card.event);
        break;
      case 'travel_day':
        openPanel('today');
        break;
      case 'urgent_insights':
        openPanel('planning');
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
      case 'trip_health':
        openPanel('planning');
        break;
      default:
        break;
    }
  };

  const showMapView = isHydrated && isMapView;

  const isL4ModalOpen = isAIParseModalOpen
    || Boolean(modalType)
    || isExploreSuggestionsOpen
    || isPlaceAddOpen
    || isCreateDecisionOpen
    || isAddDecisionOptionOpen
    || isReviewUnresolvedOpen
    || locationConfirmQueue.open
    || Boolean(activeDecisionId);

  const tripTimeline = (
    <TripTimeline
      ref={timelineRef}
      events={trip.events}
      trip={trip}
      tripStartDate={trip.startDate}
      tripEndDate={trip.endDate}
      eventThumbnails={eventThumbnails}
      canEdit={canEdit}
      deletingEvents={deletingEvents}
      weatherSnapshots={weatherSnapshots}
      flightStatusSnapshots={flightStatusSnapshots}
      notifications={notifications}
      onOpenEventDetail={handleOpenEventDetail}
      onOpenDecision={handleOpenDecision}
      onCompareSelectedEvents={canEdit ? handleCreateDecisionClick : undefined}
      healthIssues={tripHealth?.issues ?? []}
      onOpenHealthIssue={handleOpenHealthIssue}
      onReviewEventLocation={
        canEdit
          ? (event) => locationConfirmQueue.startUnresolvedReview([event])
          : undefined
      }
      onAddEvent={canEdit ? handleAddEventClick : undefined}
      onOpenAIImport={canEdit ? () => setIsAIParseModalOpen(true) : undefined}
      onOpenExploreSuggestions={canEdit ? () => setIsExploreSuggestionsOpen(true) : undefined}
      onOpenPlaceSearch={canEdit ? () => setIsPlaceAddOpen(true) : undefined}
      addableEventTypes={addableEventTypes}
      dayFilterKey={activeDayKey}
      selectedEventId={selectedEventId}
      timelineTransferLegs={timelineTransferLegs}
      currentUserId={user?._id}
      onVote={handleVote}
    />
  );

  const mapSheetTimeline = (
    <TripTimeline
      variant="map-sheet"
      events={trip.events}
      trip={trip}
      tripStartDate={trip.startDate}
      tripEndDate={trip.endDate}
      eventThumbnails={eventThumbnails}
      canEdit={canEdit}
      deletingEvents={deletingEvents}
      weatherSnapshots={weatherSnapshots}
      flightStatusSnapshots={flightStatusSnapshots}
      notifications={notifications}
      onOpenEventDetail={handleOpenEventDetail}
      onOpenDecision={handleOpenDecision}
      healthIssues={tripHealth?.issues ?? []}
      onOpenHealthIssue={handleOpenHealthIssue}
      onReviewEventLocation={
        canEdit
          ? (event) => locationConfirmQueue.startUnresolvedReview([event])
          : undefined
      }
      onAddEvent={canEdit ? handleAddEventClick : undefined}
      onOpenAIImport={canEdit ? () => setIsAIParseModalOpen(true) : undefined}
      onOpenExploreSuggestions={canEdit ? () => setIsExploreSuggestionsOpen(true) : undefined}
      onOpenPlaceSearch={canEdit ? () => setIsPlaceAddOpen(true) : undefined}
      addableEventTypes={addableEventTypes}
      dayFilterKey={ALL_DAYS_FILTER_KEY}
      selectedEventId={selectedEventId}
      timelineTransferLegs={timelineTransferLegs}
      currentUserId={user?._id}
      onVote={handleVote}
    />
  );

  const mapSheetBodyProps = {
    activePanel,
    panelOptions,
    trip,
    canEdit,
    insights: visibleTripInsights,
    notifications,
    notificationPreferences,
    isLoadingNotifications,
    notificationError,
    weatherSnapshots,
    flightStatusSnapshots,
    todayBriefing: todayBriefing?.briefing,
    todayBriefingGeneratedAt: todayBriefing?.generatedAt,
    todayBriefingError,
    isGeneratingTodayBriefing,
    replanBriefing: replanBriefing?.briefing,
    replanBriefingGeneratedAt: replanBriefing?.generatedAt,
    replanBriefingError,
    isGeneratingReplanBriefing,
    onClose: closePanel,
    onOpenPanel: handleOpenPanelForMap,
    onRefreshNotifications: () => fetchNotifications(),
    onMarkNotificationRead: (notification: TripNotification) => handleUpdateNotification(notification, { read: true }),
    onDismissNotification: (notification: TripNotification) => handleUpdateNotification(notification, { dismissed: true }),
    onNotificationAction: handleNotificationAction,
    onUpdateNotificationPreferences: handleUpdateNotificationPreferences,
    onGenerateTodayBriefing: handleGenerateTodayBriefing,
    onGenerateReplanBriefing: handleGenerateReplanBriefing,
    onOpenEventDetail: handleNavigateToEventDetail,
    onDismissInsight: handleDismissInsight,
    tripHealthSummary: tripHealth?.summary ?? {
      headlineScore: 100,
      logisticsScore: 100,
      contentScore: 100,
      openIssueCount: 0,
      criticalCount: 0,
      warningCount: 0,
    },
    tripHealthIssues: tripHealth?.issues ?? [],
    isComputingTripHealth: loading,
    onExecuteHealthResolution: handleExecuteHealthResolution,
    onOpenDecision: handleOpenDecision,
    onCreateDecision: () => handleCreateDecisionClick(),
  };

  const mapMobileSheetBody = (
    <MapSheetBody {...mapSheetBodyProps} timeline={mapSheetTimeline} />
  );

  const mapDesktopRailBody = (
    <MapSheetBody {...mapSheetBodyProps} timeline={tripTimeline} />
  );

  return (
    <TripReferenceNowProvider value={simulatedDate}>
    <>
      {showMapView ? (
        <MapTripView
          trip={trip}
          canEdit={canEdit}
          mobileSheetBody={mapMobileSheetBody}
          desktopRailBody={mapDesktopRailBody}
          activePanel={activePanel}
          unreadNotificationCount={unreadNotificationCount}
          isOverlayModalOpen={isL4ModalOpen}
          onExitMapView={() => handleSetMapView(false)}
          onReviewLocations={handleImproveLocations}
          onOpenEvent={handleNavigateToEventDetail}
          onClosePanel={closePanel}
          toolbarMenuProps={{
            tripId: trip._id,
            canEdit,
            addableEventTypes,
            isImprovingLocations: locationConfirmQueue.open,
            improveLocationsLabel: locationConfirmQueue.open
              ? `Reviewing ${locationConfirmQueue.queuePosition.current}/${locationConfirmQueue.queuePosition.total}`
              : undefined,
            onOpenAIImport: () => setIsAIParseModalOpen(true),
            onAddEvent: handleAddEventClick,
            onOpenExploreSuggestions: () => setIsExploreSuggestionsOpen(true),
            onOpenPlaceSearch: () => setIsPlaceAddOpen(true),
            onImproveLocations: handleImproveLocations,
            onOpenPanel: handleOpenPanelForMap,
            onOpenNotifications: () => {
              handleOpenPanelForMap('notifications');
            },
            onViewChange: handleDetailsViewChange,
          }}
        />
      ) : (
    <div
      className={cn('min-h-screen', tripSurfaces.canvas)}
      style={{
        '--trip-details-toolbar-height': `${resolvedToolbarHeight}px`,
        '--trip-timeline-sticky-top': `${resolvedTimelineStickyTop}px`,
      } as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 lg:space-y-6 lg:px-4 lg:py-6">
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
        onOpenExpenses={() => navigate(`/trips/${trip._id}/expenses`)}
      />

      <TripDetailsToolbar
        ref={toolbarRef}
        tripId={trip._id}
        canEdit={canEdit}
        addableEventTypes={addableEventTypes}
        activePanel={activePanel}
        unreadNotificationCount={unreadNotificationCount}
        isImprovingLocations={locationConfirmQueue.open}
        improveLocationsLabel={
          locationConfirmQueue.open
            ? `Reviewing ${locationConfirmQueue.queuePosition.current}/${locationConfirmQueue.queuePosition.total}`
            : undefined
        }
        mapLocationProgress={mapLocationProgress}
        onOpenAIImport={() => setIsAIParseModalOpen(true)}
        onAddEvent={handleAddEventClick}
        onOpenExploreSuggestions={() => setIsExploreSuggestionsOpen(true)}
        onOpenPlaceSearch={() => setIsPlaceAddOpen(true)}
        onImproveLocations={handleImproveLocations}
        onOpenPanel={openPanel}
        onOpenNotifications={() => {
          openPanel('notifications');
          fetchNotifications();
        }}
        activeView={detailsTab}
        onViewChange={handleDetailsViewChange}
        showCalendarTab={!isMobileLayout}
      />

      {showMapSuggest && (
        <MapViewSuggestPrompt
          onTryMapView={() => {
            if (trip?._id) saveMapViewSuggestDismissed(trip._id);
            setShowMapSuggest(false);
            handleSetMapView(true);
          }}
          onDismiss={() => {
            if (trip?._id) saveMapViewSuggestDismissed(trip._id);
            setShowMapSuggest(false);
          }}
        />
      )}

      <div className={cn(
        'grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6',
        isMobileLayout && !showMapSuggest && '-mt-3',
      )}>
        <main className="min-w-0 space-y-3 pb-24 lg:pb-0">
          {detailsTab === 'calendar' && !isMobileLayout && (
            <TripCalendarView
              events={trip.events}
              tripStartDate={trip.startDate}
              tripEndDate={trip.endDate}
              selectedEventId={selectedEventId}
              onEventSelect={handleCalendarEventSelect}
            />
          )}

          {detailsTab === 'itinerary' && (
            <>
              <TripDayStrip
                ref={dayStripRef}
                days={dayStripItems}
                activeDayKey={activeDayKey}
                onDaySelect={handleDaySelect}
              />
              {tripTimeline}
            </>
          )}
        </main>

        <div className="hidden lg:block">
          <div className="sticky top-[calc(var(--trip-details-toolbar-height,7rem)+0.75rem)] max-h-[calc(100vh-var(--trip-details-toolbar-height,7rem)-0.75rem)]">
            {contextSignals && trip && (
              <ProactiveTripContext
                signals={contextSignals}
                onCardAction={handleProactiveCardAction}
                onDismissCard={handleDismissContextCard}
                todayAssistant={{
                  trip,
                  insights: visibleTripInsights,
                  canEdit,
                  weatherSnapshots,
                  flightStatusSnapshots,
                  todayBriefing: todayBriefing?.briefing,
                  todayBriefingGeneratedAt: todayBriefing?.generatedAt,
                  todayBriefingError,
                  isGeneratingTodayBriefing,
                  replanBriefing: replanBriefing?.briefing,
                  replanBriefingGeneratedAt: replanBriefing?.generatedAt,
                  replanBriefingError,
                  isGeneratingReplanBriefing,
                  onClose: closePanel,
                  onOpenChecklist: () => openPanel('checklist'),
                  onOpenEventDetail: handleNavigateToEventDetail,
                  onGenerateTodayBriefing: handleGenerateTodayBriefing,
                  onGenerateReplanBriefing: handleGenerateReplanBriefing,
                  onDismissInsight: handleDismissInsight,
                }}
              />
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
      )}

      <MobileTripActionsFab
        tripId={trip._id}
        canEdit={canEdit}
        addableEventTypes={addableEventTypes}
        activePanel={activePanel}
        unreadNotificationCount={unreadNotificationCount}
        isImprovingLocations={locationConfirmQueue.open}
        improveLocationsLabel={
          locationConfirmQueue.open
            ? `Reviewing ${locationConfirmQueue.queuePosition.current}/${locationConfirmQueue.queuePosition.total}`
            : undefined
        }
        highlightToday={Boolean(contextSignals?.showEmbeddedToday)}
        isMapView={showMapView}
        onOpenAIImport={() => setIsAIParseModalOpen(true)}
        onAddEvent={handleAddEventClick}
        onOpenExploreSuggestions={() => setIsExploreSuggestionsOpen(true)}
        onOpenPlaceSearch={() => setIsPlaceAddOpen(true)}
        onImproveLocations={handleImproveLocations}
        onOpenPanel={showMapView ? handleOpenPanelForMap : openPanel}
        onOpenNotifications={() => {
          if (showMapView) {
            handleOpenPanelForMap('notifications');
          } else {
            openPanel('notifications');
            fetchNotifications();
          }
        }}
        onViewChange={handleDetailsViewChange}
        onClosePanel={closePanel}
      />

      {!showMapView && (
      <TripPanelHost
        activePanel={activePanel}
        panelOptions={panelOptions}
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
        onOpenEventDetail={handleNavigateToEventDetail}
        onDismissInsight={handleDismissInsight}
        tripHealthSummary={tripHealth?.summary ?? {
          headlineScore: 100,
          logisticsScore: 100,
          contentScore: 100,
          openIssueCount: 0,
          criticalCount: 0,
          warningCount: 0,
        }}
        tripHealthIssues={tripHealth?.issues ?? []}
        isComputingTripHealth={loading}
        onExecuteHealthResolution={handleExecuteHealthResolution}
        onOpenDecision={handleOpenDecision}
        onCreateDecision={() => handleCreateDecisionClick()}
      />
      )}

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
        draftEvent={eventFormDraft}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
      />

      <EventDetailSheet
        open={Boolean(detailEvent)}
        onOpenChange={(open) => {
          if (!open) handleCloseEventDetail();
        }}
        event={detailEvent}
        thumbnail={detailEventThumbnail}
        trip={trip ?? undefined}
        currentUserId={user?._id}
        canEdit={canEdit}
        currency={detailEventContext.currency}
        weatherLabel={detailEventContext.weatherLabel}
        flightStatus={detailEventContext.flightStatus}
        outboundTransfer={detailEventContext.outboundTransfer}
        onEdit={canEdit ? handleDetailEdit : undefined}
        onDelete={canEdit ? handleDetailDelete : undefined}
        onStatusChange={canEdit ? handleDetailStatusChange : undefined}
        onVote={handleVote}
        onReviewLocation={
          canEdit && detailEvent
            ? () => {
              handleCloseEventDetail();
              locationConfirmQueue.startUnresolvedReview([detailEvent]);
            }
            : undefined
        }
      />

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {trip && (
        <PlaceAddEventDialog
          open={isPlaceAddOpen}
          onOpenChange={setIsPlaceAddOpen}
          trip={trip}
          activeDayKey={activeDayKey}
          onAdd={handleAddPlaceEvent}
        />
      )}

      {trip && (
        <ExploreSuggestionsModal
          isOpen={isExploreSuggestionsOpen}
          onClose={handleCloseExploreSuggestions}
          trip={trip}
          canEdit={canEdit}
          onAddSuggestions={handleAddExploreSuggestions}
          scopedDate={exploreScope?.date}
          scopedEndDate={exploreScope?.endDate}
          defaultKeywords={
            exploreScope?.defaultKeywords
              ? exploreScope.defaultKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
              : []
          }
        />
      )}

      {trip && (
        <>
          <CreateDecisionDialog
            open={isCreateDecisionOpen}
            onOpenChange={setIsCreateDecisionOpen}
            trip={trip}
            preselectedEventIds={createDecisionPreselectedIds}
            onCreate={handleCreateDecision}
            onExploreAlternative={canEdit ? handleExploreDecisionAlternative : undefined}
          />

          <DecisionComparisonView
            open={Boolean(activeDecisionId && activeDecision)}
            onOpenChange={(open) => !open && setActiveDecisionId(null)}
            trip={trip}
            decision={activeDecision}
            eventThumbnails={eventThumbnails}
            currentUserId={user?._id}
            canEdit={canEdit}
            onVote={handleVote}
            onOpenEventDetail={handleNavigateToEventDetail}
            onRemoveOption={handleRemoveDecisionOption}
            onDeferDecision={handleDeferDecision}
            onDeleteDecision={canEdit ? handleDeleteDecision : undefined}
            onConfirmDecision={handleConfirmDecision}
            onAddExistingOption={canEdit ? () => setIsAddDecisionOptionOpen(true) : undefined}
            onExploreNewOption={canEdit ? handleExploreNewDecisionOption : undefined}
            onGenerateComparisonOverview={handleGenerateComparisonOverview}
          />

          <AddDecisionOptionDialog
            open={isAddDecisionOptionOpen}
            onOpenChange={setIsAddDecisionOptionOpen}
            trip={trip}
            decisionTitle={activeDecision?.title}
            excludeEventIds={activeDecision?.optionEventIds}
            onAdd={handleAddDecisionOption}
          />
        </>
      )}

      {decisionActionError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg">
          {decisionActionError}
        </div>
      )}

      {trip && (
        <ReviewUnresolvedLocationsDialog
          open={isReviewUnresolvedOpen}
          onOpenChange={setIsReviewUnresolvedOpen}
          events={trip.events}
          onReviewAll={handleStartLocationReview}
          onReviewSelected={handleStartLocationReview}
        />
      )}

      <LocationConfirmDialog
        open={locationConfirmQueue.open}
        onOpenChange={() => undefined}
        event={locationConfirmQueue.currentItem?.event ?? null}
        preview={locationConfirmQueue.preview}
        loading={locationConfirmQueue.loading}
        error={locationConfirmQueue.error}
        queuePosition={locationConfirmQueue.queuePosition}
        applying={locationConfirmQueue.applying}
        onConfirm={locationConfirmQueue.handleConfirm}
        onConfirmTransport={locationConfirmQueue.handleConfirmTransport}
        onSkip={locationConfirmQueue.handleSkip}
        onRetry={locationConfirmQueue.handleRetry}
      />
    </>
    </TripReferenceNowProvider>
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
