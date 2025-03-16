import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Trip, Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import '../styles/TripDetails.css';
import CollaboratorModal from './CollaboratorModal';
import ShareModal from './ShareModal';
import TripMap from './TripMap';
import Avatar from './Avatar';

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

const DEFAULT_THUMBNAILS = {
  arrival: 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300',
  departure: 'https://images.pexels.com/photos/723240/pexels-photo-723240.jpeg?auto=compress&cs=tinysrgb&w=300',
  stay: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=300',
  destination: 'https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=300'
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
      searchTerm = (event as StayEvent).accommodationName;
      break;
    case 'destination':
      searchTerm = (event as DestinationEvent).placeName;
      break;
    case 'arrival':
    case 'departure':
      searchTerm = (event as ArrivalDepartureEvent).airport;
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
  const [eventType, setEventType] = useState<EventType>('arrival');
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState<string | null>(null);
  const [editedTrip, setEditedTrip] = useState<Trip | null>(null);
  const [tripThumbnail, setTripThumbnail] = useState<string>('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | 'confirmed' | 'exploring' | 'alternative'>('all');
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [eventData, setEventData] = useState({
    thumbnailUrl: '',
    date: '',
    location: '',
    notes: '',
    status: 'confirmed' as 'confirmed' | 'exploring' | 'alternative',
    priority: 3,
    source: '',
    // Arrival/Departure fields
    flightNumber: '',
    airline: '',
    time: '',
    airport: '',
    terminal: '',
    gate: '',
    bookingReference: '',
    // Stays fields
    accommodationName: '',
    address: '',
    checkIn: '',
    checkOut: '',
    reservationNumber: '',
    contactInfo: '',
    // Destinations fields
    placeName: '',
    description: '',
    openingHours: '',
  });
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [airportSuggestions, setAirportSuggestions] = useState<Array<{name: string, iata: string}>>([]);
  const [showAirportSuggestions, setShowAirportSuggestions] = useState(false);
  const airportInputRef = useRef<HTMLInputElement>(null);
  const [eventThumbnails, setEventThumbnails] = useState<{ [key: string]: string }>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
          console.log('EVENT CREATOR CHECK - All events:', fetchedTrip.events.map(event => ({
            eventId: event.id,
            eventType: event.type,
            createdBy: event.createdBy,
            hasCreator: !!event.createdBy,
            creatorHasPhotoUrl: event.createdBy ? !!event.createdBy.photoUrl : false
          })));
          
          // Count events with creators
          const eventsWithCreators = fetchedTrip.events.filter(event => !!event.createdBy);
          console.log(`EVENT CREATOR CHECK - ${eventsWithCreators.length} out of ${fetchedTrip.events.length} events have creator information`);
          
          if (eventsWithCreators.length > 0) {
            // Log details of the first event with a creator
            const sampleEvent = eventsWithCreators[0];
            console.log('EVENT CREATOR CHECK - Sample event with creator:', {
              eventId: sampleEvent.id,
              eventType: sampleEvent.type,
              creatorId: sampleEvent.createdBy?._id,
              creatorName: sampleEvent.createdBy?.name,
              creatorEmail: sampleEvent.createdBy?.email,
              creatorPhotoUrl: sampleEvent.createdBy?.photoUrl,
              fullCreatorObject: sampleEvent.createdBy
            });
          }
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
      if (trip && !trip.thumbnailUrl) {
        const thumbnail = await getDefaultThumbnail(trip.name);
        setTripThumbnail(thumbnail);
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
      const tripCopy = JSON.parse(JSON.stringify(updatedTrip));
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
        setTrip(latestTrip);
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
    
    return {
      _id: trip._id,
      name: trip.name,
      events: trip.events,
      // Include required Trip properties but with minimal data
      owner: trip.owner,
      collaborators: [], // Empty array since collaborators aren't needed for the map
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic,
      description: trip.description,
      thumbnailUrl: trip.thumbnailUrl,
      shareableLink: trip.shareableLink
    };
  }, [trip?._id, trip?.name, trip?.events, trip?.owner]);

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
    try {
      if (!trip?._id) return;
      await api.exportTripAsHTML(trip._id);
      setShowExportMenu(false);
    } catch (error) {
      setError('Failed to export trip as HTML');
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: 'confirmed' | 'exploring' | 'alternative') => {
    if (!trip || !trip._id) return;
    
    try {
      const eventToUpdate = trip.events.find(e => e.id === eventId);
      if (!eventToUpdate) return;
      
      // Create a complete updated event object with the new status
      const updatedEvent = { 
        ...eventToUpdate, 
        status: newStatus 
      };
      
      console.log('Updating event status:', { 
        eventId, 
        oldStatus: eventToUpdate.status, 
        newStatus,
        updatedEvent
      });
      
      // Update the event in the backend
      await updateEvent(trip._id, updatedEvent);
      
      // Update the local state
      const updatedTrip = { 
        ...trip, 
        events: trip.events.map(e => e.id === eventId ? updatedEvent : e) 
      };
    setTrip(updatedTrip);
      
      // Also update the edited trip state to ensure consistency
      setEditedTrip(updatedTrip);
      
      // Verify the update was successful by refetching the trip
      const refreshedTrip = await api.getTrip(trip._id);
      if (refreshedTrip) {
        console.log('Refreshed trip after status update:', refreshedTrip);
        // Check if the status was properly updated
        const updatedEventInRefresh = refreshedTrip.events.find(e => e.id === eventId);
        if (updatedEventInRefresh && updatedEventInRefresh.status !== newStatus) {
          console.warn('Status not updated correctly in backend:', {
            expected: newStatus,
            actual: updatedEventInRefresh.status
          });
        }
      }
      
      setStatusMenuOpen(null);
    } catch (err) {
      console.error('Error updating event status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update event status');
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
    setEditedTrip(trip);
    setIsEditingTrip(true);
  };

  const handleTripSave = async () => {
    if (!trip?._id || !editedTrip) {
      setError('Trip data is missing');
      return;
    }

    try {
      const updatedTrip = await api.updateTrip(editedTrip);
      setTrip(updatedTrip);
      setIsEditingTrip(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let newEvent: Event;

    // Ensure status has a default value if not provided
    const status = eventData.status || 'confirmed';

    // Add creator information
    const creatorInfo = user ? {
      _id: user._id,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl || null
    } : undefined;

    const baseEventData = {
      id: isEditingEvent || uuidv4(),
      type: eventType,
      thumbnailUrl: ['stay', 'destination'].includes(eventType) ? eventData.thumbnailUrl : '',
      date: eventData.date,
      location: eventData.location || undefined,
      notes: eventData.notes || undefined,
      status: status,
      priority: eventData.priority,
      source: eventData.source || undefined,
      createdBy: creatorInfo,
      updatedBy: creatorInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Creating/updating event with data:', {
      isEditingEvent,
      eventType,
      status,
      baseEventData
    });

    switch (eventType) {
      case 'arrival':
      case 'departure':
        newEvent = {
          ...baseEventData,
          type: eventType,
          flightNumber: eventData.flightNumber,
          airline: eventData.airline,
          time: eventData.time,
          airport: eventData.airport,
          terminal: eventData.terminal || undefined,
          gate: eventData.gate || undefined,
          bookingReference: eventData.bookingReference || undefined
        };
        break;
      case 'stay':
        newEvent = {
          ...baseEventData,
          type: 'stay',
          accommodationName: eventData.accommodationName,
          address: eventData.address,
          checkIn: eventData.checkIn,
          checkOut: eventData.checkOut,
          reservationNumber: eventData.reservationNumber || undefined,
          contactInfo: eventData.contactInfo || undefined
        };
        break;
      case 'destination':
        newEvent = {
          ...baseEventData,
          type: 'destination',
          placeName: eventData.placeName,
          address: eventData.address,
          description: eventData.description,
          openingHours: eventData.openingHours || undefined
        };
        break;
      default:
        return;
    }

    try {
      if (isEditingEvent) {
        if (!trip._id) {
          setError('Trip ID is missing');
          return;
        }
        console.log('Updating event with ID:', newEvent.id, 'Status:', newEvent.status);
        await updateEvent(trip._id, newEvent);
        
        // Update local state
        const updatedTrip = { ...trip, events: trip.events.map(e => e.id === newEvent.id ? newEvent : e) };
        setTrip(updatedTrip);
        
        // Also update editedTrip to ensure consistency
        setEditedTrip(updatedTrip);
        
        // Verify the update was successful
        const refreshedTrip = await api.getTrip(trip._id);
        if (refreshedTrip) {
          console.log('Refreshed trip after event update:', refreshedTrip);
          // Check if the event was properly updated
          const updatedEventInRefresh = refreshedTrip.events.find(e => e.id === newEvent.id);
          if (updatedEventInRefresh) {
            console.log('Updated event in refreshed trip:', updatedEventInRefresh);
            if (updatedEventInRefresh.status !== newEvent.status) {
              console.warn('Status not updated correctly in backend:', {
                expected: newEvent.status,
                actual: updatedEventInRefresh.status
              });
            }
          }
        }
      } else {
        if (!trip._id) {
          setError('Trip ID is missing');
          return;
        }
        console.log('Adding new event with status:', newEvent.status);
        await addEvent(trip._id, newEvent);
        
        // Update local state
        const updatedTrip = { ...trip, events: [...trip.events, newEvent] };
        setTrip(updatedTrip);
        
        // Also update editedTrip to ensure consistency
        setEditedTrip(updatedTrip);
      }
      
      setIsModalOpen(false);
      setIsEditingEvent(null);
      setEventData({
        thumbnailUrl: '',
        date: '',
        location: '',
        notes: '',
        status: 'confirmed',
        priority: 3,
        source: '',
        flightNumber: '',
        airline: '',
        time: '',
        airport: '',
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleEditEvent = (eventId: string) => {
    if (!trip) return;
    
    setIsEditingEvent(eventId);
    setIsModalOpen(true); // Add this line to open the modal
    const eventToEdit = trip.events.find(e => e.id === eventId);
    if (!eventToEdit) return;
    
    setEventType(eventToEdit.type);
    
    // Set common fields
    setEventData(prev => ({
      ...prev,
      thumbnailUrl: eventToEdit.thumbnailUrl || '',
      date: eventToEdit.date || '',
      location: eventToEdit.location || '',
      notes: eventToEdit.notes || '',
      status: eventToEdit.status || 'confirmed',
      priority: eventToEdit.priority || 3,
      source: eventToEdit.source || '',
    }));
    
    // Set type-specific fields
    switch (eventToEdit.type) {
      case 'arrival':
      case 'departure': {
        const event = eventToEdit as ArrivalDepartureEvent;
        setEventData(prev => ({
          ...prev,
          flightNumber: event.flightNumber || '',
          airline: event.airline || '',
          time: event.time || '',
          airport: event.airport || '',
          terminal: event.terminal || '',
          gate: event.gate || '',
          bookingReference: event.bookingReference || '',
        }));
        break;
      }
      case 'stay': {
        const event = eventToEdit as StayEvent;
        setEventData(prev => ({
          ...prev,
          accommodationName: event.accommodationName || '',
          address: event.address || '',
          checkIn: event.checkIn || '',
          checkOut: event.checkOut || '',
          reservationNumber: event.reservationNumber || '',
          contactInfo: event.contactInfo || '',
        }));
        break;
      }
      case 'destination': {
        const event = eventToEdit as DestinationEvent;
        setEventData(prev => ({
          ...prev,
          placeName: event.placeName || '',
          address: event.address || '',
          description: event.description || '',
          openingHours: event.openingHours || '',
        }));
        break;
      }
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
      priority: eventData.priority,
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
            type="datetime-local"
            value={eventData.date}
            onChange={(e) =>
              setEventData({ ...eventData, date: e.target.value })
            }
            className="input"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Status</label>
          <select
            value={eventData.status}
            onChange={(e) =>
              setEventData({ ...eventData, status: e.target.value as 'confirmed' | 'exploring' | 'alternative' })
            }
            className="input"
          >
            <option value="confirmed">Confirmed</option>
            <option value="exploring">Exploring</option>
            <option value="alternative">Alternative</option>
          </select>
        </div>
        {eventData.status === 'exploring' && (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Priority (1-5)</label>
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEventData({ ...eventData, priority: star })}
                    className={`text-2xl ${
                      star <= eventData.priority ? 'text-yellow-500' : 'text-gray-300'
                    } focus:outline-none`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Source (optional)</label>
              <input
                type="text"
                value={eventData.source}
                onChange={(e) =>
                  setEventData({ ...eventData, source: e.target.value })
                }
                className="input"
                placeholder="Where did you find this idea?"
              />
            </div>
          </>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Location (optional)</label>
          <input
            type="text"
            value={eventData.location}
            onChange={(e) =>
              setEventData({ ...eventData, location: e.target.value })
            }
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
                required
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
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-in</label>
              <input
                type="datetime-local"
                value={eventData.checkIn}
                onChange={(e) =>
                  setEventData({ ...eventData, checkIn: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-out</label>
              <input
                type="datetime-local"
                value={eventData.checkOut}
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
                value={eventData.location}
                onChange={(e) =>
                  setEventData({ ...eventData, location: e.target.value })
                }
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
            
            {/* Share button */}
              <button
                onClick={() => setIsShareModalOpen(true)}
              className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Share Trip"
              >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              </button>
            
            {/* Add Event button - Only for users who can edit */}
            {canEdit && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full text-white shadow-md transition-colors"
                title="Add Event"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            {/* Leave/Delete Trip button */}
            {isOwner ? (
              <button
                onClick={() => setIsLeaveWarningOpen(true)}
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
                className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-md transition-colors"
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
                  <div className="relative">
                    <select
                      value={eventStatusFilter}
                      onChange={(e) => setEventStatusFilter(e.target.value as 'all' | 'confirmed' | 'exploring' | 'alternative')}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="all">All Events</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="exploring">Exploring</option>
                      <option value="alternative">Alternative</option>
                    </select>
        </div>
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
            <div className="border-t border-gray-200 flex-1 overflow-auto">
              {(() => {
                // Filter events based on status filter
                const filteredEvents = trip.events
                  .filter(event => eventStatusFilter === 'all' || event.status === eventStatusFilter || (eventStatusFilter === 'confirmed' && !event.status));
                
                // Sort events by date
                const sortedEvents = filteredEvents.sort((a, b) => {
                  const dateA = a.type === 'stay' ? new Date((a as StayEvent).checkIn).getTime() : new Date(a.date).getTime();
                  const dateB = b.type === 'stay' ? new Date((b as StayEvent).checkIn).getTime() : new Date(b.date).getTime();
                  return dateA - dateB;
                });
                
                // Group events by date
                const eventsByDate: Record<string, Event[]> = {};
                
                sortedEvents.forEach(event => {
                  // Get the date string (YYYY-MM-DD) for grouping
                  const eventDate = event.type === 'stay' 
                    ? new Date((event as StayEvent).checkIn) 
                    : new Date(event.date);
                  
                  const dateString = eventDate.toISOString().split('T')[0];
                  
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
                        <div className="sticky top-0 z-10 bg-indigo-50 px-4 py-3 border-b border-indigo-100 shadow-sm">
                          <h3 className="text-sm font-medium text-indigo-800 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(dateString).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'long', 
                              day: 'numeric'
                            })}
                          </h3>
                        </div>
                        
                        {/* Events for this date */}
                        <ul className="divide-y divide-gray-200">
                          {events.map((event) => (
                            <li 
                              key={event.id} 
                              className={`px-4 py-3 sm:px-6 relative ${
                                event.status === 'exploring' ? 'bg-green-50 border-l-4 border-green-300' : 
                                event.status === 'alternative' ? 'bg-purple-50 border-l-4 border-purple-300' : 
                                'bg-white'
                              }`}
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
                                    <div className="flex items-center space-x-2">
                                      <p className="text-sm font-medium text-indigo-600 capitalize">
                                        {event.type}
                                      </p>
                                      {event.status && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          event.status === 'confirmed' ? 'bg-blue-50 text-blue-700' :
                                          event.status === 'exploring' ? 'bg-green-50 text-green-700' :
                                          'bg-purple-50 text-purple-700'
                                        }`}>
                                          {event.status === 'confirmed' ? '✓ Confirmed' :
                                           event.status === 'exploring' ? '🔍 Exploring' :
                                           '⟳ Alternative'}
                                        </span>
                                      )}
                                    </div>
                                    {canEdit && (
                                      <div className="flex space-x-2 ml-2">
                                        <button
                                          onClick={() => handleEditEvent(event.id)}
                                          className="p-1.5 bg-white/90 hover:bg-white rounded-full text-indigo-600 hover:text-indigo-900 shadow-sm transition-colors"
                                          title="Edit Event"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                          </svg>
                                        </button>
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation(); // Prevent event bubbling
                                              setStatusMenuOpen(statusMenuOpen === event.id ? null : event.id);
                                            }}
                                            className="p-1.5 bg-white/90 hover:bg-white rounded-full text-indigo-600 hover:text-indigo-900 shadow-sm transition-colors"
                                            title="Change Status"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                          {statusMenuOpen === event.id && (
                                            <div 
                                              className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl z-[999]"
                                              ref={statusMenuRef}
                                              style={{ 
                                                position: 'absolute', 
                                                zIndex: 999,
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                              }}
                                            >
                                              <div className="py-1">
                                                <button
                                                  onClick={() => handleStatusChange(event.id, 'confirmed')}
                                                  className={`block w-full text-left px-4 py-2 text-sm ${event.status === 'confirmed' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                                >
                                                  ✓ Confirmed
                                                </button>
                                                <button
                                                  onClick={() => handleStatusChange(event.id, 'exploring')}
                                                  className={`block w-full text-left px-4 py-2 text-sm ${event.status === 'exploring' ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                                >
                                                  🔍 Exploring
                                                </button>
                                                <button
                                                  onClick={() => handleStatusChange(event.id, 'alternative')}
                                                  className={`block w-full text-left px-4 py-2 text-sm ${event.status === 'alternative' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                                >
                                                  ⟳ Alternative
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => {
                                            if (trip._id) {
                                              deleteEvent(trip._id, event.id);
                                              setTrip({ ...trip, events: trip.events.filter(e => e.id !== event.id) });
                                            }
                                          }}
                                          className="p-1.5 bg-white/90 hover:bg-white rounded-full text-red-600 hover:text-red-900 shadow-sm transition-colors"
                                          title="Delete Event"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Event type-specific content */}
                                  {event.type === 'stay' ? (
                                    <div className="mt-1">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {(event as StayEvent).accommodationName}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Check-in: {new Date((event as StayEvent).checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Check-out: {new Date((event as StayEvent).checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                      {(event as StayEvent).address && (
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                          {(event as StayEvent).address}
                                        </p>
                                      )}
                                      
                                      {/* Exploration-specific fields */}
                                      {event.status === 'exploring' && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          {event.priority && (
                                            <div className="flex items-center mb-1">
                                              <span className="text-xs text-gray-500 mr-2">Priority:</span>
                                              <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                  <span key={star} className={star <= event.priority! ? 'text-yellow-500' : 'text-gray-300'}>
                                                    ★
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {event.source && (
                                            <div className="text-xs text-gray-500 mb-1">
                                              <span className="font-medium">Source:</span> {event.source}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {event.notes && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                          Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                            /(https?:\/\/[^\s]+)/g,
                                            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                          ) }} />
                                        </p>
                                      )}
                                      
                                      {/* Creator information */}
                                      {(() => {
                                        // Debug log
                                        console.log('EVENT CARD AVATAR - Creator information section rendering:', {
                                          eventId: event.id,
                                          creatorName: event.createdBy?.name,
                                          creatorPhotoUrl: event.createdBy?.photoUrl,
                                          creatorObject: event.createdBy,
                                          timestamp: new Date().toISOString()
                                        });
                                        
                                        // For events without creator info, use trip owner as fallback
                                        const creatorInfo = event.createdBy || trip.owner;
                                        
                                        // Ensure photoUrl is properly set for both created and added events
                                        const creatorPhotoUrl = event.createdBy?.photoUrl || trip.owner.photoUrl;
                                        
                                        return (
                                          <div className="flex items-center justify-between mt-2 border-t pt-2 border-gray-100">
                                            <p className="text-xs text-gray-400 italic">
                                              {/* Use consistent "Added by" for all events for better UX */}
                                              {`Added by ${creatorInfo.name}`}
                                              {event.createdAt && ` on ${new Date(event.createdAt).toLocaleDateString()}`}
                                              {event.updatedBy && event.updatedBy._id !== creatorInfo._id && 
                                                ` • Last edited by ${event.updatedBy.name}`}
                                            </p>
                                            <div className="flex ml-2">
                                              {/* Creator avatar */}
                                              <div className="relative group" style={{ zIndex: 50 }}>
                                                {(() => {
                                                  console.log('EVENT CARD AVATAR - About to render Avatar component:', {
                                                    eventId: event.id,
                                                    hasCreatedBy: !!event.createdBy,
                                                    usingFallback: !event.createdBy,
                                                    creatorName: creatorInfo.name,
                                                    photoUrl: creatorPhotoUrl,
                                                    timestamp: new Date().toISOString()
                                                  });
                                                  return null;
                                                })()}
                                                <Avatar
                                                  photoUrl={creatorPhotoUrl || null}
                                                  name={creatorInfo.name}
                                                  size="sm"
                                                  className="ring-2 ring-white"
                                                />
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block" style={{ zIndex: 60 }}>
                                                  <div className="bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                                    {`Added by ${creatorInfo.name}`}
                                                  </div>
                                                  <div className="w-2 h-2 bg-black transform rotate-45 absolute -bottom-1 right-3"></div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : event.type === 'arrival' || event.type === 'departure' ? (
                                    <div className="mt-1">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {(event as ArrivalDepartureEvent).airport}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {(event as ArrivalDepartureEvent).airline} {(event as ArrivalDepartureEvent).flightNumber}
                                        {(event as ArrivalDepartureEvent).time && ` • ${(event as ArrivalDepartureEvent).time}`}
                                      </p>
                                      
                                      {/* Exploration-specific fields */}
                                      {event.status === 'exploring' && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          {event.priority && (
                                            <div className="flex items-center mb-1">
                                              <span className="text-xs text-gray-500 mr-2">Priority:</span>
                                              <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                  <span key={star} className={star <= event.priority! ? 'text-yellow-500' : 'text-gray-300'}>
                                                    ★
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {event.source && (
                                            <div className="text-xs text-gray-500 mb-1">
                                              <span className="font-medium">Source:</span> {event.source}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {event.notes && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                          Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                            /(https?:\/\/[^\s]+)/g,
                                            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                          ) }} />
                                        </p>
                                      )}
                                      
                                      {/* Creator information */}
                                      {(() => {
                                        // Debug log
                                        console.log('EVENT CARD AVATAR - Creator information section rendering:', {
                                          eventId: event.id,
                                          creatorName: event.createdBy?.name,
                                          creatorPhotoUrl: event.createdBy?.photoUrl,
                                          creatorObject: event.createdBy,
                                          timestamp: new Date().toISOString()
                                        });
                                        
                                        // For events without creator info, use trip owner as fallback
                                        const creatorInfo = event.createdBy || trip.owner;
                                        
                                        // Ensure photoUrl is properly set for both created and added events
                                        const creatorPhotoUrl = event.createdBy?.photoUrl || trip.owner.photoUrl;
                                        
                                        return (
                                          <div className="flex items-center justify-between mt-2 border-t pt-2 border-gray-100">
                                            <p className="text-xs text-gray-400 italic">
                                              {/* Use consistent "Added by" for all events for better UX */}
                                              {`Added by ${creatorInfo.name}`}
                                              {event.createdAt && ` on ${new Date(event.createdAt).toLocaleDateString()}`}
                                              {event.updatedBy && event.updatedBy._id !== creatorInfo._id && 
                                                ` • Last edited by ${event.updatedBy.name}`}
                                            </p>
                                            <div className="flex ml-2">
                                              {/* Creator avatar */}
                                              <div className="relative group" style={{ zIndex: 50 }}>
                                                {(() => {
                                                  console.log('EVENT CARD AVATAR - About to render Avatar component:', {
                                                    eventId: event.id,
                                                    hasCreatedBy: !!event.createdBy,
                                                    usingFallback: !event.createdBy,
                                                    creatorName: creatorInfo.name,
                                                    photoUrl: creatorPhotoUrl,
                                                    timestamp: new Date().toISOString()
                                                  });
                                                  return null;
                                                })()}
                                                <Avatar
                                                  photoUrl={creatorPhotoUrl || null}
                                                  name={creatorInfo.name}
                                                  size="sm"
                                                  className="ring-2 ring-white"
                                                />
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block" style={{ zIndex: 60 }}>
                                                  <div className="bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                                    {`Added by ${creatorInfo.name}`}
                                                  </div>
                                                  <div className="w-2 h-2 bg-black transform rotate-45 absolute -bottom-1 right-3"></div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <div className="mt-1">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {(event as DestinationEvent).placeName}
                                      </p>
                                      {(event as DestinationEvent).address && (
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                          {(event as DestinationEvent).address}
                                        </p>
                                      )}
                                      
                                      {/* Exploration-specific fields */}
                                      {event.status === 'exploring' && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          {event.priority && (
                                            <div className="flex items-center mb-1">
                                              <span className="text-xs text-gray-500 mr-2">Priority:</span>
                                              <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                  <span key={star} className={star <= event.priority! ? 'text-yellow-500' : 'text-gray-300'}>
                                                    ★
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {event.source && (
                                            <div className="text-xs text-gray-500 mb-1">
                                              <span className="font-medium">Source:</span> {event.source}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {event.notes && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                          Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                            /(https?:\/\/[^\s]+)/g,
                                            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                          ) }} />
                                        </p>
                                      )}
                                      
                                      {/* Creator information */}
                                      {(() => {
                                        // Debug log
                                        console.log('EVENT CARD AVATAR - Creator information section rendering:', {
                                          eventId: event.id,
                                          creatorName: event.createdBy?.name,
                                          creatorPhotoUrl: event.createdBy?.photoUrl,
                                          creatorObject: event.createdBy,
                                          timestamp: new Date().toISOString()
                                        });
                                        
                                        // For events without creator info, use trip owner as fallback
                                        const creatorInfo = event.createdBy || trip.owner;
                                        
                                        // Ensure photoUrl is properly set for both created and added events
                                        const creatorPhotoUrl = event.createdBy?.photoUrl || trip.owner.photoUrl;
                                        
                                        return (
                                          <div className="flex items-center justify-between mt-2 border-t pt-2 border-gray-100">
                                            <p className="text-xs text-gray-400 italic">
                                              {/* Use consistent "Added by" for all events for better UX */}
                                              {`Added by ${creatorInfo.name}`}
                                              {event.createdAt && ` on ${new Date(event.createdAt).toLocaleDateString()}`}
                                              {event.updatedBy && event.updatedBy._id !== creatorInfo._id && 
                                                ` • Last edited by ${event.updatedBy.name}`}
                                            </p>
                                            <div className="flex ml-2">
                                              {/* Creator avatar */}
                                              <div className="relative group" style={{ zIndex: 50 }}>
                                                {(() => {
                                                  console.log('EVENT CARD AVATAR - About to render Avatar component:', {
                                                    eventId: event.id,
                                                    hasCreatedBy: !!event.createdBy,
                                                    usingFallback: !event.createdBy,
                                                    creatorName: creatorInfo.name,
                                                    photoUrl: creatorPhotoUrl,
                                                    timestamp: new Date().toISOString()
                                                  });
                                                  return null;
                                                })()}
                                                <Avatar
                                                  photoUrl={creatorPhotoUrl || null}
                                                  name={creatorInfo.name}
                                                  size="sm"
                                                  className="ring-2 ring-white"
                                                />
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block" style={{ zIndex: 60 }}>
                                                  <div className="bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                                    {`Added by ${creatorInfo.name}`}
                                                  </div>
                                                  <div className="w-2 h-2 bg-black transform rotate-45 absolute -bottom-1 right-3"></div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
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
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="input"
                >
                  <option value="arrival">Arrival</option>
                  <option value="departure">Departure</option>
                  <option value="stay">Stay</option>
                  <option value="destination">Destination</option>
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
    </div>
  );
};

export default TripDetails; 