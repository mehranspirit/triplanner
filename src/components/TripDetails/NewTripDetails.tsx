import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripDetails } from './hooks';
// import EventCard from './EventCard'; // Placeholder
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI Button
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Assuming Shadcn UI Card
import { Event, EventType, ActivityEvent, DestinationEvent } from '@/types/eventTypes'; // Import EventType
import { EVENT_TYPES } from '@/eventTypes/registry'; // Correct import name
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { parse, format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getDefaultThumbnail } from './thumbnailHelpers';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import TripMap from '@/components/TripMap';
import { MapIcon, X, StickyNote, MapPin, FileText, Sparkles, Plus, Wand2, Trash2, CheckSquare, CalendarDays, Bell, CloudSun } from 'lucide-react';
import TripNotes from '@/components/TripNotes';
import TripChecklist from '@/components/TripDetails/TripChecklist';
import TripCommandCenter from '@/components/TripDetails/TripCommandCenter';
import InTripAssistant from '@/components/TripDetails/InTripAssistant';
import TripNotifications from '@/components/TripDetails/TripNotifications';

// Import icons
import { FaPlane, FaTrain, FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain } from 'react-icons/fa';
import { Clock, Info } from 'lucide-react';

// Import the new specific modals
import ArrivalFormModal from './EventFormModals/ArrivalFormModal';
import StayFormModal from './EventFormModals/StayFormModal';
import RentalCarFormModal from './EventFormModals/RentalCarFormModal';
import FlightFormModal from './EventFormModals/FlightFormModal';
// TODO: Import modals for other event types (Activity, Bus, Train, Destination, Departure)
import ActivityFormModal from './EventFormModals/ActivityFormModal';
import BusFormModal from './EventFormModals/BusFormModal';
import TrainFormModal from './EventFormModals/TrainFormModal';
import DestinationFormModal from './EventFormModals/DestinationFormModal';
import DepartureFormModal from './EventFormModals/DepartureFormModal';

// Import TripActions component
import TripActions from './TripActions';
import { parseEventFromText, generateDestinationSuggestions } from '@/services/aiService';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TripLoading from '@/components/ui/trip-loading';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { generateTripInsights } from '@/services/tripInsights';
import { buildParsedEventCandidates, ParsedEventCandidate } from '@/services/travelImportValidation';
import { formatEventDateTime, getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { api } from '@/services/api';
import { hashText } from '@/utils/hash';
import { NotificationPreference, TripNotification } from '@/types/notificationTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { WeatherDay, WeatherSnapshot } from '@/types/weatherTypes';
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

type ImportInboxFilter = 'open' | 'needs_review' | 'missing_info' | 'duplicate' | 'done' | 'failed';

const importInboxFilters: Array<{ id: ImportInboxFilter; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'missing_info', label: 'Missing info' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'done', label: 'Done' },
  { id: 'failed', label: 'Failed' },
];

const matchesImportInboxFilter = (travelImport: TravelImport, filter: ImportInboxFilter) => {
  if (filter === 'open') {
    return ['parsed', 'needs_review', 'missing_info', 'duplicate', 'unsupported'].includes(travelImport.status);
  }
  if (filter === 'done') {
    return ['accepted', 'partially_accepted', 'dismissed'].includes(travelImport.status);
  }
  return travelImport.status === filter;
};

const getImportStatusLabel = (status: TravelImportStatus) => {
  const labels: Record<TravelImportStatus, string> = {
    parsed: 'Needs review',
    needs_review: 'Needs review',
    missing_info: 'Missing info',
    duplicate: 'Possible duplicate',
    failed: 'Failed',
    accepted: 'Accepted',
    partially_accepted: 'Partially accepted',
    dismissed: 'Dismissed',
    unsupported: 'Unsupported',
  };
  return labels[status] || status;
};

const getImportStatusClassName = (status: TravelImportStatus) => {
  if (status === 'failed' || status === 'unsupported') return 'bg-red-100 text-red-700';
  if (status === 'missing_info' || status === 'duplicate' || status === 'partially_accepted') return 'bg-amber-100 text-amber-700';
  if (status === 'accepted') return 'bg-green-100 text-green-700';
  if (status === 'dismissed') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-700';
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

const getImportFallbackTitle = (travelImport: TravelImport) => {
  const firstEvent = travelImport.parsedEvents?.[0];
  if (firstEvent) return getEventDisplayName(firstEvent);
  if (travelImport.status === 'failed') return 'Failed import';
  return 'Pasted import';
};

const formatImportIssue = (issue: string) => (
  issue
    .replace(/^Missing required field:\s*/i, 'Missing ')
    .replace(/^Missing or invalid start time$/i, 'Missing or invalid start time')
    .replace(/^Missing or invalid end time$/i, 'Missing or invalid end time')
);

const getImportIssueSummaries = (travelImport: TravelImport, existingEvents: Event[]) => {
  const issueSet = new Set<string>();

  (travelImport.validationErrors || []).forEach((issue) => {
    if (issue.trim()) issueSet.add(formatImportIssue(issue));
  });

  if (travelImport.duplicateOfImportId) {
    issueSet.add('Same source as an earlier inbox item');
  }

  if (!['accepted', 'dismissed'].includes(travelImport.status) && travelImport.parsedEvents?.length > 0) {
    buildParsedEventCandidates(travelImport.parsedEvents, existingEvents).forEach((candidate) => {
      candidate.validation.errors.forEach((issue) => issueSet.add(formatImportIssue(issue)));
      candidate.validation.warnings.forEach((issue) => issueSet.add(formatImportIssue(issue)));
      candidate.validation.duplicateEventIds.forEach((eventId) => {
        const eventName = existingEvents.find((event) => event.id === eventId);
        issueSet.add(eventName ? `Possible duplicate of ${getEventDisplayName(eventName)}` : 'Possible duplicate of an existing event');
      });
    });
  }

  return Array.from(issueSet).slice(0, 4);
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
  const [showMap, setShowMap] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showToday, setShowToday] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [weatherSnapshots, setWeatherSnapshots] = useState<WeatherSnapshot[]>([]);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [flightStatusSnapshots, setFlightStatusSnapshots] = useState<FlightStatusSnapshot[]>([]);
  const [flightStatusError, setFlightStatusError] = useState<string | null>(null);
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
  const [showChecklist, setShowChecklist] = useState(false);
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);
  const [isImprovingLocations, setIsImprovingLocations] = useState(false);
  const [addingProgress, setAddingProgress] = useState(0);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);
  const tripInsights = useMemo(
    () => trip ? generateTripInsights({ trip, events: trip.events, weatherSnapshots, flightStatusSnapshots }) : [],
    [trip, weatherSnapshots, flightStatusSnapshots]
  );
  const visibleTripInsights = useMemo(
    () => tripInsights.filter(insight => !dismissedInsightIds.includes(insight.id)),
    [tripInsights, dismissedInsightIds]
  );
  const filteredTravelImports = useMemo(
    () => travelImports.filter(travelImport => matchesImportInboxFilter(travelImport, importInboxFilter)),
    [travelImports, importInboxFilter]
  );
  const visibleTravelImports = showAllTravelImports ? filteredTravelImports : filteredTravelImports.slice(0, 6);
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
        setShowChecklist(true);
        setShowToday(false);
        setShowNotifications(false);
        break;
      case 'expenses':
        navigate(`/trips/${trip._id}/expenses`);
        break;
      case 'today':
        setShowToday(true);
        setShowChecklist(false);
        setShowNotifications(false);
        setShowNotes(false);
        setShowMap(false);
        break;
      case 'ai_import':
        setIsAIParseModalOpen(true);
        setShowToday(false);
        setShowNotifications(false);
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
      setShowChecklist(true);
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
    } catch (error) {
      console.warn('Failed to load dismissed trip insights:', error);
      setDismissedInsightIds([]);
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
          setShowNotifications(false);
          handleEditEventClick(event);
        }
        break;
      }
      case 'checklist':
        setShowNotifications(false);
        setShowChecklist(true);
        break;
      case 'expenses':
        navigate(`/trips/${trip._id}/expenses`);
        break;
      case 'today':
        setShowNotifications(false);
        setShowToday(true);
        break;
      case 'ai_import':
        setShowNotifications(false);
        setIsAIParseModalOpen(true);
        break;
      case 'add_event':
        setShowNotifications(false);
        handleAddEventClick(notification.title.toLowerCase().includes('stay') ? 'stay' : 'rental_car');
        break;
      default:
        setShowNotifications(false);
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
    console.log('NewTripDetails handleSaveEvent called with data:', eventData);
    try {
    if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        console.log('NewTripDetails: Updating existing event:', eventData.id);
        // We are editing an existing event
        const eventToUpdate = { ...editingEvent, ...eventData } as Event;
        console.log('NewTripDetails: Combined event data for update:', eventToUpdate);
        const updatedEvent = await updateEvent(eventToUpdate);
        console.log('NewTripDetails: Event updated successfully, result:', updatedEvent);
        
        // Update the local state immediately
        if (trip && updatedEvent) {
          const updatedEvents = trip.events.map(event => 
            event.id === updatedEvent.id ? updatedEvent : event
          );
          trip.events = updatedEvents;
          console.log('NewTripDetails: Local state updated with updated event:', updatedEvent.id);
        }
    } else {
        console.log('NewTripDetails: Adding new event of type:', eventData.type);
        // We are adding a new event
        const newEvent = await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);
        console.log('NewTripDetails: New event added successfully, result:', newEvent);
        
        // Update the local state immediately
        if (trip && newEvent) {
          trip.events = [...trip.events, newEvent];
          console.log('NewTripDetails: Local state updated with new event:', newEvent.id);
        }
      }
      
      // Close the modal
      console.log('NewTripDetails: Closing modal after successful save');
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
      const parsedEvents = await parseEventFromText({
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

      const suggestions = await generateDestinationSuggestions(
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

  // Sort events by startDate, earliest first
  const sortedEvents = sortEventsByStart(trip.events);

  const getTimelineDateKey = (event: Event) => {
    const start = getEventStart(event);
    if (!start) return '';

    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tripDateRange = (() => {
    const start = trip.startDate ? new Date(trip.startDate) : null;
    const end = trip.endDate ? new Date(trip.endDate) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  })();

  const outOfRangeEvents = tripDateRange
    ? sortedEvents.filter((event) => {
        const start = getEventStart(event);
        return !!start && (start < tripDateRange.start || start > tripDateRange.end);
      })
    : [];

  const getEventWeatherSnapshots = (eventId: string) => {
    return weatherSnapshots.filter(snapshot => (
      (snapshot.originalEventId || snapshot.eventId) === eventId && snapshot.daily?.length > 0
    ));
  };

  const formatWeatherForecast = (forecast: WeatherDay) => {
    const parts = [
      forecast.condition,
      typeof forecast.temperatureMax === 'number' && typeof forecast.temperatureMin === 'number'
        ? `${Math.round(forecast.temperatureMax)}/${Math.round(forecast.temperatureMin)} deg F`
        : null,
      typeof forecast.precipitationProbabilityMax === 'number'
        ? `${forecast.precipitationProbabilityMax}% rain`
        : null,
      typeof forecast.windSpeedMax === 'number' && forecast.windSpeedMax >= 15
        ? `${Math.round(forecast.windSpeedMax)} mph wind`
        : null,
    ].filter(Boolean);

    return parts.join(', ');
  };

  const EventWeatherForecast: React.FC<{ event: Event }> = ({ event }) => {
    const snapshots = getEventWeatherSnapshots(event.id);
    if (snapshots.length === 0) return null;

    return (
      <div className="mt-2 space-y-1 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        {snapshots.map((snapshot) => {
          const forecast = snapshot.daily?.[0];
          if (!forecast) return null;
          const label = snapshot.locationRole === 'departure'
            ? 'Departure weather'
            : snapshot.locationRole === 'arrival'
              ? 'Arrival weather'
              : 'Weather forecast';

          return (
            <div key={snapshot._id || `${snapshot.eventId}-${snapshot.date}`} className="flex items-center gap-2">
        <CloudSun className="h-4 w-4 flex-shrink-0 text-sky-600" />
        <span>
                <span className="font-medium">{label}:</span> {formatWeatherForecast(forecast)}
        </span>
            </div>
          );
        })}
      </div>
    );
  };

  const FlightStatusSummary: React.FC<{ event: Event }> = ({ event }) => {
    if (event.type !== 'flight') return null;

    const snapshot = flightStatusSnapshots.find(status => status.eventId === event.id);
    if (!snapshot) return null;

    const departureParts = [
      snapshot.departure?.terminal ? `Terminal ${snapshot.departure.terminal}` : null,
      snapshot.departure?.gate ? `Gate ${snapshot.departure.gate}` : null,
      typeof snapshot.departure?.delayMinutes === 'number' && snapshot.departure.delayMinutes > 0
        ? `${snapshot.departure.delayMinutes} min delay`
        : null,
    ].filter(Boolean);
    const arrivalDelay = typeof snapshot.arrival?.delayMinutes === 'number' && snapshot.arrival.delayMinutes > 0
      ? `Arrival ${snapshot.arrival.delayMinutes} min delay`
      : null;

    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-900">
        <FaPlane className="h-4 w-4 flex-shrink-0 text-violet-600" />
        <span>
          <span className="font-medium">Flight status:</span> {[snapshot.status, ...departureParts, arrivalDelay].filter(Boolean).join(' | ')}
        </span>
      </div>
    );
  };

  // Update the CondensedEventCard component to include icons
  const CondensedEventCard: React.FC<{ event: Event; thumbnail: string }> = ({ event, thumbnail }) => {
    const registryItem = EVENT_TYPES[event.type];
    if (!registryItem) return null;

    const isDeleting = deletingEvents.has(event.id);
    const isExploring = event.status === 'exploring';
    const isActive = isEventCurrentlyActive(event);

    const getEventIcon = () => {
      switch (event.type) {
        case 'flight':
          return <FaPlane className="w-5 h-5 text-blue-500" />;
        case 'arrival':
          return <FaPlane className="w-5 h-5 text-green-500 transform rotate-45" />;
        case 'departure':
          return <FaPlane className="w-5 h-5 text-red-500 transform -rotate-45" />;
        case 'train':
          return <FaTrain className="w-5 h-5 text-green-500" />;
        case 'bus':
          return <FaBus className="w-5 h-5 text-purple-500" />;
        case 'rental_car':
          return <FaCar className="w-5 h-5 text-red-500" />;
        case 'stay':
          return <FaHotel className="w-5 h-5 text-yellow-500" />;
        case 'destination':
          return <FaMapMarkerAlt className="w-5 h-5 text-pink-500" />;
        case 'activity':
          return <FaMountain className="w-5 h-5 text-indigo-500" />;
        default:
          return <FaMapMarkerAlt className="w-5 h-5 text-gray-500" />;
      }
    };

    const formatDate = (dateStr: string | undefined, timeStr?: string) => {
      if (!dateStr) return '';
      try {
        // Handle both ISO and simple YYYY-MM-DD formats
        const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [year, month, day] = datePart.split('-').map(Number);
        
        // Validate date parts
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          console.warn('Invalid date parts:', { year, month, day, dateStr });
          return dateStr;
        }

        // Create date with time set to noon to avoid timezone issues
        const date = new Date(year, month - 1, day, 12);
        
        // Validate the date
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', dateStr);
          return dateStr;
        }

        const formattedDate = format(date, 'MMM d');
        return timeStr ? `${formattedDate} ${timeStr}` : formattedDate;
      } catch (error) {
        console.warn('Error formatting date:', error, dateStr);
        return dateStr;
      }
    };

    const getTimeInfo = () => {
      switch (event.type) {
        case 'stay':
          const stayEvent = event as any;
          return (
            <>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Check-in: {formatDate(stayEvent.checkIn, stayEvent.checkInTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Check-out: {formatDate(stayEvent.checkOut, stayEvent.checkOutTime)}</span>
              </div>
            </>
          );
        case 'rental_car':
          const carEvent = event as any;
          return (
            <>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Pickup: {formatDate(carEvent.date, carEvent.pickupTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Dropoff: {formatDate(carEvent.dropoffDate, carEvent.dropoffTime)}</span>
              </div>
            </>
          );
        case 'destination':
          const destEvent = event as any;
          return (
            <>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Start: {formatDate(destEvent.startDate, destEvent.startTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>End: {formatDate(destEvent.endDate, destEvent.endTime)}</span>
              </div>
            </>
          );
        case 'activity':
          const activityEvent = event as any;
          return (
            <>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Start: {formatDate(activityEvent.startDate, activityEvent.startTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>End: {formatDate(activityEvent.endDate, activityEvent.endTime)}</span>
              </div>
            </>
          );
        case 'flight':
        case 'train':
        case 'bus':
          const transportEvent = event as any;
          const startTime = event.startDate?.split('T')[1]?.substring(0, 5) || transportEvent.departureTime;
          const endTime = event.endDate?.split('T')[1]?.substring(0, 5) || transportEvent.arrivalTime;
          return (
            <>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Departure: {formatDate(event.startDate?.split('T')[0], startTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Arrival: {formatDate(event.endDate?.split('T')[0], endTime)}</span>
              </div>
            </>
          );
        case 'arrival':
        case 'departure':
          const airportEvent = event as any;
          return (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Time: {formatDate(airportEvent.date, airportEvent.time)}</span>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div className={cn(
        "flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-all duration-200 relative",
        event.status === 'exploring' && "bg-white border-2 border-gray-300 border-dashed",
        isDeleting && "animate-fade-out opacity-0",
        isActive && !isExploring && "bg-gradient-to-r from-white to-gray-50"
      )}>
        {isActive && !isExploring && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-blue-500 to-transparent animate-pulse" />
        )}
        <div className="w-16 h-16 flex-shrink-0 relative">
          <img 
            src={thumbnail} 
            alt={event.type} 
            className={cn(
              "w-full h-full object-cover rounded-md transition-all duration-200",
              event.status === 'exploring' && "grayscale opacity-70"
            )}
          />
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br rounded-md transition-all duration-200",
            event.status === 'exploring' 
              ? "from-gray-500/5 to-gray-700/30" 
              : "from-gray-500/10 to-gray-900/50"
          )}></div>
          <div className={cn(
            "absolute -bottom-2 -right-2 rounded-full p-2 transition-all duration-200",
            event.status === 'exploring'
              ? "bg-white border border-gray-200 shadow-sm"
              : isActive 
                ? "bg-white shadow-lg ring-2 ring-blue-500 ring-opacity-50"
                : "bg-white shadow-md"
          )}>
            <div className={cn(
              "transition-all duration-200",
              event.status === 'exploring' && "filter saturate-150",
              isActive && !isExploring && "scale-110"
            )}>
              {getEventIcon()}
            </div>
          </div>
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={cn(
              "text-sm font-medium line-clamp-1 transition-all duration-200",
              event.status === 'exploring' && "text-gray-600"
            )}>
              {(() => {
                switch (event.type) {
                  case 'activity':
                    return (event as any).title;
                  case 'destination':
                    return (event as any).placeName;
                  case 'stay':
                    return (event as any).accommodationName;
                  case 'flight':
                    return `${(event as any).airline || 'Flight'} ${(event as any).flightNumber || ''}`;
                  case 'train':
                    return `${(event as any).trainOperator || 'Train'} ${(event as any).trainNumber || ''}`;
                  case 'bus':
                    return `${(event as any).busOperator || 'Bus'} ${(event as any).busNumber || ''}`;
                  case 'rental_car':
                    return `${(event as any).carCompany || 'Rental Car'}`;
                  case 'arrival':
                    return `Arrival at ${(event as any).airport}`;
                  case 'departure':
                    return `Departure from ${(event as any).airport}`;
                  default:
                    return event.type;
                }
              })()}
            </h3>
            {(() => {
              switch (event.type) {
                case 'stay':
                  return (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      isActive && !isExploring ? "bg-yellow-200 text-yellow-900" : "bg-yellow-100 text-yellow-800"
                    )}>
                      {formatDate((event as any).checkIn)} - {formatDate((event as any).checkOut)}
                    </span>
                  );
                case 'activity':
                  return (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      isActive && !isExploring ? "bg-indigo-200 text-indigo-900" : "bg-indigo-100 text-indigo-800"
                    )}>
                      {formatDate((event as any).startDate)} - {formatDate((event as any).endDate)}
                    </span>
                  );
                case 'rental_car':
                  return (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      isActive && !isExploring ? "bg-red-200 text-red-900" : "bg-red-100 text-red-800"
                    )}>
                      {formatDate((event as any).date)} - {formatDate((event as any).dropoffDate)}
                    </span>
                  );
                case 'destination':
                  return (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      isActive && !isExploring ? "bg-pink-200 text-pink-900" : "bg-pink-100 text-pink-800"
                    )}>
                      {formatDate((event as any).startDate)} - {formatDate((event as any).endDate)}
                    </span>
                  );
                case 'flight':
                case 'train':
                case 'bus':
                  const startDate = event.startDate?.split('T')[0];
                  const endDate = event.endDate?.split('T')[0];
                  if (startDate && endDate && startDate !== endDate) {
                    return (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        event.type === 'flight' && (isActive && !isExploring ? "bg-blue-200 text-blue-900" : "bg-blue-100 text-blue-800"),
                        event.type === 'train' && (isActive && !isExploring ? "bg-green-200 text-green-900" : "bg-green-100 text-green-800"),
                        event.type === 'bus' && (isActive && !isExploring ? "bg-purple-200 text-purple-900" : "bg-purple-100 text-purple-800")
                      )}>
                        {formatDate(startDate)} - {formatDate(endDate)}
                      </span>
                    );
                  }
                  return null;
                default:
                  return null;
              }
            })()}
          </div>
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            {getTimeInfo()}
            {event.location?.quality && event.location.quality !== 'exact' && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>
                  Location {event.location.quality}
                  {event.location.source ? ` via ${event.location.source}` : ''}
                </span>
              </div>
            )}
            {(() => {
              switch (event.type) {
                case 'stay':
                  return (event as any).reservationNumber && (
                    <div className="flex items-center space-x-1">
                      <Info className="w-3 h-3" />
                      <span>Reservation: {(event as any).reservationNumber}</span>
                    </div>
                  );
                case 'rental_car':
                  return (event as any).bookingReference && (
                    <div className="flex items-center space-x-1">
                      <Info className="w-3 h-3" />
                      <span>Booking: {(event as any).bookingReference}</span>
                    </div>
                  );
                case 'destination':
                  return (event as any).address && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{(event as any).address}</span>
                    </div>
                  );
                default:
                  return null;
              }
            })()}
          </div>
        </div>
      </div>
    );
  };



  // Define which event types can be added from the dropdown
  // Adjust this array as needed
  const addableEventTypes: EventType[] = [
    'arrival', 'departure', 'stay', 'flight', 'train', 'bus', 'rental_car', 'activity', 'destination'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6 py-6">
      {/* Header with Trip Info and Actions */}
      <div className="relative">
        {/* Background Image with Overlay */}
        <div className="w-full h-[200px] md:h-[250px] relative rounded-lg overflow-hidden">
          <img
            src={trip.thumbnailUrl || tripThumbnail}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
          
          {/* Trip Actions */}
          <div className="absolute top-4 right-4 z-20">
            <TripActions
              trip={trip}
              isOwner={isOwner}
              canEdit={canEdit}
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
          </div>
          
          {/* Trip Title */}
          <div className="absolute bottom-6 left-6 right-6 text-white z-5">
            <div className="flex flex-col">
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-white drop-shadow-lg">{trip.name}</h1>
                {trip.description && (
                  <p 
                    className="mt-2 text-lg text-white/90 drop-shadow-md"
                    dangerouslySetInnerHTML={{ __html: processText(trip.description) }}
                  />
                )}
              </div>
              <div className="flex justify-end">
                <CollaboratorAvatars
                  owner={trip.owner}
                  collaborators={trip.collaborators.filter((c): c is { user: typeof trip.owner; role: 'viewer' | 'editor' } => 
                    typeof c === 'object' && c !== null && 'user' in c && 'role' in c
                  )}
                  currentUserId={user?._id}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <TripCommandCenter
        trip={trip}
        insights={visibleTripInsights}
        canEdit={canEdit}
        onOpenAIImport={() => setIsAIParseModalOpen(true)}
        onOpenChecklist={() => setShowChecklist(true)}
        onOpenExpenses={() => navigate(`/trips/${trip._id}/expenses`)}
        onAddEvent={(eventType = 'stay') => handleAddEventClick(eventType)}
        onEditEvent={(eventId) => {
          const event = trip.events.find(tripEvent => tripEvent.id === eventId);
          if (event) {
            handleEditEventClick(event);
          }
        }}
        onDismissInsight={handleDismissInsight}
        dismissedInsightCount={dismissedInsightIds.length}
        onRestoreDismissedInsights={handleRestoreDismissedInsights}
        assistantBriefing={assistantBriefing?.briefing}
        assistantBriefingGeneratedAt={assistantBriefing?.generatedAt}
        isGeneratingAssistantBriefing={isGeneratingAssistantBriefing}
        assistantBriefingError={assistantBriefingError}
        onGenerateAssistantBriefing={handleGenerateAssistantBriefing}
        onAssistantAction={handleAssistantAction}
        onAcceptAssistantChecklistItem={handleAcceptAssistantChecklistItem}
        onDismissAssistantChecklistItem={handleDismissAssistantChecklistItem}
        getAssistantChecklistItemId={getAssistantChecklistItemId}
        handledAssistantChecklistItemIds={handledAssistantChecklistItemIds}
        tripQuestionAnswer={tripQuestionAnswer}
        isAskingTripQuestion={isAskingTripQuestion}
        tripQuestionError={tripQuestionError}
        onAskTripQuestion={handleAskTripQuestion}
      />
      {weatherError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Weather context is unavailable right now: {weatherError}
        </div>
      )}
      {flightStatusError && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          Flight status context is unavailable right now: {flightStatusError}
        </div>
      )}
      
      {/* Add Event & View Options */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Add New Event</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsAIParseModalOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                  Parse with AI
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Plus className="mr-2 h-4 w-4" />
                    Manual Entry
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {addableEventTypes.map(type => {
                      const eventType = EVENT_TYPES[type];
                      if (!eventType) return null;
                      return (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleAddEventClick(type)}
                        >
                          {type === 'flight' && <FaPlane className="mr-2 h-4 w-4 text-blue-500" />}
                          {type === 'arrival' && <FaPlane className="mr-2 h-4 w-4 text-green-500 transform rotate-45" />}
                          {type === 'departure' && <FaPlane className="mr-2 h-4 w-4 text-red-500 transform -rotate-45" />}
                          {type === 'train' && <FaTrain className="mr-2 h-4 w-4 text-green-500" />}
                          {type === 'bus' && <FaBus className="mr-2 h-4 w-4 text-purple-500" />}
                          {type === 'rental_car' && <FaCar className="mr-2 h-4 w-4 text-red-500" />}
                          {type === 'stay' && <FaHotel className="mr-2 h-4 w-4 text-yellow-500" />}
                          {type === 'destination' && <FaMapMarkerAlt className="mr-2 h-4 w-4 text-pink-500" />}
                          {type === 'activity' && <FaMountain className="mr-2 h-4 w-4 text-indigo-500" />}
                          {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {canEdit && (
            <Button
              variant="outline"
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
            >
              <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
              {isGeneratingSuggestions ? 'Generating...' : 'AI Suggestions'}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              onClick={handleImproveLocations}
              disabled={isImprovingLocations}
            >
              <MapPin className="mr-2 h-4 w-4 text-green-500" />
              {isImprovingLocations ? 'Improving...' : 'Improve locations'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setShowToday(true);
              setShowNotifications(false);
              setShowChecklist(false);
              setShowNotes(false);
              setShowMap(false);
            }}
          >
            <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowNotifications(true);
              setShowToday(false);
              setShowChecklist(false);
              setShowNotes(false);
              setShowMap(false);
              fetchNotifications();
            }}
          >
            <Bell className="mr-2 h-4 w-4 text-amber-500" />
            Notifications
            {unreadNotificationCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                {unreadNotificationCount}
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="condensed-view" className="cursor-pointer">Condensed View</Label>
          <Switch
            id="condensed-view"
            checked={isCondensedView}
            onCheckedChange={setIsCondensedView}
          />
        </div>
      </div>



      {/* Events Timeline */}
      <div className="bg-white shadow-sm rounded-lg p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4">Trip Timeline</h2>
        {outOfRangeEvents.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">Some events are outside this trip&apos;s dates</p>
            <p className="mt-1">
              {outOfRangeEvents.map(getEventDisplayName).join(', ')} {outOfRangeEvents.length === 1 ? 'has' : 'have'} dates that do not match the trip range. Edit the event date to fix the timeline order.
            </p>
          </div>
        )}
      
        <div className="mt-4 space-y-6">
          {sortedEvents.length === 0 ? (
            <p className="text-gray-500">No events added yet.</p>
          ) : (
            <div className="relative">
              <div className="space-y-6">
                {(() => {
                  // Group events by date
                  const groupedEvents = sortedEvents.reduce((groups, event) => {
                    const dateKey = getTimelineDateKey(event);
                    if (!dateKey) {
                      console.warn(`No valid date found for event of type ${event.type}`, event);
                      return groups;
                    }
                    if (!groups[dateKey]) {
                      groups[dateKey] = [];
                    }
                    groups[dateKey].push(event);
                    return groups;
                  }, {} as Record<string, typeof sortedEvents>);

                  return Object.entries(groupedEvents).map(([dateKey, events]) => (
                    <div key={dateKey} className="relative">
                      <div className="sticky top-0 bg-white z-50 py-2 mb-4">
                        <div className="inline-block px-4 py-2 bg-gray-100 rounded-full text-sm font-semibold text-gray-800 shadow-sm border border-gray-200">
                          {(() => {
                            try {
                              // Handle both ISO and simple YYYY-MM-DD formats
                              const datePart = dateKey.includes('T') ? dateKey.split('T')[0] : dateKey;
                              const [year, month, day] = datePart.split('-').map(Number);
                              
                              // Validate date parts
                              if (isNaN(year) || isNaN(month) || isNaN(day)) {
                                console.warn('Invalid date parts:', { year, month, day, dateKey });
                                return dateKey;
                              }

                              // Create date with time set to noon to avoid timezone issues
                              const date = new Date(year, month - 1, day, 12);
                              
                              // Validate the date
                              if (isNaN(date.getTime())) {
                                console.warn('Invalid date:', dateKey);
                                return dateKey;
                              }

                              return format(date, 'EEEE, MMMM d, yyyy');
                            } catch (error) {
                              console.warn('Error formatting date:', error, dateKey);
                              return dateKey;
                            }
                          })()}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {sortEventsByStart(events)
                          .map((event) => {
                            const registryItem = EVENT_TYPES[event.type];
                            if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
                            
                            const EventCardComponent = registryItem.cardComponent;
                            const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail;

                            if (!EventCardComponent) return <div key={event.id}>No card component for {event.type}</div>;

                            const isDeleting = deletingEvents.has(event.id);

                            return (
                              <div 
                                key={event.id} 
                                className={cn(
                                  "relative transition-all duration-300",
                                  isDeleting && "animate-fade-out opacity-0"
                                )}
                              >
                                {isCondensedView ? (
                                  <CondensedEventCard event={event} thumbnail={thumbnail} />
                                ) : (
                                  <EventCardComponent 
                                    event={event} 
                                    thumbnail={thumbnail}
                                    onEdit={canEdit ? () => handleEditEventClick(event) : undefined}
                                    onDelete={canEdit ? () => handleDeleteEvent(event.id) : undefined}
                                    onStatusChange={canEdit ? (newStatus) => handleStatusChange(event, newStatus) : undefined}
                                  />
                                )}
                                <FlightStatusSummary event={event} />
                                <EventWeatherForecast event={event} />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-[318px] right-6 z-[150] rounded-full shadow-lg transition-all duration-200 w-14 h-14",
          showNotifications ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) {
            setShowToday(false);
            setShowChecklist(false);
            setShowNotes(false);
            setShowMap(false);
            fetchNotifications();
          }
        }}
      >
        {showNotifications ? (
          <X className="h-8 w-8" />
        ) : (
          <div className="relative">
            <Bell className="h-8 w-8 text-amber-500" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-amber-500 px-1 text-xs text-white">
                {unreadNotificationCount}
              </span>
            )}
          </div>
        )}
      </Button>

      {/* Today Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-[244px] right-6 z-[150] rounded-full shadow-lg transition-all duration-200 w-14 h-14",
          showToday ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => {
          setShowToday(!showToday);
          if (!showToday) {
            setShowNotifications(false);
            setShowChecklist(false);
            setShowNotes(false);
            setShowMap(false);
          }
        }}
      >
        {showToday ? (
          <X className="h-8 w-8" />
        ) : (
          <CalendarDays className="h-8 w-8 text-blue-500" />
        )}
      </Button>

      {/* Checklist Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-[170px] right-6 z-[150] rounded-full shadow-lg transition-all duration-200 w-14 h-14",
          showChecklist ? "bg-green-500 text-white hover:bg-green-600" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => {
          setShowChecklist(!showChecklist);
          if (!showChecklist) {
            setShowNotifications(false);
            setShowToday(false);
            setShowNotes(false);
            setShowMap(false);
          }
        }}
      >
        {showChecklist ? (
          <X className="h-8 w-8" />
        ) : (
          <CheckSquare className="h-8 w-8 text-green-500" />
        )}
      </Button>

      {/* Notes Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-24 right-6 z-[150] rounded-full shadow-lg transition-all duration-200 w-14 h-14",
          showNotes ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => {
          setShowNotes(!showNotes);
          if (!showNotes) {
            setShowNotifications(false);
            setShowToday(false);
            setShowChecklist(false);
            setShowMap(false);
          }
        }}
      >
        {showNotes ? (
          <X className="h-8 w-8" />
        ) : (
          <FileText className="h-8 w-8 text-purple-500" />
        )}
      </Button>

      {/* Map Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 z-[150] rounded-full shadow-lg transition-all duration-200 w-14 h-14",
          showMap ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => {
          setShowMap(!showMap);
          if (!showMap) {
            setShowNotifications(false);
            setShowToday(false);
            setShowChecklist(false);
            setShowNotes(false);
          }
        }}
      >
        {showMap ? (
          <X className="h-8 w-8" />
        ) : (
          <MapPin className="h-8 w-8 text-blue-500" />
        )}
      </Button>

      {/* Trip Notifications */}
      {showNotifications && (
        <div className={cn(
          "fixed z-[140] rounded-t-lg shadow-xl overflow-hidden border",
          "bottom-0 inset-x-0 h-[85vh]",
          "md:w-[440px] md:h-[640px] md:bottom-6 md:right-6 md:left-auto md:rounded-lg",
          "bg-white border-gray-200"
        )}>
          <TripNotifications
            notifications={notifications}
            preferences={notificationPreferences}
            loading={isLoadingNotifications}
            error={notificationError}
            onClose={() => setShowNotifications(false)}
            onRefresh={() => fetchNotifications()}
            onMarkRead={(notification) => handleUpdateNotification(notification, { read: true })}
            onDismiss={(notification) => handleUpdateNotification(notification, { dismissed: true })}
            onAction={handleNotificationAction}
            onUpdatePreferences={handleUpdateNotificationPreferences}
          />
        </div>
      )}

      {/* Today Assistant */}
      {showToday && (
        <div className={cn(
          "fixed z-[140] rounded-t-lg shadow-xl overflow-hidden border",
          "bottom-0 inset-x-0 h-[85vh]",
          "md:w-[440px] md:h-[640px] md:bottom-6 md:right-6 md:left-auto md:rounded-lg",
          "bg-white border-gray-200"
        )}>
          <InTripAssistant
            trip={trip}
            insights={visibleTripInsights}
            canEdit={canEdit}
            weatherSnapshots={weatherSnapshots}
            flightStatusSnapshots={flightStatusSnapshots}
            todayBriefing={todayBriefing?.briefing}
            todayBriefingGeneratedAt={todayBriefing?.generatedAt}
            todayBriefingError={todayBriefingError}
            isGeneratingTodayBriefing={isGeneratingTodayBriefing}
            onGenerateTodayBriefing={handleGenerateTodayBriefing}
            replanBriefing={replanBriefing?.briefing}
            replanBriefingGeneratedAt={replanBriefing?.generatedAt}
            replanBriefingError={replanBriefingError}
            isGeneratingReplanBriefing={isGeneratingReplanBriefing}
            onGenerateReplanBriefing={handleGenerateReplanBriefing}
            onClose={() => setShowToday(false)}
            onOpenChecklist={() => {
              setShowToday(false);
              setShowChecklist(true);
            }}
            onEditEvent={(event) => {
              setShowToday(false);
              handleEditEventClick(event);
            }}
          />
        </div>
      )}

      {/* Trip Checklist */}
      {showChecklist && (
        <div className={cn(
          "fixed z-[140] rounded-t-lg shadow-xl overflow-hidden border",
          "bottom-0 inset-x-0 h-[85vh]",
          "md:w-[400px] md:h-[600px] md:bottom-6 md:right-6 md:left-auto md:rounded-lg",
          "bg-white border-gray-200"
        )}>
          <TripChecklist 
            tripId={trip._id} 
            trip={trip}
            canEdit={canEdit} 
            onClose={() => setShowChecklist(false)}
          />
        </div>
      )}

      {/* Trip Notes */}
      {showNotes && (
        <div className={cn(
          "fixed z-[140] rounded-t-lg shadow-xl overflow-hidden border",
          "bottom-0 inset-x-0 h-[85vh]",
          "md:w-[400px] md:h-[600px] md:bottom-24 md:right-6 md:left-auto md:rounded-lg",
          "bg-white border-gray-200"
        )}>
          <TripNotes 
            tripId={trip._id} 
            canEdit={canEdit}
            onClose={() => setShowNotes(false)}
          />
        </div>
      )}

      {/* Trip Map */}
      {showMap && (
        <div className={cn(
          "fixed z-[140] rounded-t-lg shadow-xl overflow-hidden border",
          "bottom-0 inset-x-0 h-[85vh]",
          "md:w-[400px] md:h-[600px] md:bottom-40 md:right-6 md:left-auto md:rounded-lg",
          "bg-white border-gray-200"
        )}>
          <TripMap trip={trip} />
        </div>
      )}

      {/* AI Parse Modal */}
      <Dialog
        open={isAIParseModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAIParseModalOpen(true);
          } else {
            resetAIParseModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import booking details</DialogTitle>
            <DialogDescription>
              Paste your event details, reservation email, or natural language description.
              The AI will extract event candidates for you to review before anything is saved.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Import Inbox</h3>
                  <p className="text-sm text-gray-500">
                    Recent parsed inputs stay here until accepted, dismissed, or reviewed again.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTravelImports} disabled={isLoadingTravelImports}>
                  {isLoadingTravelImports ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
              {travelImportError && (
                <p className="mt-2 text-sm text-red-600">{travelImportError}</p>
              )}
              {travelImports.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {importInboxFilters.map((filter) => {
                    const count = travelImports.filter(travelImport => matchesImportInboxFilter(travelImport, filter.id)).length;
                    return (
                      <Button
                        key={filter.id}
                        type="button"
                        variant={importInboxFilter === filter.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setImportInboxFilter(filter.id);
                          setShowAllTravelImports(false);
                        }}
                      >
                        {filter.label}
                        <span className="ml-1 opacity-75">{count}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {travelImports.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                    No imports yet. Paste booking text below to create the first inbox item.
                  </p>
                ) : filteredTravelImports.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                    No imports match this filter.
                  </p>
                ) : (
                  visibleTravelImports.map((travelImport) => {
                    const parsedCount = travelImport.parsedEvents?.length || 0;
                    const canReview = parsedCount > 0 && !['accepted', 'dismissed', 'failed', 'unsupported'].includes(travelImport.status);
                    const sourceTitle = travelImport.sourceTitle || getImportFallbackTitle(travelImport);
                    const issueSummaries = getImportIssueSummaries(travelImport, trip.events);
                    return (
                      <div key={travelImport._id} className="rounded-md border border-gray-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getImportStatusClassName(travelImport.status)}`}>
                                {getImportStatusLabel(travelImport.status)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(travelImport.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-2 truncate text-sm font-medium text-gray-900">
                              {sourceTitle}
                            </p>
                            {travelImport.sourceExcerpt && (
                              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                                {travelImport.sourceExcerpt}
                              </p>
                            )}
                            <p className="mt-2 text-sm text-gray-700">
                              {parsedCount > 0
                                ? `${parsedCount} extracted event${parsedCount === 1 ? '' : 's'}`
                                : travelImport.status === 'failed'
                                  ? 'Could not parse this input'
                                  : 'No event candidates extracted'}
                            </p>
                            {issueSummaries.length > 0 && (
                              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                                <p className="text-xs font-medium text-amber-800">Needs attention</p>
                                <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                                  {issueSummaries.map((issue) => (
                                    <li key={issue}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canReview && (
                              <Button variant="outline" size="sm" onClick={() => handleReviewTravelImport(travelImport)}>
                                Review
                              </Button>
                            )}
                            {!['accepted', 'dismissed'].includes(travelImport.status) && (
                              <Button variant="ghost" size="sm" onClick={() => handleDismissTravelImport(travelImport)}>
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {filteredTravelImports.length > 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => setShowAllTravelImports(prev => !prev)}
                >
                  {showAllTravelImports
                    ? 'Show less'
                    : `Show all ${filteredTravelImports.length} imports`}
                </Button>
              )}
            </div>

            <Textarea
              placeholder="Paste your text here..."
              value={parseText}
              onChange={(e) => {
                setParseText(e.target.value);
                setParsedCandidates([]);
              }}
              className="min-h-[200px]"
              disabled={isParsing || isAddingParsedEvents}
            />
            {parseError && (
              <p className="mt-2 text-sm text-red-500">{parseError}</p>
            )}
            {parseWarning && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                {parseWarning}
              </p>
            )}

            {parsedCandidates.length > 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Review extracted events</h3>
                  <p className="text-sm text-gray-500">
                    Select the valid events you want to add. Candidates with errors must be fixed manually before they can be saved.
                  </p>
                </div>
                {parsedCandidates.map((candidate, index) => {
                  const start = getEventStart(candidate.event);
                  const hasIssues = candidate.validation.errors.length > 0 || candidate.validation.warnings.length > 0;

                  return (
                    <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={candidate.selected}
                          disabled={!candidate.validation.valid || isAddingParsedEvents}
                          onChange={(event) => {
                            const nextCandidates = [...parsedCandidates];
                            nextCandidates[index] = {
                              ...candidate,
                              selected: event.target.checked,
                            };
                            setParsedCandidates(nextCandidates);
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium text-gray-900">{getEventDisplayName(candidate.event)}</h4>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {candidate.event.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{formatEventDateTime(start)}</p>

                          {hasIssues && (
                            <div className="mt-3 space-y-1 text-sm">
                              {candidate.validation.errors.map((error) => (
                                <p key={error} className="text-red-600">Error: {error}</p>
                              ))}
                              {candidate.validation.warnings.map((warning) => (
                                <p key={warning} className="text-amber-600">Warning: {warning}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetAIParseModal}
              disabled={isParsing || isAddingParsedEvents}
            >
              Cancel
            </Button>
            {parsedCandidates.length === 0 ? (
              <Button
                onClick={handleAIParse}
                disabled={!parseText.trim() || isParsing}
              >
                {isParsing ? 'Parsing...' : 'Parse Text'}
              </Button>
            ) : (
              <Button
                onClick={handleAddParsedCandidates}
                disabled={
                  isAddingParsedEvents ||
                  !parsedCandidates.some(candidate => candidate.selected && candidate.validation.valid)
                }
              >
                {isAddingParsedEvents ? 'Adding...' : 'Add Selected Events'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Render Specific EventFormModals conditionally */}
      {modalType === 'arrival' && (
          <ArrivalFormModal 
              isOpen={!!modalType} // Open if modalType is set
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed, or ensure type match
          />
      )}
       {modalType === 'stay' && (
          <StayFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
      {modalType === 'rental_car' && (
          <RentalCarFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
       {modalType === 'flight' && (
          <FlightFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
      {/* TODO: Add conditional rendering for other modal types */}
      {modalType === 'activity' && (
          <ActivityFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
      {modalType === 'bus' && (
          <BusFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'train' && (
          <TrainFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'destination' && (
          <DestinationFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'departure' && (
          <DepartureFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}

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
