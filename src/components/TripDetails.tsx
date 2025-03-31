import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Trip, 
  Event, 
  EventType, 
  ArrivalDepartureEvent, 
  StayEvent, 
  DestinationEvent, 
  EventFormData,
  User,
  FlightEvent,
  TrainEvent,
  RentalCarEvent,
  BusEvent
} from '@/types/eventTypes';
import { v4 as uuidv4 } from 'uuid';
import '../styles/TripDetails.css';
import CollaboratorModal from './CollaboratorModal';
import ShareModal from './ShareModal';
import TripMap from './TripMap';
import Avatar from './Avatar';
import EventForm from './EventForm';

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

const DEFAULT_THUMBNAILS = {
  arrival: 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300',
  departure: 'https://images.pexels.com/photos/723240/pexels-photo-723240.jpeg?auto=compress&cs=tinysrgb&w=300',
  stay: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=300',
  destination: 'https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=300',
  flight: 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300',
  train: 'https://images.pexels.com/photos/302428/pexels-photo-302428.jpeg?auto=compress&cs=tinysrgb&w=300',
  rental_car: 'https://images.pexels.com/photos/30292047/pexels-photo-30292047.jpeg?auto=compress&cs=tinysrgb&w=300',
  bus: 'https://images.pexels.com/photos/3608967/pexels-photo-3608967.jpeg?auto=compress&cs=tinysrgb&w=300'
};

// Predefined thumbnails as fallback
const PREDEFINED_THUMBNAILS: { [key: string]: string } = {
  beach: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  mountain: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=800',
  city: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  paris: 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=800',
  italy: 'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
  japan: 'https://images.pexels.com/photos/590478/pexels-photo-590478.jpeg?auto=compress&cs=tinysrgb&w=800',
  camping: 'https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg?auto=compress&cs=tinysrgb&w=800',
  ski: 'https://images.pexels.com/photos/848599/pexels-photo-848599.jpeg?auto=compress&cs=tinysrgb&w=800',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=800'
};

const getEventThumbnail = async (event: Event): Promise<string> => {
  let searchTerm = '';
  
  // Determine search term based on event type
  switch (event.type) {
    case 'stay':
      searchTerm = (event as StayEvent).accommodationName || 'hotel accommodation';
      break;
    case 'destination':
      searchTerm = (event as DestinationEvent).placeName || 'travel destination';
      break;
    case 'arrival':
    case 'departure':
      searchTerm = (event as ArrivalDepartureEvent).airport || 'airport terminal';
      break;
    case 'flight':
      searchTerm = (event as FlightEvent).arrivalAirport || (event as FlightEvent).departureAirport || 'airplane';
      break;
    case 'train':
      searchTerm = (event as TrainEvent).arrivalStation || (event as TrainEvent).departureStation || 'train station';
      break;
    case 'rental_car':
      searchTerm = (event as RentalCarEvent).pickupLocation || (event as RentalCarEvent).dropoffLocation || 'car rental';
      break;
    case 'bus':
      searchTerm = (event as BusEvent).departureStation || (event as BusEvent).arrivalStation || 'bus station';
      break;
  }

  // Check cache first
  const cacheKey = `${event.type}-${searchTerm}`;
  if (thumbnailCache[cacheKey]) {
    return thumbnailCache[cacheKey];
  }

  // Check predefined thumbnails
  const lowercaseName = searchTerm.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[cacheKey] = url;
      return url;
    }
  }

  try {
    // Remove common words and get keywords from place name
    const keywords = searchTerm
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => !['hotel', 'airport', 'the', 'a', 'an', 'in', 'at', 'of'].includes(word))
      .join(' ');

    // Try to fetch from Pexels API
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': import.meta.env.VITE_PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Pexels');
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.large2x;
      thumbnailCache[cacheKey] = imageUrl;
      return imageUrl;
    }
  } catch (error) {
    console.warn('Failed to fetch custom thumbnail:', error);
  }

  // Fallback to default event type thumbnail
  return DEFAULT_THUMBNAILS[event.type];
};

const getDefaultThumbnail = async (tripName: string): Promise<string> => {
  // Check cache first
  if (thumbnailCache[tripName]) {
    return thumbnailCache[tripName];
  }

  // Check predefined thumbnails
  const lowercaseName = tripName.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[tripName] = url;
      return url;
    }
  }

  try {
    // Remove common words and get keywords from trip name
    const keywords = tripName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => !['trip', 'to', 'in', 'at', 'the', 'a', 'an'].includes(word))
      .join(' ');

    // Try to fetch from Pexels API
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': import.meta.env.VITE_PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Pexels');
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.large2x;
      thumbnailCache[tripName] = imageUrl;
      return imageUrl;
    }
  } catch (error) {
    console.warn('Failed to fetch custom thumbnail:', error);
  }

  // Fallback to default travel image
  return PREDEFINED_THUMBNAILS.default;
};

const TripDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, updateTrip, deleteTrip, leaveTrip, addEvent, updateEvent, deleteEvent } = useTrip();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeaveWarningOpen, setIsLeaveWarningOpen] = useState(false);
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);
  const [isDeleteEventWarningOpen, setIsDeleteEventWarningOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>('arrival');
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState<string | null>(null);
  const [editedTrip, setEditedTrip] = useState<Trip | null>(null);
  const [tripThumbnail, setTripThumbnail] = useState<string>('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'confirmed' | 'exploring'>('confirmed');
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [eventData, setEventData] = useState<EventFormData>({
    type: 'arrival',
    date: '',
    time: '',
    airport: '',
    flightNumber: '',
    airline: '',
    terminal: '',
    gate: '',
    bookingReference: '',
    accommodationName: '',
    address: '',
    checkIn: '',
    checkOut: '',
    reservationNumber: '',
    contactInfo: '',
    placeName: '',
    description: '',
    openingHours: '',
    notes: '',
    status: 'confirmed',
    thumbnailUrl: '',
    source: 'manual',
    location: undefined,
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    trainNumber: '',
    trainOperator: '',
    departureStation: '',
    arrivalStation: '',
    carriageNumber: '',
    seatNumber: '',
    carCompany: '',
    carType: '',
    pickupLocation: '',
    dropoffLocation: '',
    pickupTime: '',
    dropoffTime: '',
    licensePlate: '',
    busOperator: '',
    busNumber: ''
  });
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [airportSuggestions, setAirportSuggestions] = useState<Array<{name: string, iata: string}>>([]);
  const [showAirportSuggestions, setShowAirportSuggestions] = useState(false);
  const airportInputRef = useRef<HTMLInputElement>(null);
  const [eventThumbnails, setEventThumbnails] = useState<{ [key: string]: string }>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: '', message: '' });
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAirports = async (query: string) => {
    if (query.length < 2) {
      setAirportSuggestions([]);
      return;
    }
    try {
      const response = await fetch(`https://api.api-ninjas.com/v1/airports?name=${query}`, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      const data = await response.json();
      const airports = data
        .filter((airport: any) => airport.iata && airport.name)
        .map((airport: any) => ({
          name: `${airport.name} (${airport.iata})`,
          iata: airport.iata
        }));
      setAirportSuggestions(airports);
      setShowAirportSuggestions(true);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (airportInputRef.current && !airportInputRef.current.contains(event.target as Node)) {
        setShowAirportSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchTrip = async () => {
      if (!id || id === 'undefined') {
        console.error('Trip ID is missing or invalid:', id);
        setError('Trip ID is missing or invalid');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching trip with ID:', id);
        const fetchedTrip = await api.getTrip(id);
        if (!fetchedTrip) {
          console.error('Trip not found for ID:', id);
          setError('Trip not found');
          return;
        }
        console.log('Successfully fetched trip:', fetchedTrip);
        
        // Debug log for event creators
        if (fetchedTrip.events && fetchedTrip.events.length > 0) {
          console.log('EVENT CREATOR CHECK - Raw events from server:', fetchedTrip.events.map(event => ({
            eventId: event.id,
            eventType: event.type,
            createdBy: event.createdBy,
            createdByType: typeof event.createdBy,
            createdById: typeof event.createdBy === 'object' ? event.createdBy._id : event.createdBy,
            creatorPhotoUrl: typeof event.createdBy === 'object' ? event.createdBy.photoUrl : null,
            creatorName: typeof event.createdBy === 'object' ? event.createdBy.name : null
          })));
          
          // Log the first event's creator details in depth
          const firstEvent = fetchedTrip.events[0];
          console.log('EVENT CREATOR CHECK - First event creator details:', {
            eventId: firstEvent.id,
            eventType: firstEvent.type,
            createdBy: firstEvent.createdBy,
            createdByType: typeof firstEvent.createdBy,
            createdById: typeof firstEvent.createdBy === 'object' ? firstEvent.createdBy._id : firstEvent.createdBy,
            creatorPhotoUrl: typeof firstEvent.createdBy === 'object' ? firstEvent.createdBy.photoUrl : null,
            creatorName: typeof firstEvent.createdBy === 'object' ? firstEvent.createdBy.name : null,
            fullCreatorObject: firstEvent.createdBy
          });
        }
        
        // Update only the local state
        setTrip(fetchedTrip);
        setEditedTrip(fetchedTrip);
        
        setError('');
      } catch (err) {
        console.error('Error fetching trip:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch trip');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  useEffect(() => {
    const loadThumbnail = async () => {
      if (trip) {
        if (trip.thumbnailUrl) {
          // If there's a custom thumbnail URL, use it
          setTripThumbnail(trip.thumbnailUrl);
        } else {
          // Otherwise, get a default thumbnail based on the trip name
          const thumbnail = await getDefaultThumbnail(trip.name);
          setTripThumbnail(thumbnail);
        }
      }
    };
    loadThumbnail();
  }, [trip?.name, trip?.thumbnailUrl]);

  // Load thumbnails for events that don't have one
  useEffect(() => {
    if (!trip) return;

    const loadEventThumbnails = async () => {
      const thumbnailPromises = trip.events
        .filter(event => !event.thumbnailUrl)
        .map(async event => {
          try {
            const thumbnail = await getEventThumbnail(event);
            return { id: event.id, thumbnail };
          } catch (error) {
            console.warn(`Failed to load thumbnail for event ${event.id}:`, error);
            return { id: event.id, thumbnail: DEFAULT_THUMBNAILS[event.type] };
          }
        });

      const loadedThumbnails = await Promise.all(thumbnailPromises);
      setEventThumbnails(prevThumbnails => ({
        ...prevThumbnails,
        ...Object.fromEntries(loadedThumbnails.map(({ id, thumbnail }) => [id, thumbnail]))
      }));
    };

    loadEventThumbnails();
  }, [trip]);

  // Add click outside handler for export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTripUpdate = async (updatedTrip: Trip) => {
    console.log('Updating trip with new data:', updatedTrip);
    
    // Check if only collaborators have changed
    const onlyCollaboratorsChanged = 
      trip && 
      trip._id === updatedTrip._id &&
      trip.name === updatedTrip.name &&
      trip.events.length === updatedTrip.events.length &&
      JSON.stringify(trip.events) === JSON.stringify(updatedTrip.events);
    
    if (onlyCollaboratorsChanged) {
      console.log('Only collaborators changed, updating just collaborator data');
      // Update only the collaborators without replacing the entire trip object
      setTrip(prevTrip => {
        if (!prevTrip) return updatedTrip;
        return {
          ...prevTrip,
          collaborators: updatedTrip.collaborators
        };
      });
    } else {
      // Create a deep copy of the updated trip to avoid reference issues
      const tripCopy = JSON.parse(JSON.stringify(updatedTrip)) as Trip;
      // Update the local state with the full new trip
      setTrip(tripCopy);
    }
    
    // Update the context state
    try {
      await updateTrip(updatedTrip);
      console.log('Trip update complete');
    } catch (err) {
      console.error('Error updating trip in context:', err);
      // If context update fails, fetch the latest trip data from the server
      try {
        const latestTrip = await api.getTrip(updatedTrip._id || id || '');
        setTrip(latestTrip as Trip);
      } catch (fetchErr) {
        console.error('Failed to fetch latest trip data after error:', fetchErr);
      }
    }
  };

  const handleLeaveTrip = async () => {
    if (!trip?._id) {
      setError('Trip ID is missing');
      return;
    }

    try {
      console.log('Attempting to leave trip:', {
        tripId: trip._id,
        userId: user?._id,
        collaborators: trip.collaborators
      });
      await leaveTrip(trip._id);
      console.log('Successfully left trip');
      navigate('/trips');
    } catch (err) {
      console.error('Error leaving trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave trip');
    }
  };

  // Create a memoized version of the trip data that only includes fields needed for the map
  const mapTripData = useMemo(() => {
    if (!trip) return null;
    
    const mappedTrip: Trip = {
      _id: trip._id,
      name: trip.name,
      events: trip.events.map(event => {
        // Helper function to get user info from ID
        const getUserFromId = (userId: string): User | undefined => {
          // Check if it's the current user
          if (user && user._id === userId) {
            return {
              _id: user._id,
              name: user.name,
              email: user.email,
              photoUrl: user.photoUrl
            };
          }
          
          // Check if it's the trip owner
          if (trip.owner._id === userId) {
            return {
              _id: trip.owner._id,
              name: trip.owner.name,
              email: trip.owner.email,
              photoUrl: trip.owner.photoUrl
            };
          }
          
          // Check collaborators
          const collaborator = trip.collaborators.find(c => {
            if (typeof c === 'string') {
              return c === userId;
            }
            return c.user._id === userId;
          });
          
          if (collaborator && typeof collaborator !== 'string') {
            return {
              _id: collaborator.user._id,
              name: collaborator.user.name,
              email: collaborator.user.email,
              photoUrl: collaborator.user.photoUrl
            };
          }
          
          return undefined;
        };

        const mappedEvent: Event = {
          ...event,
          createdBy: typeof event.createdBy === 'object' && event.createdBy !== null
            ? {
                _id: event.createdBy._id,
                name: event.createdBy.name,
                email: event.createdBy.email,
                photoUrl: event.createdBy.photoUrl
              }
            : getUserFromId(event.createdBy as string) || {
                _id: event.createdBy as string,
                name: 'Unknown',
                email: '',
                photoUrl: null
              },
          updatedBy: typeof event.updatedBy === 'object' && event.updatedBy !== null
            ? {
                _id: event.updatedBy._id,
                name: event.updatedBy.name,
                email: event.updatedBy.email,
                photoUrl: event.updatedBy.photoUrl
              }
            : getUserFromId(event.updatedBy as string) || {
                _id: event.updatedBy as string,
                name: 'Unknown',
                email: '',
                photoUrl: null
              }
        };
        return mappedEvent;
      }),
      owner: {
        ...trip.owner,
        photoUrl: trip.owner.photoUrl
      },
      collaborators: trip.collaborators.map(collaborator => {
        if (typeof collaborator === 'string') {
          return {
            user: { _id: collaborator, name: '', email: '', photoUrl: null },
            role: 'viewer' as const
          };
        }
        return {
          ...collaborator,
          user: {
            ...collaborator.user,
            photoUrl: collaborator.user.photoUrl
          }
        };
      }),
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic,
      description: trip.description,
      thumbnailUrl: trip.thumbnailUrl,
      shareableLink: trip.shareableLink
    };
    
    return mappedTrip;
  }, [trip?._id, trip?.name, trip?.events, trip?.owner, trip?.collaborators, user]);

  // Export functions
  const handleExportPDF = async () => {
    try {
      if (!trip?._id) return;
      await api.exportTripAsPDF(trip._id);
      setShowExportMenu(false);
    } catch (error) {
      setError('Failed to export trip as PDF');
    }
  };

  const handleExportHTML = async () => {
    if (!trip) return;

    const getEventIcon = (type: string) => {
      switch (type) {
        case 'arrival':
        case 'departure':
          return '✈️';
        case 'stay':
          return '🏨';
        case 'destination':
          return '📍';
        case 'flight':
          return '✈️';
        case 'train':
          return '🚂';
        case 'rental_car':
          return '🚗';
        case 'bus':
          return '🚌';
        default:
          return '📅';
      }
    };

    const getEventTitle = (event: Event) => {
      switch (event.type) {
        case 'arrival':
        case 'departure':
          return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${(event as ArrivalDepartureEvent).airport}`;
        case 'stay':
          return (event as StayEvent).accommodationName;
        case 'destination':
          return (event as DestinationEvent).placeName;
        case 'flight': {
          const e = event as FlightEvent;
          return `${e.departureAirport || ''} to ${e.arrivalAirport || ''}`;
        }
        case 'train': {
          const e = event as TrainEvent;
          return `${e.departureStation || ''} to ${e.arrivalStation || ''}`;
        }
        case 'rental_car': {
          const e = event as RentalCarEvent;
          return `${e.pickupLocation || ''} to ${e.dropoffLocation || ''}`;
        }
        case 'bus': {
          const e = event as BusEvent;
          return `${e.departureStation || ''} to ${e.arrivalStation || ''}`;
        }
        default:
          return 'Event';
      }
    };

    const confirmedEvents = trip.events.filter(event => event.status === 'confirmed');
    const sortedEvents = sortEvents(confirmedEvents);
    
    // Group events by date
    const eventsByDate: Record<string, Event[]> = {};
    sortedEvents.forEach(event => {
      const dateString = event.date.split('T')[0];
      if (!eventsByDate[dateString]) {
        eventsByDate[dateString] = [];
      }
      eventsByDate[dateString].push(event);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${trip.name} - Itinerary</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .date-header {
              background-color: #EEF2FF;
              padding: 10px 15px;
              margin: 20px 0 10px;
              border-radius: 6px;
              font-weight: 500;
              color: #3730A3;
            }
            .event-card {
              border: 1px solid #E5E7EB;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background-color: white;
            }
            .event-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 10px;
            }
            .event-icon {
              font-size: 24px;
            }
            .event-type {
              color: #4F46E5;
              font-weight: 500;
              text-transform: capitalize;
            }
            .event-title {
              font-weight: 600;
              color: #111827;
              margin: 5px 0;
            }
            .event-details {
              color: #6B7280;
              font-size: 0.9em;
            }
            .event-time {
              color: #4B5563;
              font-size: 0.9em;
            }
            .event-notes {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #E5E7EB;
              color: #6B7280;
              font-style: italic;
            }
            @media print {
              body {
                padding: 0;
              }
              .event-card {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              .date-header {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; color: #111827; margin-bottom: 30px;">${trip.name}</h1>
          ${Object.entries(eventsByDate)
            .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
            .map(([dateString, events]) => {
              const [year, month, day] = dateString.split('-').map(Number);
              const date = new Date(year, month - 1, day, 12);
              const formattedDate = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric'
              });
              
              return `
                <div class="date-header">${formattedDate}</div>
                ${events.map(event => `
                  <div class="event-card">
                    <div class="event-header">
                      <span class="event-icon">${getEventIcon(event.type)}</span>
                      <span class="event-type">${event.type.replace('_', ' ')}</span>
                    </div>
                    <div class="event-title">${getEventTitle(event)}</div>
                    ${'time' in event && event.time && `<div class="event-time">${event.time}</div>`}
                    ${(() => {
                      switch (event.type) {
                        case 'arrival':
                        case 'departure': {
                          const e = event as ArrivalDepartureEvent;
                          return `
                            <div class="event-details">
                              ${e.airline && `<div>Airline: ${e.airline}</div>`}
                              ${e.flightNumber && `<div>Flight: ${e.flightNumber}</div>`}
                              ${e.terminal && `<div>Terminal: ${e.terminal}</div>`}
                              ${e.gate && `<div>Gate: ${e.gate}</div>`}
                            </div>
                          `;
                        }
                        case 'stay': {
                          const e = event as StayEvent;
                          return `
                            <div class="event-details">
                              ${e.checkOut && `<div>Check-out: ${e.checkOut}</div>`}
                              ${e.address && `<div>Address: ${e.address}</div>`}
                            </div>
                          `;
                        }
                        case 'destination': {
                          const e = event as DestinationEvent;
                          return `
                            <div class="event-details">
                              ${e.address && `<div>Address: ${e.address}</div>`}
                              ${e.openingHours && `<div>Hours: ${e.openingHours}</div>`}
                            </div>
                          `;
                        }
                        case 'flight': {
                          const e = event as FlightEvent;
                          return `
                            <div class="event-details">
                              ${e.airline && `<div>Airline: ${e.airline}</div>`}
                              ${e.flightNumber && `<div>Flight: ${e.flightNumber}</div>`}
                              ${e.terminal && `<div>Terminal: ${e.terminal}</div>`}
                              ${e.gate && `<div>Gate: ${e.gate}</div>`}
                            </div>
                          `;
                        }
                        case 'train': {
                          const e = event as TrainEvent;
                          return `
                            <div class="event-details">
                              ${e.trainNumber && `<div>Train: ${e.trainNumber}</div>`}
                              ${e.departureTime && `<div>Departure: ${e.departureTime}</div>`}
                              ${e.arrivalTime && `<div>Arrival: ${e.arrivalTime}</div>`}
                            </div>
                          `;
                        }
                        case 'rental_car': {
                          const e = event as RentalCarEvent;
                          return `
                            <div class="event-details">
                              ${e.carCompany && `<div>Company: ${e.carCompany}</div>`}
                              ${e.carType && `<div>Car: ${e.carType}</div>`}
                              ${e.pickupTime && `<div>Pickup: ${e.pickupTime}</div>`}
                              ${e.dropoffTime && `<div>Dropoff: ${e.dropoffTime}</div>`}
                            </div>
                          `;
                        }
                        case 'bus': {
                          const e = event as BusEvent;
                          return `
                            <div class="event-details">
                              ${e.busOperator && `<div>Operator: ${e.busOperator}</div>`}
                              ${e.busNumber && `<div>Bus: ${e.busNumber}</div>`}
                              ${e.departureTime && `<div>Departure: ${e.departureTime}</div>`}
                              ${e.arrivalTime && `<div>Arrival: ${e.arrivalTime}</div>`}
                              ${e.seatNumber && <p>Seat: {e.seatNumber}</p>}
                            </div>
                          `;
                        }
                        default:
                          return '';
                      }
                    })()}
                    ${event.notes && `<div class="event-notes">${event.notes}</div>`}
                  </div>
                `).join('')}
              `;
            }).join('')}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-itinerary.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (eventId: string, newStatus: 'confirmed' | 'exploring') => {
    if (!trip || !user) return;
    
    try {
      const eventToUpdate = trip.events.find(e => e.id === eventId);
      if (!eventToUpdate) return;
      
      const updatedEvent: Event = {
        ...eventToUpdate, 
        status: newStatus,
        updatedBy: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        },
        updatedAt: new Date().toISOString()
      };

      const updatedTrip = { 
        ...trip, 
        events: trip.events.map(e => e.id === eventId ? updatedEvent : e) 
      };

      await updateTrip(updatedTrip);
      setTrip(updatedTrip);
    } catch (error) {
      console.error('Error updating event status:', error);
      setError('Failed to update event status');
    }
  };

  const handleVote = async (eventId: string, voteType: 'like' | 'dislike' | 'remove') => {
    if (!trip?._id) return;
    
    try {
      const event = trip.events.find(e => e.id === eventId);
      if (!event || !user?._id) return;

      const updatedEvent = { ...event };
      
      // Initialize arrays if they don't exist
      updatedEvent.likes = updatedEvent.likes || [];
      updatedEvent.dislikes = updatedEvent.dislikes || [];
      
      if (voteType === 'remove') {
        updatedEvent.likes = updatedEvent.likes.filter(id => id !== user._id);
        updatedEvent.dislikes = updatedEvent.dislikes.filter(id => id !== user._id);
      } else if (voteType === 'like') {
        updatedEvent.likes = [...new Set([...updatedEvent.likes, user._id])];
        updatedEvent.dislikes = updatedEvent.dislikes.filter(id => id !== user._id);
      } else {
        updatedEvent.dislikes = [...new Set([...updatedEvent.dislikes, user._id])];
        updatedEvent.likes = updatedEvent.likes.filter(id => id !== user._id);
      }

      await updateEvent(trip._id, updatedEvent);
      
      // Update local trip state
      if (trip) {
        const updatedEvents = trip.events.map(e => 
          e.id === eventId ? updatedEvent : e
        );
        setTrip({ ...trip, events: updatedEvents });
      }
    } catch (error) {
      console.error('Error updating vote:', error);
      setError('Failed to update vote');
    }
  };

  // Get user vote status
  const getUserVoteStatus = (event: Event) => {
    if (!user?._id) return null;
    if (event.likes?.includes(user._id)) return 'liked';
    if (event.dislikes?.includes(user._id)) return 'disliked';
    return null;
  };

  // Helper function to get names of users who liked/disliked an event
  const getVoterNames = (event: Event) => {
    const getNameFromId = (id: string) => {
      if (id === user?._id) return 'You';
      if (id === trip?.owner._id) return 'Trip Owner';
      const collaborator = trip?.collaborators.find(c => 
        (typeof c === 'string' ? c : c.user._id) === id
      );
      return typeof collaborator === 'string' ? 'Unknown User' : collaborator?.user.name || 'Unknown User';
    };

    const likeNames = (event.likes || []).map(getNameFromId).filter(Boolean);
    const dislikeNames = (event.dislikes || []).map(getNameFromId).filter(Boolean);

    return { likes: likeNames, dislikes: dislikeNames };
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      if (!trip?._id) return;
      
      await deleteEvent(trip._id, eventId);
      // Update local trip state by filtering out the deleted event
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          events: prevTrip.events.filter(event => event.id !== eventId)
        };
      });
      setIsDeleteEventWarningOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEventTypeChange = (newType: EventType) => {
    setEventType(newType);
    setEventData(prev => ({ ...prev, type: newType }));
  };

  const resetEventForm = () => {
    const defaultType = 'arrival';
    setEventType(defaultType);
    setEventData({
      type: defaultType,
      date: '',
      time: '',
      airport: '',
      flightNumber: '',
      airline: '',
      terminal: '',
      gate: '',
      bookingReference: '',
      accommodationName: '',
      address: '',
      checkIn: '',
      checkOut: '',
      reservationNumber: '',
      contactInfo: '',
      placeName: '',
      description: '',
      openingHours: '',
      notes: '',
      status: 'confirmed',
      thumbnailUrl: '',
      source: 'manual',
      location: undefined,
      departureAirport: '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      trainNumber: '',
      trainOperator: '',
      departureStation: '',
      arrivalStation: '',
      carriageNumber: '',
      seatNumber: '',
      carCompany: '',
      carType: '',
      pickupLocation: '',
      dropoffLocation: '',
      pickupTime: '',
      dropoffTime: '',
      licensePlate: '',
      busOperator: '',
      busNumber: ''
    });
  };

  useEffect(() => {
    if (!isModalOpen) {
      resetEventForm();
    }
  }, [isModalOpen]);

  const toggleEventExpansion = (eventId: string, e: React.MouseEvent) => {
    // Don't toggle if clicking on buttons or links
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleDeleteTrip = async () => {
    if (!trip?._id) return;
    try {
      await deleteTrip(trip._id);
      navigate('/trips');
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    } finally {
      setIsDeleteWarningOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error || 'Trip not found'}</div>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/trips')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Back to Trips
        </button>
      </div>
    );
  }

  const handleTripEdit = () => {
    if (!trip) return;
    setEditedTrip({
      ...trip,
      owner: trip.owner,
      collaborators: trip.collaborators.map(collaborator => {
        if (typeof collaborator === 'string') {
          return {
            user: { _id: collaborator, name: '', email: '' },
            role: 'viewer' as const
          };
        }
        return collaborator;
      }),
      events: trip.events.map(event => ({
        ...event,
        createdBy: typeof event.createdBy === 'object'
          ? event.createdBy as User
          : {
              _id: event.createdBy,
              name: '',
              email: '',
              photoUrl: null
            },
        updatedBy: typeof event.updatedBy === 'object'
          ? event.updatedBy as User
          : {
              _id: event.updatedBy,
              name: '',
              email: '',
              photoUrl: null
            }
      }))
    } as Trip);
    setIsEditingTrip(true);
  };

  const handleTripSave = async () => {
    if (!trip?._id || !editedTrip) {
      setError('Trip data is missing');
      return;
    }

    try {
      const updatedTrip = await api.updateTrip(editedTrip);
      // Update both trip and tripThumbnail states immediately
      setTrip(updatedTrip as Trip);
      setTripThumbnail(updatedTrip.thumbnailUrl || '');
      setIsEditingTrip(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    }
  };

  const handleEditEvent = (event: Event) => {
    setIsEditingEvent(event.id);
    setEventType(event.type);  // Set the event type when editing
    const baseData = {
      type: event.type,
      date: event.date,
      time: '',
      airport: '',
      flightNumber: '',
      airline: '',
      terminal: '',
      gate: '',
      bookingReference: '',
      accommodationName: '',
      address: '',
      checkIn: '',
      checkOut: '',
      reservationNumber: '',
      contactInfo: '',
      placeName: '',
      description: '',
      openingHours: '',
      notes: event.notes || '',
      status: event.status,
      thumbnailUrl: event.thumbnailUrl,
      source: event.source,
      location: event.location,
      departureAirport: '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      trainNumber: '',
      trainOperator: '',
      departureStation: '',
      arrivalStation: '',
      carriageNumber: '',
      seatNumber: '',
      carCompany: '',
      carType: '',
      pickupLocation: '',
      dropoffLocation: '',
      pickupTime: '',
      dropoffTime: '',
      licensePlate: '',
      busOperator: '',
      busNumber: ''
    };

    const typeSpecificData = event.type === 'arrival' || event.type === 'departure'
      ? {
          time: (event as ArrivalDepartureEvent).time || '',
          airport: (event as ArrivalDepartureEvent).airport || '',
          flightNumber: (event as ArrivalDepartureEvent).flightNumber || '',
          airline: (event as ArrivalDepartureEvent).airline || '',
          terminal: (event as ArrivalDepartureEvent).terminal || '',
          gate: (event as ArrivalDepartureEvent).gate || '',
          bookingReference: (event as ArrivalDepartureEvent).bookingReference || ''
        }
      : event.type === 'stay'
      ? {
          accommodationName: (event as StayEvent).accommodationName || '',
          address: (event as StayEvent).address || '',
          checkIn: (event as StayEvent).checkIn || '',
          checkOut: (event as StayEvent).checkOut || '',
          reservationNumber: (event as StayEvent).reservationNumber || '',
          contactInfo: (event as StayEvent).contactInfo || ''
        }
      : event.type === 'destination'
      ? {
          placeName: (event as DestinationEvent).placeName || '',
          address: (event as DestinationEvent).address || '',
          description: (event as DestinationEvent).description || '',
          openingHours: (event as DestinationEvent).openingHours || ''
        }
      : event.type === 'flight'
      ? {
          airline: (event as FlightEvent).airline || '',
          flightNumber: (event as FlightEvent).flightNumber || '',
          departureAirport: (event as FlightEvent).departureAirport || '',
          arrivalAirport: (event as FlightEvent).arrivalAirport || '',
          departureTime: (event as FlightEvent).departureTime || '',
          arrivalTime: (event as FlightEvent).arrivalTime || '',
          terminal: (event as FlightEvent).terminal || '',
          gate: (event as FlightEvent).gate || '',
          bookingReference: (event as FlightEvent).bookingReference || ''
        }
      : event.type === 'train'
      ? {
          trainNumber: (event as TrainEvent).trainNumber || '',
          trainOperator: (event as TrainEvent).trainOperator || '',
          departureStation: (event as TrainEvent).departureStation || '',
          arrivalStation: (event as TrainEvent).arrivalStation || '',
          departureTime: (event as TrainEvent).departureTime || '',
          arrivalTime: (event as TrainEvent).arrivalTime || '',
          carriageNumber: (event as TrainEvent).carriageNumber || '',
          seatNumber: (event as TrainEvent).seatNumber || '',
          bookingReference: (event as TrainEvent).bookingReference || ''
        }
      : event.type === 'rental_car'
      ? {
          carCompany: (event as RentalCarEvent).carCompany || '',
          carType: (event as RentalCarEvent).carType || '',
          pickupLocation: (event as RentalCarEvent).pickupLocation || '',
          dropoffLocation: (event as RentalCarEvent).dropoffLocation || '',
          pickupTime: (event as RentalCarEvent).pickupTime || '',
          dropoffTime: (event as RentalCarEvent).dropoffTime || '',
          licensePlate: (event as RentalCarEvent).licensePlate || '',
          bookingReference: (event as RentalCarEvent).bookingReference || ''
        }
      : event.type === 'bus'
      ? {
          busOperator: (event as BusEvent).busOperator || '',
          busNumber: (event as BusEvent).busNumber || '',
          departureStation: (event as BusEvent).departureStation || '',
          arrivalStation: (event as BusEvent).arrivalStation || '',
          departureTime: (event as BusEvent).departureTime || '',
          arrivalTime: (event as BusEvent).arrivalTime || '',
          seatNumber: (event as BusEvent).seatNumber || '',
          bookingReference: (event as BusEvent).bookingReference || ''
        }
      : {
          time: '',
          airport: '',
          flightNumber: '',
          airline: '',
          terminal: '',
          gate: '',
          bookingReference: '',
          accommodationName: '',
          address: '',
          checkIn: '',
          checkOut: '',
          reservationNumber: '',
          contactInfo: '',
          placeName: '',
          description: '',
          openingHours: '',
          departureAirport: '',
          arrivalAirport: '',
          departureTime: '',
          arrivalTime: '',
          trainNumber: '',
          trainOperator: '',
          departureStation: '',
          arrivalStation: '',
          carriageNumber: '',
          seatNumber: '',
          carCompany: '',
          carType: '',
          pickupLocation: '',
          dropoffLocation: '',
          pickupTime: '',
          dropoffTime: '',
          licensePlate: '',
          busOperator: '',
          busNumber: ''
        };

    setEventData({ ...baseData, ...typeSpecificData });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    setFormFeedback({ type: '', message: '' });

    try {
      const now = new Date().toISOString();
      const baseEvent = {
        id: isEditingEvent || uuidv4(),
        type: eventData.type as EventType,
        date: eventData.date,
        notes: eventData.notes,
        thumbnailUrl: eventData.thumbnailUrl,
        status: eventData.status || 'confirmed',
        source: eventData.source || 'manual',
        location: eventData.location,
        createdBy: isEditingEvent ? (
          trip.events.find(e => e.id === isEditingEvent)?.createdBy || {
            _id: user._id,
            name: user.name,
            email: user.email,
            photoUrl: user.photoUrl
          }
        ) : {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        },
        updatedBy: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        },
        createdAt: isEditingEvent ? (
          trip.events.find(e => e.id === isEditingEvent)?.createdAt || now
        ) : now,
        updatedAt: now,
        likes: isEditingEvent ? (
          trip.events.find(e => e.id === isEditingEvent)?.likes || []
        ) : [],
        dislikes: isEditingEvent ? (
          trip.events.find(e => e.id === isEditingEvent)?.dislikes || []
        ) : []
      };

      let newEvent: Event;

      if (eventData.type === 'arrival' || eventData.type === 'departure') {
        newEvent = {
          ...baseEvent,
          time: eventData.time || '',
          airport: eventData.airport || '',
          flightNumber: eventData.flightNumber || '',
          airline: eventData.airline || '',
          terminal: eventData.terminal || '',
          gate: eventData.gate || '',
          bookingReference: eventData.bookingReference || ''
        } as ArrivalDepartureEvent;
      } else if (eventData.type === 'stay') {
        newEvent = {
          ...baseEvent,
          accommodationName: eventData.accommodationName || '',
          address: eventData.address || '',
          checkIn: eventData.checkIn || '',
          checkOut: eventData.checkOut || '',
          reservationNumber: eventData.reservationNumber || '',
          contactInfo: eventData.contactInfo || ''
        } as StayEvent;
      } else if (eventData.type === 'destination') {
        newEvent = {
          ...baseEvent,
          placeName: eventData.placeName || '',
          address: eventData.address || '',
          description: eventData.description || '',
          openingHours: eventData.openingHours || ''
        } as DestinationEvent;
      } else if (eventData.type === 'flight') {
        newEvent = {
          ...baseEvent,
          airline: eventData.airline || '',
          flightNumber: eventData.flightNumber || '',
          departureAirport: eventData.departureAirport || '',
          arrivalAirport: eventData.arrivalAirport || '',
          departureTime: eventData.departureTime || '',
          arrivalTime: eventData.arrivalTime || '',
          terminal: eventData.terminal || '',
          gate: eventData.gate || '',
          bookingReference: eventData.bookingReference || ''
        } as FlightEvent;
      } else if (eventData.type === 'train') {
        newEvent = {
          ...baseEvent,
          trainNumber: eventData.trainNumber || '',
          trainOperator: eventData.trainOperator || '',
          departureStation: eventData.departureStation || '',
          arrivalStation: eventData.arrivalStation || '',
          departureTime: eventData.departureTime || '',
          arrivalTime: eventData.arrivalTime || '',
          carriageNumber: eventData.carriageNumber || '',
          seatNumber: eventData.seatNumber || '',
          bookingReference: eventData.bookingReference || ''
        } as TrainEvent;
      } else if (eventData.type === 'rental_car') {
        newEvent = {
          ...baseEvent,
          carCompany: eventData.carCompany || '',
          carType: eventData.carType || '',
          pickupLocation: eventData.pickupLocation || '',
          dropoffLocation: eventData.dropoffLocation || '',
          pickupTime: eventData.pickupTime || '',
          dropoffTime: eventData.dropoffTime || '',
          licensePlate: eventData.licensePlate || '',
          bookingReference: eventData.bookingReference || ''
        } as RentalCarEvent;
      } else if (eventData.type === 'bus') {
        newEvent = {
          ...baseEvent,
          busOperator: eventData.busOperator || '',
          busNumber: eventData.busNumber || '',
          departureStation: eventData.departureStation || '',
          arrivalStation: eventData.arrivalStation || '',
          departureTime: eventData.departureTime || '',
          arrivalTime: eventData.arrivalTime || '',
          seatNumber: eventData.seatNumber || '',
          bookingReference: eventData.bookingReference || ''
        } as BusEvent;
      } else {
        newEvent = {
          ...baseEvent,
          placeName: eventData.placeName || '',
          address: eventData.address || '',
          description: eventData.description || '',
          openingHours: eventData.openingHours || ''
        } as DestinationEvent;
      }

      if (isEditingEvent) {
        // Update existing event
        const updatedEvents = trip.events.map(e => 
          e.id === isEditingEvent ? newEvent : e
        );
        
        const updatedTrip = {
          ...trip,
          events: updatedEvents
        };
        
        await updateTrip(updatedTrip);
        setTrip(updatedTrip);
        setFormFeedback({ type: 'success', message: 'Event updated successfully!' });
      } else {
        // Add new event
        const updatedTrip = {
          ...trip,
          events: [...trip.events, newEvent]
        };
        
        await updateTrip(updatedTrip);
        setTrip(updatedTrip);
        setFormFeedback({ type: 'success', message: 'Event added successfully!' });
      }

      setIsModalOpen(false);
      resetEventForm();
    } catch (error) {
      console.error('Error submitting event:', error);
      setFormFeedback({
        type: 'error',
        message: 'Failed to save event. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEvent = async () => {
    if (!trip) return;

    const newEvent = {
      id: uuidv4(),
      type: eventType as EventType,
      date: eventData.date,
      notes: eventData.notes,
      thumbnailUrl: eventData.thumbnailUrl,
      status: eventData.status,
      source: eventData.source,
      // ... existing event properties ...
    };

    // If no thumbnail URL is provided, fetch one based on the place name
    if (!eventData.thumbnailUrl) {
      newEvent.thumbnailUrl = await getEventThumbnail(newEvent as Event);
    }

    // ... rest of the handleAddEvent function ...
  };

  const renderEventForm = () => {
    const commonFields = (
      <>
        {['stay', 'destination'].includes(eventType) && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
            <input
              type="url"
              value={eventData.thumbnailUrl}
              onChange={(e) =>
                setEventData({ ...eventData, thumbnailUrl: e.target.value })
              }
              className="input"
              placeholder="Enter image URL or leave empty"
            />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={eventData.date?.split('T')[0] || ''}
            onChange={(e) =>
              setEventData({ ...eventData, date: e.target.value })
            }
            className="input"
            required={eventType as EventType !== 'bus'}
          />
        </div>
        {(eventType === 'arrival' || eventType === 'departure') && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Time</label>
            <input
              type="time"
              value={eventData.time || ''}
              onChange={(e) =>
                setEventData({ ...eventData, time: e.target.value })
              }
              className="input"
              placeholder="Enter time (HH:mm)"
            />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Status</label>
          <select
            value={eventData.status}
            onChange={(e) =>
              setEventData({ ...eventData, status: e.target.value as 'confirmed' | 'exploring' })
            }
            className="input"
          >
            <option value="confirmed">Confirmed</option>
            <option value="exploring">Exploring</option>
          </select>
        </div>
        {eventData.status === 'exploring' && (
          <>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Exploring events</span> can be voted on by all trip members.
                You and other collaborators will be able to like or dislike this event
                after it's added to help decide which options to confirm.
              </p>
            </div>
          </>
        )}
        {/* Location field hidden but kept in code */}
        <div className="mb-4 hidden">
          <label className="block text-gray-700 mb-2">Location (optional)</label>
          <input
            type="text"
            value={eventData.location?.address || ''}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="input"
            placeholder="Enter location"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            value={eventData.notes}
            onChange={(e) =>
              setEventData({ ...eventData, notes: e.target.value })
            }
            className="input"
            placeholder="Enter any notes"
          />
        </div>
      </>
    );

    switch (eventType) {
      case 'arrival':
      case 'departure':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Flight Number (optional)</label>
              <input
                type="text"
                value={eventData.flightNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, flightNumber: e.target.value })
                }
                className="input"
                placeholder="Enter flight number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Airline (optional)</label>
              <input
                type="text"
                value={eventData.airline}
                onChange={(e) =>
                  setEventData({ ...eventData, airline: e.target.value })
                }
                className="input"
                placeholder="Enter airline name"
              />
            </div>
            <div className="mb-4 relative" ref={airportInputRef}>
              <label className="block text-gray-700 mb-2">Airport</label>
              <input
                type="text"
                value={eventData.airport}
                onChange={(e) => {
                  setEventData({ ...eventData, airport: e.target.value });
                  fetchAirports(e.target.value);
                }}
                className="input"
                placeholder="Start typing airport name..."
              />
              {showAirportSuggestions && airportSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                  {airportSuggestions.map((airport, index) => (
                    <li
                      key={airport.iata}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => {
                        setEventData({ ...eventData, airport: airport.name });
                        setShowAirportSuggestions(false);
                      }}
                    >
                      {airport.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Terminal (optional)</label>
              <input
                type="text"
                value={eventData.terminal}
                onChange={(e) =>
                  setEventData({ ...eventData, terminal: e.target.value })
                }
                className="input"
                placeholder="Enter terminal number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Gate (optional)</label>
              <input
                type="text"
                value={eventData.gate}
                onChange={(e) =>
                  setEventData({ ...eventData, gate: e.target.value })
                }
                className="input"
                placeholder="Enter gate number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
              <input
                type="text"
                value={eventData.bookingReference}
                onChange={(e) =>
                  setEventData({ ...eventData, bookingReference: e.target.value })
                }
                className="input"
                placeholder="Enter booking reference"
              />
            </div>
          </>
        );
      case 'stay':
        return (
          <>
            {['stay', 'destination'].includes(eventType) && (
            <div className="mb-4">
                <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
              <input
                  type="url"
                  value={eventData.thumbnailUrl}
                onChange={(e) =>
                    setEventData({ ...eventData, thumbnailUrl: e.target.value })
                }
                className="input"
                  placeholder="Enter image URL or leave empty"
              />
            </div>
            )}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Accommodation Name</label>
              <input
                type="text"
                value={eventData.accommodationName}
                onChange={(e) =>
                  setEventData({ ...eventData, accommodationName: e.target.value })
                }
                className="input"
                placeholder="Enter accommodation name"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-in Date</label>
              <input
                type="date"
                value={eventData.date?.split('T')[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setEventData({ 
                    ...eventData, 
                    date: value
                  });
                }}
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-out Date</label>
              <input
                type="date"
                value={eventData.checkOut?.split('T')[0] || ''}
                onChange={(e) =>
                  setEventData({ ...eventData, checkOut: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Address (optional)</label>
              <input
                type="text"
                value={eventData.address}
                onChange={(e) =>
                  setEventData({ ...eventData, address: e.target.value })
                }
                className="input"
                placeholder="Enter address"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Location (optional)</label>
              <input
                type="text"
                value={eventData.location?.address || ''}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="input"
                placeholder="Enter location"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Reservation Number (optional)</label>
              <input
                type="text"
                value={eventData.reservationNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, reservationNumber: e.target.value })
                }
                className="input"
                placeholder="Enter reservation number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Contact Info (optional)</label>
              <input
                type="text"
                value={eventData.contactInfo}
                onChange={(e) =>
                  setEventData({ ...eventData, contactInfo: e.target.value })
                }
                className="input"
                placeholder="Enter contact information"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={eventData.notes}
                onChange={(e) =>
                  setEventData({ ...eventData, notes: e.target.value })
                }
                className="input"
                placeholder="Enter any notes"
              />
            </div>
          </>
        );
      case 'destination':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Place Name</label>
              <input
                type="text"
                value={eventData.placeName}
                onChange={(e) =>
                  setEventData({ ...eventData, placeName: e.target.value })
                }
                className="input"
                placeholder="Enter place name"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Address (optional)</label>
              <input
                type="text"
                value={eventData.address}
                onChange={(e) =>
                  setEventData({ ...eventData, address: e.target.value })
                }
                className="input"
                placeholder="Enter address"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Description (optional)</label>
              <textarea
                value={eventData.description}
                onChange={(e) =>
                  setEventData({ ...eventData, description: e.target.value })
                }
                className="input"
                placeholder="Enter description"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Opening Hours (optional)</label>
              <input
                type="text"
                value={eventData.openingHours}
                onChange={(e) =>
                  setEventData({ ...eventData, openingHours: e.target.value })
                }
                className="input"
                placeholder="Enter opening hours"
              />
            </div>
          </>
        );
      case 'flight':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Airline (optional)</label>
              <input
                type="text"
                value={eventData.airline}
                onChange={(e) =>
                  setEventData({ ...eventData, airline: e.target.value })
                }
                className="input"
                placeholder="Enter airline name"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Flight Number (optional)</label>
              <input
                type="text"
                value={eventData.flightNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, flightNumber: e.target.value })
                }
                className="input"
                placeholder="Enter flight number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Airport</label>
              <input
                type="text"
                value={eventData.departureAirport}
                onChange={(e) =>
                  setEventData({ ...eventData, departureAirport: e.target.value })
                }
                className="input"
                required
                placeholder="Enter departure airport"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Airport</label>
              <input
                type="text"
                value={eventData.arrivalAirport}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalAirport: e.target.value })
                }
                className="input"
                required
                placeholder="Enter arrival airport"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Time</label>
              <input
                type="time"
                value={eventData.departureTime}
                onChange={(e) =>
                  setEventData({ ...eventData, departureTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Time</label>
              <input
                type="time"
                value={eventData.arrivalTime}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Terminal (optional)</label>
              <input
                type="text"
                value={eventData.terminal}
                onChange={(e) =>
                  setEventData({ ...eventData, terminal: e.target.value })
                }
                className="input"
                placeholder="Enter terminal number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Gate (optional)</label>
              <input
                type="text"
                value={eventData.gate}
                onChange={(e) =>
                  setEventData({ ...eventData, gate: e.target.value })
                }
                className="input"
                placeholder="Enter gate number"
              />
            </div>
          </>
        );
      case 'train':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Train Operator (optional)</label>
              <input
                type="text"
                value={eventData.trainOperator}
                onChange={(e) =>
                  setEventData({ ...eventData, trainOperator: e.target.value })
                }
                className="input"
                placeholder="Enter train operator"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Train Number (optional)</label>
              <input
                type="text"
                value={eventData.trainNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, trainNumber: e.target.value })
                }
                className="input"
                placeholder="Enter train number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Station</label>
              <input
                type="text"
                value={eventData.departureStation}
                onChange={(e) =>
                  setEventData({ ...eventData, departureStation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter departure station"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Station</label>
              <input
                type="text"
                value={eventData.arrivalStation}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalStation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter arrival station"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Time</label>
              <input
                type="time"
                value={eventData.departureTime}
                onChange={(e) =>
                  setEventData({ ...eventData, departureTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Time</label>
              <input
                type="time"
                value={eventData.arrivalTime}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Carriage Number (optional)</label>
              <input
                type="text"
                value={eventData.carriageNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, carriageNumber: e.target.value })
                }
                className="input"
                placeholder="Enter carriage number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Seat Number (optional)</label>
              <input
                type="text"
                value={eventData.seatNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, seatNumber: e.target.value })
                }
                className="input"
                placeholder="Enter seat number"
              />
            </div>
          </>
        );
      case 'rental_car':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Car Company</label>
              <input
                type="text"
                value={eventData.carCompany}
                onChange={(e) =>
                  setEventData({ ...eventData, carCompany: e.target.value })
                }
                className="input"
                required
                placeholder="Enter car rental company"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Car Type (optional)</label>
              <input
                type="text"
                value={eventData.carType}
                onChange={(e) =>
                  setEventData({ ...eventData, carType: e.target.value })
                }
                className="input"
                placeholder="Enter car type/model"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Pickup Location</label>
              <input
                type="text"
                value={eventData.pickupLocation}
                onChange={(e) =>
                  setEventData({ ...eventData, pickupLocation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter pickup location"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Dropoff Location</label>
              <input
                type="text"
                value={eventData.dropoffLocation}
                onChange={(e) =>
                  setEventData({ ...eventData, dropoffLocation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter dropoff location"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Pickup Time</label>
              <input
                type="time"
                value={eventData.pickupTime}
                onChange={(e) =>
                  setEventData({ ...eventData, pickupTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Dropoff Time</label>
              <input
                type="time"
                value={eventData.dropoffTime}
                onChange={(e) =>
                  setEventData({ ...eventData, dropoffTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">License Plate (optional)</label>
              <input
                type="text"
                value={eventData.licensePlate}
                onChange={(e) =>
                  setEventData({ ...eventData, licensePlate: e.target.value })
                }
                className="input"
                placeholder="Enter license plate number"
              />
            </div>
          </>
        );
      case 'bus':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Bus Operator (optional)</label>
              <input
                type="text"
                value={eventData.busOperator}
                onChange={(e) =>
                  setEventData({ ...eventData, busOperator: e.target.value })
                }
                className="input"
                placeholder="Enter bus operator"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Bus Number (optional)</label>
              <input
                type="text"
                value={eventData.busNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, busNumber: e.target.value })
                }
                className="input"
                placeholder="Enter bus number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Station</label>
              <input
                type="text"
                value={eventData.departureStation}
                onChange={(e) =>
                  setEventData({ ...eventData, departureStation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter departure station"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Station</label>
              <input
                type="text"
                value={eventData.arrivalStation}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalStation: e.target.value })
                }
                className="input"
                required
                placeholder="Enter arrival station"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Departure Time</label>
              <input
                type="time"
                value={eventData.departureTime}
                onChange={(e) =>
                  setEventData({ ...eventData, departureTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Time</label>
              <input
                type="time"
                value={eventData.arrivalTime}
                onChange={(e) =>
                  setEventData({ ...eventData, arrivalTime: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Seat Number (optional)</label>
              <input
                type="text"
                value={eventData.seatNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, seatNumber: e.target.value })
                }
                className="input"
                placeholder="Enter seat number"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const isOwner = user?._id === trip.owner._id;
  const collaborator = trip.collaborators.find(c => c.user._id === user?._id);
  const canEdit = isOwner || collaborator?.role === 'editor';

  console.log('User and ownership debug:', {
    userId: user?._id,
    userIdType: typeof user?._id,
    ownerId: trip.owner._id,
    ownerIdType: typeof trip.owner._id,
    isOwner,
    user,
    tripOwner: trip.owner,
    collaborator,
    canEdit
  });

  console.log('Rendering collaborators:', trip.collaborators);

  const getCreatorInfo = (creatorId: string | User | undefined): User | undefined => {
    if (!trip || !creatorId) return undefined;
    
    // Helper function to get user info with photo URL
    const getUserWithPhoto = (userObj: User): User => {
      // If the user object already has a photo URL, use it
      if (userObj.photoUrl) {
        return userObj;
      }
      
      // Otherwise, look up the photo URL from our known users
      if (user && user._id === userObj._id) {
        return {
          ...userObj,
          photoUrl: user.photoUrl
        };
      }
      
      if (trip.owner._id === userObj._id) {
        return {
          ...userObj,
          photoUrl: trip.owner.photoUrl
        };
      }
      
      const collaborator = trip.collaborators.find(c => {
        if (typeof c === 'string') {
          return c === userObj._id;
        }
        return c.user._id === userObj._id;
      });
      
      if (collaborator && typeof collaborator !== 'string') {
        return {
          ...userObj,
          photoUrl: collaborator.user.photoUrl
        };
      }
      
      return userObj;
    };
    
    // If creatorId is already a User object with all required fields, return it with photo URL
    if (typeof creatorId === 'object' && creatorId._id && creatorId.name) {
      return getUserWithPhoto(creatorId);
    }
    
    // If creatorId is a string or a partial User object, look up the user
    const creatorIdString = typeof creatorId === 'string' ? creatorId : creatorId._id;
    
    // First check if it's the current user
    if (user && user._id === creatorIdString) {
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl
      };
    }
    
    // Then check if it's the trip owner
    if (trip.owner._id === creatorIdString) {
      return {
        _id: trip.owner._id,
        name: trip.owner.name,
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl
      };
    }
    
    // Finally check collaborators
    const collaborator = trip.collaborators.find(c => {
      if (typeof c === 'string') {
        return c === creatorIdString;
      }
      return c.user._id === creatorIdString;
    });
    
    if (collaborator && typeof collaborator !== 'string') {
      return {
        _id: collaborator.user._id,
        name: collaborator.user.name,
        email: collaborator.user.email,
        photoUrl: collaborator.user.photoUrl
      };
    }
    
    return undefined;
  };

  const renderCreatorInfo = (event: Event) => {
    const creatorInfo = getCreatorInfo(event.createdBy);
    if (!creatorInfo) return null;
    
    return (
      <div className="flex items-center flex-shrink-0">
          <Avatar
          photoUrl={creatorInfo.photoUrl || null}
          name={creatorInfo.name}
            size="sm"
            className="ring-2 ring-white"
          />
        <span className="text-sm text-gray-600 ml-2">
          {creatorInfo.name}
          </span>
      </div>
    );
  };

  const renderEventCard = (event: Event) => {
    const getEventIcon = () => {
      switch (event.type) {
        case 'arrival':
          return '✈️';
        case 'departure':
          return '✈️';
        case 'stay':
          return '🏨';
        case 'destination':
          return '📍';
        case 'flight':
          return '✈️';
        case 'train':
          return '🚂';
        case 'rental_car':
          return '🚗';
        case 'bus':
          return '🚌';
        default:
          return '📅';
      }
    };

    const getEventTitle = () => {
      switch (event.type) {
        case 'arrival':
          return `Arrival at ${(event as ArrivalDepartureEvent).airport}`;
        case 'departure':
          return `Departure from ${(event as ArrivalDepartureEvent).airport}`;
        case 'stay':
          return (event as StayEvent).accommodationName;
        case 'destination':
          return (event as DestinationEvent).placeName;
        case 'flight': {
          const flightEvent = event as FlightEvent;
          return `${flightEvent.airline || 'Flight'} ${flightEvent.flightNumber || ''} - ${flightEvent.departureAirport || ''} to ${flightEvent.arrivalAirport || ''}`;
        }
        case 'train': {
          const trainEvent = event as TrainEvent;
          return `${trainEvent.trainOperator || 'Train'} ${trainEvent.trainNumber || ''} - ${trainEvent.departureStation || ''} to ${trainEvent.arrivalStation || ''}`;
        }
        case 'rental_car': {
          const carEvent = event as RentalCarEvent;
          return `${carEvent.carCompany || 'Rental Car'} - ${carEvent.pickupLocation || ''} to ${carEvent.dropoffLocation || ''}`;
        }
        case 'bus': {
          const busEvent = event as BusEvent;
          return `${busEvent.busOperator || 'Bus'} ${busEvent.busNumber || ''} - ${busEvent.departureStation || ''} to ${busEvent.arrivalStation || ''}`;
        }
        default:
          return 'Event';
      }
    };

    const getEventDetails = () => {
      switch (event.type) {
        case 'arrival':
        case 'departure': {
          const flightEvent = event as ArrivalDepartureEvent;
          return (
            <div className="text-sm text-gray-600">
              <p>{flightEvent.time}</p>
              {flightEvent.flightNumber && <p>Flight: {flightEvent.flightNumber}</p>}
              {flightEvent.airline && <p>Airline: {flightEvent.airline}</p>}
              {flightEvent.terminal && <p>Terminal: {flightEvent.terminal}</p>}
              {flightEvent.gate && <p>Gate: {flightEvent.gate}</p>}
            </div>
          );
        }
        case 'stay': {
          const stayEvent = event as StayEvent;
          return (
            <div className="text-sm text-gray-600">
              <p>Check-out: {stayEvent.checkOut}</p>
              {stayEvent.address && <p>Address: {stayEvent.address}</p>}
            </div>
          );
        }
        case 'destination': {
          const destinationEvent = event as DestinationEvent;
          return (
            <div className="text-sm text-gray-600">
              {destinationEvent.address && <p>Address: {destinationEvent.address}</p>}
              {destinationEvent.description && <p>{destinationEvent.description}</p>}
            </div>
          );
        }
        case 'flight': {
          const flightEvent = event as FlightEvent;
          return (
            <div className="text-sm text-gray-600">
              {flightEvent.airline && <p>Airline: {flightEvent.airline}</p>}
              {flightEvent.flightNumber && <p>Flight: {flightEvent.flightNumber}</p>}
              {flightEvent.departureAirport && <p>From: {flightEvent.departureAirport}</p>}
              {flightEvent.arrivalAirport && <p>To: {flightEvent.arrivalAirport}</p>}
              {flightEvent.departureTime && <p>Departure: {flightEvent.departureTime}</p>}
              {flightEvent.arrivalTime && <p>Arrival: {flightEvent.arrivalTime}</p>}
              {flightEvent.terminal && <p>Terminal: {flightEvent.terminal}</p>}
              {flightEvent.gate && <p>Gate: {flightEvent.gate}</p>}
              {flightEvent.bookingReference && <p>Booking Ref: {flightEvent.bookingReference}</p>}
            </div>
          );
        }
        case 'train': {
          const trainEvent = event as TrainEvent;
          return (
            <div className="flex justify-between items-end">
              <div className="text-sm text-gray-600">
                <p>Venice to Vienna</p>
                {trainEvent.departureTime && <p>Departure: {trainEvent.departureTime}</p>}
                {trainEvent.arrivalTime && <p>Arrival: {trainEvent.arrivalTime}</p>}
                {trainEvent.carriageNumber && <p>Carriage: {trainEvent.carriageNumber}</p>}
                {trainEvent.seatNumber && <p>Seat: {trainEvent.seatNumber}</p>}
              </div>
              {renderCreatorInfo(event)}
            </div>
          );
        }
        case 'rental_car': {
          const carEvent = event as RentalCarEvent;
          return (
            <div className="text-sm text-gray-600">
              {carEvent.carType && <p>Car Type: {carEvent.carType}</p>}
              {carEvent.pickupLocation && <p>Pickup: {carEvent.pickupLocation}</p>}
              {carEvent.dropoffLocation && <p>Dropoff: {carEvent.dropoffLocation}</p>}
              {carEvent.pickupTime && <p>Pickup Time: {carEvent.pickupTime}</p>}
              {carEvent.dropoffTime && <p>Dropoff Time: {carEvent.dropoffTime}</p>}
              {carEvent.licensePlate && <p>License Plate: {carEvent.licensePlate}</p>}
              {carEvent.bookingReference && <p>Booking Ref: {carEvent.bookingReference}</p>}
            </div>
          );
        }
        case 'bus': {
          const busEvent = event as BusEvent;
          return (
            <div className="text-sm text-gray-600">
              {busEvent.busOperator && <p>Operator: {busEvent.busOperator}</p>}
              {busEvent.busNumber && <p>Bus: {busEvent.busNumber}</p>}
              {busEvent.departureTime && <p>Departure: {busEvent.departureTime}</p>}
              {busEvent.arrivalTime && <p>Arrival: {busEvent.arrivalTime}</p>}
              {busEvent.seatNumber && <p>Seat: {busEvent.seatNumber}</p>}
            </div>
          );
        }
        default:
          return null;
      }
    };

    const renderEventContent = () => {
      switch (event.type) {
        case 'arrival':
        case 'departure': {
          const flightEvent = event as ArrivalDepartureEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {event.type === 'arrival' ? `Arrival at ${flightEvent.airport}` : `Departure from ${flightEvent.airport}`}
              </p>
              <p className="text-xs text-gray-500">
                {flightEvent.airline && `${flightEvent.airline}`} {flightEvent.flightNumber}
                {flightEvent.time && ` • ${flightEvent.time}`}
              </p>
              {flightEvent.terminal && (
                <p className="text-xs text-gray-500">Terminal: {flightEvent.terminal}</p>
              )}
              {flightEvent.gate && (
                <p className="text-xs text-gray-500">Gate: {flightEvent.gate}</p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        case 'stay': {
          const stayEvent = event as StayEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {stayEvent.accommodationName}
              </p>
              <p className="text-xs text-gray-500">
                Check-in: {stayEvent.date}
              </p>
              <p className="text-xs text-gray-500">
                Check-out: {stayEvent.checkOut}
              </p>
              {stayEvent.address && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {stayEvent.address}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        case 'destination': {
          const destinationEvent = event as DestinationEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {destinationEvent.placeName}
              </p>
              {destinationEvent.address && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {destinationEvent.address}
                </p>
              )}
              {destinationEvent.description && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {destinationEvent.description}
                </p>
              )}
              {destinationEvent.openingHours && (
                <p className="text-xs text-gray-500">
                  Hours: {destinationEvent.openingHours}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        case 'flight': {
          const flightEvent = event as FlightEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {flightEvent.airline || 'Flight'} {flightEvent.flightNumber || ''}
              </p>
              <p className="text-xs text-gray-500">
                {flightEvent.departureAirport || ''} to {flightEvent.arrivalAirport || ''}
              </p>
              {flightEvent.departureTime && (
                <p className="text-xs text-gray-500">
                  Departure: {flightEvent.departureTime}
                </p>
              )}
              {flightEvent.arrivalTime && (
                <p className="text-xs text-gray-500">
                  Arrival: {flightEvent.arrivalTime}
                </p>
              )}
              {flightEvent.terminal && (
                <p className="text-xs text-gray-500">
                  Terminal: {flightEvent.terminal}
                </p>
              )}
              {flightEvent.gate && (
                <p className="text-xs text-gray-500">
                  Gate: {flightEvent.gate}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        case 'train': {
          const trainEvent = event as TrainEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {trainEvent.trainOperator || 'Train'} {trainEvent.trainNumber || ''}
              </p>
              <p className="text-xs text-gray-500">
                {trainEvent.departureStation || ''} to {trainEvent.arrivalStation || ''}
              </p>
              {trainEvent.departureTime && (
                <p className="text-xs text-gray-500">
                  Departure: {trainEvent.departureTime}
                </p>
              )}
              {trainEvent.arrivalTime && (
                <p className="text-xs text-gray-500">
                  Arrival: {trainEvent.arrivalTime}
                </p>
              )}
              {trainEvent.carriageNumber && (
                <p className="text-xs text-gray-500">
                  Carriage: {trainEvent.carriageNumber}
                </p>
              )}
              {trainEvent.seatNumber && (
                <p className="text-xs text-gray-500">
                  Seat: {trainEvent.seatNumber}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        case 'rental_car': {
          const carEvent = event as RentalCarEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {carEvent.carCompany || 'Rental Car'}
              </p>
              {carEvent.carType && (
                <p className="text-xs text-gray-500">
                  {carEvent.carType}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {carEvent.pickupLocation || ''} to {carEvent.dropoffLocation || ''}
              </p>
              {carEvent.pickupTime && (
                <p className="text-xs text-gray-500">
                  Pickup: {carEvent.pickupTime}
                </p>
              )}
              {carEvent.dropoffTime && (
                <p className="text-xs text-gray-500">
                  Dropoff: {carEvent.dropoffTime}
                </p>
              )}
              {carEvent.licensePlate && (
                <p className="text-xs text-gray-500">
                  License Plate: {carEvent.licensePlate}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        case 'bus': {
          const busEvent = event as BusEvent;
          return (
            <div className="mt-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {busEvent.busOperator || 'Bus'} {busEvent.busNumber || ''}
              </p>
              <p className="text-xs text-gray-500">
                {busEvent.departureStation || ''} to {busEvent.arrivalStation || ''}
              </p>
              {busEvent.departureTime && (
                <p className="text-xs text-gray-500">
                  Departure: {busEvent.departureTime}
                </p>
              )}
              {busEvent.arrivalTime && (
                <p className="text-xs text-gray-500">
                  Arrival: {busEvent.arrivalTime}
                </p>
              )}
              {busEvent.seatNumber && (
                <p className="text-xs text-gray-500">
                  Seat: {busEvent.seatNumber}
                </p>
              )}
              {event.status === 'exploring' && renderExploringContent()}
              {event.notes && renderNotes()}
              {renderCreatorInfo(event)}
            </div>
          );
        }
        
        default:
          return null;
      }
    };

    const renderExploringContent = () => (
      <div className="mt-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVote(event.id, getUserVoteStatus(event) === 'liked' ? 'remove' : 'like');
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded ${
                getUserVoteStatus(event) === 'liked'
                  ? 'bg-green-100 text-green-800'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className="text-lg">👍</span>
              <span>{event.likes?.length || 0}</span>
            </button>
          </div>
          <div className="flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVote(event.id, getUserVoteStatus(event) === 'disliked' ? 'remove' : 'dislike');
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded ${
                getUserVoteStatus(event) === 'disliked'
                  ? 'bg-red-100 text-red-800'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className="text-lg">👎</span>
              <span>{event.dislikes?.length || 0}</span>
            </button>
          </div>
        </div>
        {((event.likes && event.likes.length > 0) || (event.dislikes && event.dislikes.length > 0)) && (
          <div className="mt-2 text-sm text-gray-500">
            <div className="flex flex-col space-y-1">
              {event.likes && event.likes.length > 0 && (
                <div className="flex items-center">
                  <span className="font-medium">Liked by:</span>
                  <span className="ml-1">{getVoterNames(event).likes.join(', ')}</span>
                </div>
              )}
              {event.dislikes && event.dislikes.length > 0 && (
                <div className="flex items-center">
                  <span className="font-medium">Disliked by:</span>
                  <span className="ml-1">{getVoterNames(event).dislikes.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );

    const renderNotes = () => (
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
        Notes: <span dangerouslySetInnerHTML={{ __html: event.notes?.replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
        ) || '' }} />
      </p>
    );

    return (
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col">
          {/* Event type header */}
          <div className="flex items-center mb-3">
            <div className="text-2xl mr-2">{getEventIcon()}</div>
            <h2 className="text-xl font-semibold text-indigo-600 capitalize">{event.type.replace('_', ' ')}</h2>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{getEventTitle()}</h3>
            <p className="text-sm text-gray-500">{event.date}</p>
            {getEventDetails()}
          </div>

          {/* Bottom section */}
          <div className="mt-4">
            {event.status === 'exploring' && renderExploringContent()}
            {event.notes && renderNotes()}
          </div>
        </div>
      </div>
    );
  };

  const sortEvents = (events: Event[]): Event[] => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
  };

  const getEventDate = (event: Event): Date => {
    return new Date(event.date);
  };

  const renderEventDetails = (event: Event) => {
    switch (event.type) {
      case 'arrival':
      case 'departure': {
        const flightEvent = event as ArrivalDepartureEvent;
        return (
          <div className="text-sm text-gray-600">
            <p>Time: {flightEvent.time}</p>
            <p>Airport: {flightEvent.airport}</p>
            {flightEvent.flightNumber && <p>Flight: {flightEvent.flightNumber}</p>}
            {flightEvent.airline && <p>Airline: {flightEvent.airline}</p>}
            {flightEvent.terminal && <p>Terminal: {flightEvent.terminal}</p>}
            {flightEvent.gate && <p>Gate: {flightEvent.gate}</p>}
            {flightEvent.bookingReference && <p>Booking Ref: {flightEvent.bookingReference}</p>}
          </div>
        );
      }
      case 'stay': {
        const stayEvent = event as StayEvent;
        return (
          <div className="text-sm text-gray-600">
            <p>Check-out: {stayEvent.checkOut}</p>
            {stayEvent.address && <p>Address: {stayEvent.address}</p>}
            {stayEvent.reservationNumber && <p>Reservation: {stayEvent.reservationNumber}</p>}
            {stayEvent.contactInfo && <p>Contact: {stayEvent.contactInfo}</p>}
          </div>
        );
      }
      case 'destination': {
        const destinationEvent = event as DestinationEvent;
        return (
          <div className="text-sm text-gray-600">
            {destinationEvent.address && <p>Address: {destinationEvent.address}</p>}
            {destinationEvent.description && <p>{destinationEvent.description}</p>}
            {destinationEvent.openingHours && <p>Hours: {destinationEvent.openingHours}</p>}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const handleLocationChange = (address: string) => {
    setEventData(prev => ({
      ...prev,
      location: prev.location ? {
        ...prev.location,
        address
      } : undefined
    }));
  };

  const eventTypeToIcon = {
    arrival: '✈️',
    departure: '✈️',
    stay: '🏨',
    destination: '📍',
    flight: '✈️',
    train: '🚂',
    rental_car: '🚗',
    bus: '🚌'
  } as const;

  const eventTypeToLabel = {
    arrival: 'Arrival',
    departure: 'Departure',
    stay: 'Stay',
    destination: 'Destination',
    flight: 'Flight',
    train: 'Train',
    rental_car: 'Rental Car',
    bus: 'Bus'
  } as const;

  return (
    <div className="max-w-full md:max-w-7xl mx-auto px-0 md:px-4 space-y-6">
      <div className="relative">
        {/* Full width thumbnail image with overlay */}
        <div className="w-full h-[300px] sm:h-[300px] md:h-[300px] relative rounded-none md:rounded-lg overflow-hidden">
          <img
            src={trip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
          
          {/* Action Buttons - Above title on mobile, to the right on larger screens */}
          <div className="absolute top-4 right-4 sm:right-6 flex sm:flex-row flex-wrap justify-end gap-2 z-20 bg-black/30 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none rounded-full p-1.5 sm:p-0">
            {canEdit && (
              <button
                onClick={() => setIsEditingTrip(true)}
                className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
                title="Edit Trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
            
            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
                title="Export Trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 001.414 0L9 10.586V3a1 1 0 102 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-xl z-[100]">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                      Only confirmed events will be exported
                    </div>
                    <button
                      onClick={handleExportHTML}
                      className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Printable Itinerary
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Collaborators button */}
              <button
                onClick={() => setIsCollaboratorModalOpen(true)}
              className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Collaborators"
              >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              </button>
            
            {/* Leave/Delete Trip button */}
            {isOwner ? (
              <button
                onClick={() => setIsDeleteWarningOpen(true)}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-md transition-colors"
                title="Delete Trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setIsLeaveWarningOpen(true)}
                className="p-2 bg-yellow-500 hover:bg-yellow-600 rounded-full text-white shadow-md transition-colors"
                title="Leave Trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
        </div>
          
          {/* Trip Title - Responsive positioning */}
          <div className="absolute top-[calc(4rem+8px)] sm:top-4 left-4 sm:left-6 z-20 max-w-[calc(100%-32px)] sm:max-w-[calc(100%-120px)]">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate">{trip.name}</h1>
            {trip.description && (
              <p className="mt-2 text-lg text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {trip.description.split(' ').map((word, index) => {
                  // Check if the word is a URL
                  if (word.match(/^https?:\/\/\S+$/)) {
                    return (
                      <a
                        key={index}
                        href={word}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-200 hover:text-white hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {word}{' '}
                      </a>
                    );
                  }
                  return word + ' ';
                })}
              </p>
            )}
          </div>

          {/* Owner and Collaborator Avatars - Keep at bottom right */}
          <div className="absolute bottom-6 right-4 sm:right-6 flex -space-x-3 z-10">
            {/* Owner Avatar */}
            {trip.owner._id !== user?._id && (
              <div className="relative group">
                <Avatar
                  photoUrl={trip.owner.photoUrl || null}
                  name={trip.owner.name}
                  size="md"
                  className="ring-2 ring-white"
                />
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {trip.owner.name} • Owner
            </div>
              </div>
            )}
            {/* Collaborator Avatars */}
            {trip.collaborators
              .filter(collaborator => collaborator.user._id !== user?._id)
              .map((collaborator) => {
                // Force the role to be a string
                const roleDisplay = String(collaborator.role || 'Viewer');
                
                return (
                  <div key={collaborator.user._id} className="relative group">
                    <Avatar
                      photoUrl={collaborator.user.photoUrl || null}
                      name={collaborator.user.name}
                      size="md"
                      className="ring-2 ring-white"
                    />
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {collaborator.user.name} • {roleDisplay}
          </div>
        </div>
                );
              })}
            </div>
          
          {/* Shared trip info - Keep for non-owners */}
          {user && trip.owner._id !== user._id && (
            <div className="absolute top-[calc(8rem+8px)] sm:top-16 right-4 z-10">
              <div className="flex flex-col items-end gap-2 bg-black/40 backdrop-blur-sm p-3 rounded-lg">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white text-indigo-700 shadow-sm">
                Shared
              </span>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm font-medium text-white">
                    {trip.collaborators.find(c => c.user._id === user._id)?.role === 'editor' 
                      ? 'You can edit this trip' 
                      : 'You can view this trip'}
                  </span>
                  <div className="flex gap-2">
                    {trip.collaborators.length > 0 && (
                      <Link
                        to={`/trips/${trip._id}/activity-log`}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-colors duration-200 shadow-sm"
                      >
                        Activity Log
                      </Link>
            )}
          </div>
        </div>
              </div>
            </div>
          )}
      </div>

        {/* Events and Map section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-20 mt-4">
      {/* Events list */}
          <div className="bg-white shadow rounded-none md:rounded-lg flex flex-col h-[700px]">
            <div className="px-4 py-5 sm:px-6 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Events</h3>
                <div className="flex items-center space-x-2">
                  {canEdit && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Add Event
                    </button>
                  )}
        </div>
              </div>
            </div>
            
            {/* Status filter tabs - updated to be full width */}
            <div className="mt-4 border-b border-gray-200">
              <div className="flex w-full">
                <button
                  onClick={() => setEventStatusFilter('confirmed')}
                  className={`flex-1 text-center py-3 ${
                    eventStatusFilter === 'confirmed'
                      ? 'border-b-2 border-blue-500 text-blue-600 font-medium'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Confirmed
                </button>
                <button
                  onClick={() => setEventStatusFilter('exploring')}
                  className={`flex-1 text-center py-3 ${
                    eventStatusFilter === 'exploring'
                      ? 'border-b-2 border-green-500 text-green-600 font-medium'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Exploring
                </button>
              </div>
            </div>
            
            <div className="border-t border-gray-200 flex-1 overflow-auto">
              {(() => {
                // Fix the filtering logic to only show events with the selected status
                const filteredEvents = trip.events
                  .filter(event => {
                    // Use the event status or default to 'confirmed'
                    const status = (event.status || 'confirmed') as 'confirmed' | 'exploring';
                    return status === eventStatusFilter;
                  });
                
                // Sort events by date
                const sortedEvents = sortEvents(filteredEvents);
                
                // Group events by date
                const eventsByDate: Record<string, Event[]> = {};
                
                sortedEvents.forEach(event => {
                  // Get the date string (YYYY-MM-DD) for grouping
                  const eventDate = getEventDate(event);
                  const dateString = event.date.split('T')[0];
                  
                  if (!eventsByDate[dateString]) {
                    eventsByDate[dateString] = [];
                  }
                  
                  eventsByDate[dateString].push(event);
                });
                
                // Convert to array of [dateString, events] pairs and sort by date
                const groupedEventEntries = Object.entries(eventsByDate)
                  .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime());
                
                return (
                  <div>
                    {groupedEventEntries.map(([dateString, events]) => (
                      <div key={dateString}>
                        {/* Date header */}
                        <div className="sticky top-0 z-[5] bg-indigo-50 px-4 py-3 border-b border-indigo-100 shadow-sm">
                          <h3 className="text-sm font-medium text-indigo-800 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {(() => {
                              // Create a date object with the time set to noon to avoid timezone issues
                              const [year, month, day] = dateString.split('-').map(Number);
                              const date = new Date(year, month - 1, day, 12);
                              return date.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'long', 
                              day: 'numeric'
                              });
                            })()}
                          </h3>
                        </div>
                        
                        {/* Events for this date */}
          <ul className="divide-y divide-gray-200">
                          {events.map((event) => (
                            <li 
                              key={event.id} 
                              className="px-4 py-3 sm:px-6 relative bg-white cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                              onClick={(e) => toggleEventExpansion(event.id, e)}
                              style={{
                                opacity: 1,
                                borderStyle: statusMenuOpen === event.id ? 'dashed' : 'solid',
                                borderWidth: statusMenuOpen === event.id ? '1px' : '0px',
                                borderColor: statusMenuOpen === event.id ? '#6366F1' : 'transparent',
                                zIndex: statusMenuOpen === event.id ? 10 : 'auto'
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className="flex-shrink-0">
                                  <img
                                    src={event.thumbnailUrl || eventThumbnails[event.id] || DEFAULT_THUMBNAILS[event.type]}
                                    alt={event.type}
                                    className="h-20 w-20 object-cover rounded-lg"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = DEFAULT_THUMBNAILS[event.type];
                                    }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      {(() => {
                                        switch (event.type) {
                                          case 'arrival':
                                          case 'departure':
                                            return <span className="text-2xl">✈️</span>;
                                          case 'stay':
                                            return <span className="text-2xl">🏨</span>;
                                          case 'destination':
                                            return <span className="text-2xl">📍</span>;
                                          case 'flight':
                                            return <span className="text-2xl">✈️</span>;
                                          case 'train':
                                            return <span className="text-2xl">🚂</span>;
                                          case 'rental_car':
                                            return <span className="text-2xl">🚗</span>;
                                          case 'bus':
                                            return <span className="text-2xl">🚌</span>;
                                          default:
                                            return <span className="text-2xl">📅</span>;
                                        }
                                      })()}
                                      <p className="text-base font-semibold text-indigo-600 capitalize">
                                        {event.type.replace('_', ' ')}
                    </p>
                  </div>
                                    {canEdit && (
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(event.id, event.status === 'confirmed' ? 'exploring' : 'confirmed');
                                          }}
                                          className={`transition-colors ${
                                            event.status === 'confirmed'
                                              ? 'text-green-600 hover:text-green-900'
                                              : 'text-yellow-600 hover:text-yellow-900'
                                          }`}
                                          title={event.status === 'confirmed' ? 'Mark as Exploring' : 'Mark as Confirmed'}
                                        >
                                          {event.status === 'confirmed' ? (
                                            <span className="text-base">🤔</span>
                                          ) : (
                                            <span className="text-base">✅</span>
                                          )}
                                        </button>
                                          <button
                                            onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditEvent(event);
                                            }}
                                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                          title="Edit Event"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                          </button>
                                                <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (trip._id) {
                                              setEventToDelete(event.id);
                                              setIsDeleteEventWarningOpen(true);
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-900 transition-colors"
                                          title="Delete Event"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Main content - always visible */}
                                    <div className="mt-1">
                                    <p className="text-sm font-medium text-gray-900">
                                    {(() => {
                                      switch (event.type) {
                                          case 'arrival':
                                          case 'departure':
                                            return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${(event as ArrivalDepartureEvent).airport}`;
                                          case 'stay':
                                            return (event as StayEvent).accommodationName;
                                          case 'destination':
                                            return (event as DestinationEvent).placeName;
                                          case 'flight': {
                                            const e = event as FlightEvent;
                                            return `${e.departureAirport || ''} to ${e.arrivalAirport || ''}`;
                                          }
                                          case 'train': {
                                            const e = event as TrainEvent;
                                            return `${e.departureStation || ''} to ${e.arrivalStation || ''}`;
                                          }
                                          case 'rental_car': {
                                            const e = event as RentalCarEvent;
                                            return `${e.pickupLocation || ''} to ${e.dropoffLocation || ''}`;
                                          }
                                          case 'bus': {
                                            const e = event as BusEvent;
                                            return `${e.departureStation || ''} to ${e.arrivalStation || ''}`;
                                          }
                                          default:
                                            return 'Event';
                                        }
                                      })()}
                                    </p>
                                    {event.type === 'rental_car' && (
                                      <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className="font-medium">{(event as RentalCarEvent).carCompany || 'Rental Car'}</span>
                                        {(event as RentalCarEvent).carType && (
                                          <>
                                            <span>•</span>
                                            <span>{(event as RentalCarEvent).carType}</span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                    <div 
                                      className="mt-2 w-full flex items-center text-sm text-gray-500 border-t border-gray-100 pt-2"
                                      title={expandedEvents.has(event.id) ? "Show less" : "Show more details"}
                                    >
                                      {event.status === 'exploring' && (
                                        <div className="flex items-center gap-2 mr-auto">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleVote(event.id, 'like');
                                            }}
                                            className={`text-sm transition-colors ${
                                              event.likes?.includes(user?._id || '') ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-green-600'
                                            }`}
                                            title="Vote Up"
                                          >
                                            <span className="text-base">⬆️</span>
                                            <span className="ml-1 text-xs">{event.likes?.length || 0}</span>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleVote(event.id, 'dislike');
                                            }}
                                            className={`text-sm transition-colors ${
                                              event.dislikes?.includes(user?._id || '') ? 'text-red-600 hover:text-red-700' : 'text-gray-400 hover:text-red-600'
                                            }`}
                                            title="Vote Down"
                                          >
                                            <span className="text-base">⬇️</span>
                                            <span className="ml-1 text-xs">{event.dislikes?.length || 0}</span>
                                          </button>
                                        </div>
                                      )}
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleEventExpansion(event.id, e);
                                        }}
                                        className="text-base cursor-pointer hover:text-gray-700 transition-colors tracking-widest select-none text-gray-300"
                                      >
                                        •••
                                      </span>
                                    </div>
                                  </div>

                                  {/* Expanded content */}
                                  {expandedEvents.has(event.id) && (
                                    <>
                                      {(() => {
                                        switch (event.type) {
                                          case 'arrival':
                                        case 'departure': {
                                            const e = event as ArrivalDepartureEvent;
                                          return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                {e.time && <p>Time: {e.time}</p>}
                                                {e.airline && <p>Airline: {e.airline}</p>}
                                                {e.flightNumber && <p>Flight: {e.flightNumber}</p>}
                                                {e.terminal && <p>Terminal: {e.terminal}</p>}
                                                {e.gate && <p>Gate: {e.gate}</p>}
                                              </div>
                                          );
                                        }
                                        case 'stay': {
                                            const e = event as StayEvent;
                                        return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                <p>Check-out: {e.checkOut}</p>
                                                {e.address && <p>Address: {e.address}</p>}
                                              </div>
                                          );
                                        }
                                        case 'destination': {
                                            const e = event as DestinationEvent;
                                          return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                {e.address && <p>Address: {e.address}</p>}
                                                {e.description && <p>{e.description}</p>}
                                              </div>
                                            );
                                          }
                                          case 'flight': {
                                            const e = event as FlightEvent;
                                            return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                {e.airline && <p>Airline: {e.airline}</p>}
                                                {e.flightNumber && <p>Flight: {e.flightNumber}</p>}
                                                {e.departureTime && <p>Departure: {e.departureTime}</p>}
                                                {e.arrivalTime && <p>Arrival: {e.arrivalTime}</p>}
                                                {e.terminal && <p>Terminal: {e.terminal}</p>}
                                                {e.gate && <p>Gate: {e.gate}</p>}
                                                {e.bookingReference && <p>Booking Ref: {e.bookingReference}</p>}
                                              </div>
                                            );
                                          }
                                          case 'train': {
                                            const e = event as TrainEvent;
                                            return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                {e.trainOperator && <p>Operator: {e.trainOperator}</p>}
                                                {e.trainNumber && <p>Train: {e.trainNumber}</p>}
                                                {e.departureTime && <p>Departure: {e.departureTime}</p>}
                                                {e.arrivalTime && <p>Arrival: {e.arrivalTime}</p>}
                                                {e.carriageNumber && <p>Carriage: {e.carriageNumber}</p>}
                                                {e.seatNumber && <p>Seat: {e.seatNumber}</p>}
                                              </div>
                                            );
                                          }
                                          case 'rental_car': {
                                            const e = event as RentalCarEvent;
                                            return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                {e.carType && <p>Car Type: {e.carType}</p>}
                                                {e.pickupTime && <p>Pickup Time: {e.pickupTime}</p>}
                                                {e.dropoffTime && <p>Dropoff Time: {e.dropoffTime}</p>}
                                                {e.licensePlate && <p>License Plate: {e.licensePlate}</p>}
                                                {e.bookingReference && <p>Booking Ref: {e.bookingReference}</p>}
                                              </div>
                                          );
                                        }
                                        case 'bus': {
                                          const e = event as BusEvent;
                                          return (
                                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                                              {e.busOperator && <p>Operator: {e.busOperator}</p>}
                                              {e.busNumber && <p>Bus: {e.busNumber}</p>}
                                              {e.departureTime && <p>Departure: {e.departureTime}</p>}
                                              {e.arrivalTime && <p>Arrival: {e.arrivalTime}</p>}
                                              {e.seatNumber && <p>Seat: {e.seatNumber}</p>}
                                            </div>
                                          );
                                        }
                                        default:
                                          return null;
                                      }
                                    })()}

                                      {event.status === 'exploring' && (
                                        <div className="mt-2">
                                          <div className="flex items-center space-x-4">
                                            <div className="flex items-center">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleVote(event.id, getUserVoteStatus(event) === 'liked' ? 'remove' : 'like');
                                                }}
                                                className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                                  getUserVoteStatus(event) === 'liked'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'hover:bg-gray-100 text-gray-600'
                                                }`}
                                              >
                                                <span className="text-lg">👍</span>
                                                <span>{event.likes?.length || 0}</span>
                                              </button>
                                            </div>
                                            <div className="flex items-center">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleVote(event.id, getUserVoteStatus(event) === 'disliked' ? 'remove' : 'dislike');
                                                }}
                                                className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                                  getUserVoteStatus(event) === 'disliked'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'hover:bg-gray-100 text-gray-600'
                                                }`}
                                              >
                                                <span className="text-lg">👎</span>
                                                <span>{event.dislikes?.length || 0}</span>
                                              </button>
                                            </div>
                                          </div>
                                          {((event.likes && event.likes.length > 0) || (event.dislikes && event.dislikes.length > 0)) && (
                                            <div className="mt-2 text-sm text-gray-500">
                                              <div className="flex flex-col space-y-1">
                                                {event.likes && event.likes.length > 0 && (
                                                  <div className="flex items-center">
                                                    <span className="font-medium">Liked by:</span>
                                                    <span className="ml-1">{getVoterNames(event).likes.join(', ')}</span>
                                                  </div>
                                                )}
                                                {event.dislikes && event.dislikes.length > 0 && (
                                                  <div className="flex items-center">
                                                    <span className="font-medium">Disliked by:</span>
                                                    <span className="ml-1">{getVoterNames(event).dislikes.join(', ')}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {event.notes && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        Notes: <span dangerouslySetInnerHTML={{ __html: event.notes?.replace(
                                            /(https?:\/\/[^\s]+)/g,
                                            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                        ) || '' }} />
                                        </p>
                                      )}

                                          <div className="flex items-center justify-between mt-2 border-t pt-2 border-gray-100">
                                      <div className="flex items-center space-x-2">
                                                <Avatar
                                          photoUrl={getCreatorInfo(event.createdBy)?.photoUrl || null}
                                          name={getCreatorInfo(event.createdBy)?.name || "Unknown"}
                                                  size="sm"
                                                  className="ring-2 ring-white"
                                                />
                                        <span className="text-sm text-gray-600">
                                          {getCreatorInfo(event.createdBy)?.name || "Unknown"}
                                        </span>
                                                  </div>
                                                </div>
                                    </>
                                  )}
                                </div>
                </div>
              </li>
            ))}
          </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
        </div>
      </div>

          {/* Map view */}
          <div className="bg-white shadow rounded-none md:rounded-lg h-[700px] flex flex-col" style={{ zIndex: 0 }}>
            <div className="px-4 py-5 sm:px-6 flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">Trip Map</h3>
            </div>
            <div className="border-t border-gray-200 flex-1">
              <div className="h-full">
                {mapTripData && <TripMap trip={mapTripData} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {isEditingEvent ? 'Edit Event' : 'Add Event'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsEditingEvent(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => handleEventTypeChange(e.target.value as EventType)}
                  className="input"
                >
                  <option value="arrival">Arrival</option>
                  <option value="departure">Departure</option>
                  <option value="stay">Stay</option>
                  <option value="destination">Destination</option>
                  <option value="flight">Flight</option>
                  <option value="train">Train</option>
                  <option value="rental_car">Rental Car</option>
                  <option value="bus">Bus</option>
                </select>
              </div>

              {renderEventForm()}

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsEditingEvent(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditingEvent ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trip Modal */}
      {isEditingTrip && editedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold">Edit Trip</h3>
              <button
                onClick={() => setIsEditingTrip(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview current thumbnail */}
            <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-gray-100 mb-3 h-32">
              <img
                src={editedTrip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
                alt={editedTrip.name}
                className="object-cover w-full h-full"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-700 mb-1 text-sm">Trip Name</label>
                <input
                  type="text"
                  value={editedTrip.name}
                  onChange={(e) => setEditedTrip({ ...editedTrip, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Enter trip name"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 text-sm">Thumbnail URL</label>
                <input
                  type="url"
                  value={editedTrip.thumbnailUrl || ''}
                  onChange={(e) => setEditedTrip({ ...editedTrip, thumbnailUrl: e.target.value })}
                  className="input"
                  placeholder="Enter image URL (optional)"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 text-sm">Description</label>
                <textarea
                  value={editedTrip.description || ''}
                  onChange={(e) => setEditedTrip({ ...editedTrip, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Enter trip description (optional)"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditingTrip(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTripSave}
                className="btn btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Trip Warning Modal */}
      {isLeaveWarningOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-xl font-semibold text-gray-900">Leave Trip</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to leave this trip? You will lose access to all trip details and will need a new invitation to rejoin.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsLeaveWarningOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveWarningOpen(false);
                  handleLeaveTrip();
                }}
                className="btn btn-danger"
              >
                Leave Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Warning Modal */}
      {isDeleteEventWarningOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Event</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteEventWarningOpen(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => eventToDelete && handleDeleteEvent(eventToDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator and Share Modals */}
      <div style={{ zIndex: 1000 }}>
      <CollaboratorModal
          trip={{
            ...trip,
            _id: trip._id || id || ''
          }}
        isOpen={isCollaboratorModalOpen}
        onClose={() => setIsCollaboratorModalOpen(false)}
        onUpdate={handleTripUpdate}
      />
      <ShareModal
        trip={trip}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onUpdate={handleTripUpdate}
      />
      </div>

      {/* Delete Trip Warning Modal */}
      {isDeleteWarningOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Delete Trip</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this trip? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsDeleteWarningOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrip}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripDetails; 