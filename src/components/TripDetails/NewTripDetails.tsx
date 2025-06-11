import React, { useState, useEffect } from 'react';
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
import { MapIcon, X, StickyNote, MapPin, FileText, Sparkles, Plus, Wand2, Trash2, CheckSquare } from 'lucide-react';
import TripNotes from '@/components/TripNotes';
import TripChecklist from '@/components/TripDetails/TripChecklist';

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

const NewTripDetails: React.FC = () => {
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
  const [isAIParseModalOpen, setIsAIParseModalOpen] = useState(false);
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<Event[]>([]);
  const [deletingEvents, setDeletingEvents] = useState<Set<string>>(new Set());
  const [showChecklist, setShowChecklist] = useState(false);
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);
  const [addingProgress, setAddingProgress] = useState(0);

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
      const eventsToAdd = Array.isArray(parsedEvents) ? parsedEvents : [parsedEvents];
      
      // Add each event to the trip
      for (const event of eventsToAdd) {
        await handleSaveEvent(event);
      }
      
      // Close the modal and reset state
      setIsAIParseModalOpen(false);
      setParseText('');
    } catch (error) {
      console.error('Error parsing text:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse text');
    } finally {
      setIsParsing(false);
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
  const sortedEvents = [...trip.events].sort((a, b) => {
    // First compare by date
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    
    // If dates are the same, compare by time
    // Extract time parts for comparison
    const timeA = a.startDate ? a.startDate.split('T')[1] || '00:00:00' : '00:00:00';
    const timeB = b.startDate ? b.startDate.split('T')[1] || '00:00:00' : '00:00:00';
    
    return timeA.localeCompare(timeB);
  });

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
      
        <div className="mt-4 space-y-6">
          {sortedEvents.length === 0 ? (
            <p className="text-gray-500">No events added yet.</p>
          ) : (
            <div className="relative">
              <div className="space-y-6">
                {(() => {
                  // Group events by date
                  const groupedEvents = sortedEvents.reduce((groups, event) => {
                    let dateKey = '';
                    switch (event.type) {
                      case 'activity':
                        dateKey = (event as any).startDate?.split('T')[0];
                        break;
                      case 'arrival':
                      case 'departure':
                        dateKey = (event as any).date;
                        break;
                      case 'stay':
                        dateKey = (event as any).checkIn;
                        break;
                      case 'rental_car':
                        dateKey = (event as any).date;
                        break;
                      case 'bus':
                      case 'train':
                        dateKey = (event as any).startDate?.split('T')[0];
                        break;
                      default:
                        dateKey = ((event as any).startDate?.split('T')[0]) || (event as any).date || '';
                    }
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
                        {events
                          .sort((a, b) => {
                            const timeA = a.startDate ? a.startDate.split('T')[1] || '00:00:00' : '00:00:00';
                            const timeB = b.startDate ? b.startDate.split('T')[1] || '00:00:00' : '00:00:00';
                            return timeA.localeCompare(timeB);
                          })
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
      <Dialog open={isAIParseModalOpen} onOpenChange={setIsAIParseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parse Event with AI</DialogTitle>
            <DialogDescription>
              Paste your event details, reservation email, or natural language description.
              The AI will try to extract event information and create appropriate events.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              placeholder="Paste your text here..."
              value={parseText}
              onChange={(e) => setParseText(e.target.value)}
              className="min-h-[200px]"
            />
            {parseError && (
              <p className="mt-2 text-sm text-red-500">{parseError}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAIParseModalOpen(false);
                setParseText('');
                setParseError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAIParse}
              disabled={!parseText.trim() || isParsing}
            >
              {isParsing ? 'Parsing...' : 'Parse Text'}
            </Button>
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
