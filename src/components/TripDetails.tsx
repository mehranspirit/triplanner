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
  const [eventData, setEventData] = useState({
    thumbnailUrl: '',
    date: '',
    location: '',
    notes: '',
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

    const baseEventData = {
      id: isEditingEvent || uuidv4(),
      type: eventType,
      thumbnailUrl: ['stay', 'destination'].includes(eventType) ? eventData.thumbnailUrl : '',
      date: eventData.date,
      location: eventData.location || undefined,
      notes: eventData.notes || undefined,
    };

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
          bookingReference: eventData.bookingReference || undefined,
        } as ArrivalDepartureEvent;
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
          contactInfo: eventData.contactInfo || undefined,
        } as StayEvent;
        break;
      case 'destination':
        newEvent = {
          ...baseEventData,
          type: 'destination',
          placeName: eventData.placeName,
          address: eventData.address,
          description: eventData.description,
          openingHours: eventData.openingHours || undefined,
        } as DestinationEvent;
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
        await updateEvent(trip._id, newEvent);
        const updatedTrip = { ...trip, events: trip.events.map(e => e.id === newEvent.id ? newEvent : e) };
        setTrip(updatedTrip);
      } else {
        if (!trip._id) {
          setError('Trip ID is missing');
          return;
        }
        await addEvent(trip._id, newEvent);
        const updatedTrip = { ...trip, events: [...trip.events, newEvent] };
        setTrip(updatedTrip);
      }
      
      setIsModalOpen(false);
      setIsEditingEvent(null);
      setEventData({
        thumbnailUrl: '',
        date: '',
        location: '',
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
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleEditEvent = async (eventId: string) => {
    if (!trip) return;

    const eventToEdit = trip.events.find(e => e.id === eventId);
    if (!eventToEdit) return;

    setEventType(eventToEdit.type);
    setIsEditingEvent(eventId);
    setIsModalOpen(true);

    // Set common fields
    setEventData({
      ...eventData,
      thumbnailUrl: eventToEdit.thumbnailUrl || '',
      date: eventToEdit.date,
      location: eventToEdit.location || '',
      notes: eventToEdit.notes || '',
      // Initialize all fields with empty values first
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
        <div className="w-full h-[300px] relative rounded-none md:rounded-lg overflow-hidden">
          <img
            src={trip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          
          {/* Owner and Collaborator Avatars */}
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
          
          {user && trip.owner._id !== user._id && (
            <div className="absolute top-4 right-4 z-10">
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
                    <Link
                      to={`/trips/${trip._id}/activity-log`}
                      className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-colors duration-200 shadow-sm"
                    >
                      Activity Log
                    </Link>
                    <button
                      onClick={() => setIsLeaveWarningOpen(true)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors duration-200 shadow-sm"
                    >
                      Leave Trip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{trip.name}</h1>
            {trip.description && (
              <p className="text-lg sm:text-xl text-white/90">{trip.description}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isOwner && (
          <div className="absolute top-4 right-4 sm:right-6 flex space-x-2">
            <button
              onClick={handleTripEdit}
              className="px-3 sm:px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-md shadow-lg transition-colors text-sm sm:text-base"
            >
              Edit Trip
            </button>
            <button
              onClick={() => setIsCollaboratorModalOpen(true)}
              className="px-3 sm:px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-md shadow-lg transition-colors text-sm sm:text-base"
            >
              Manage Collaborators
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3 sm:px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-md shadow-lg transition-colors text-sm sm:text-base"
            >
              Share Trip
            </button>
            <Link
              to={`/trips/${trip._id}/activity-log`}
              className="px-3 sm:px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-md shadow-lg transition-colors text-sm sm:text-base flex items-center"
            >
              Activity Log
            </Link>
          </div>
        )}
      </div>

      {/* Events and Map section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-20">
        {/* Events list */}
        <div className="bg-white shadow rounded-none md:rounded-lg flex flex-col h-[700px]">
          <div className="px-4 py-5 sm:px-6 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Events</h3>
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
          <div className="border-t border-gray-200 flex-1 overflow-auto">
            <ul className="divide-y divide-gray-200">
              {trip.events
                .sort((a, b) => {
                  const dateA = a.type === 'stay' ? new Date((a as StayEvent).checkIn).getTime() : new Date(a.date).getTime();
                  const dateB = b.type === 'stay' ? new Date((b as StayEvent).checkIn).getTime() : new Date(b.date).getTime();
                  return dateA - dateB;
                })
                .map((event) => (
                  <li key={event.id} className="px-4 py-4 sm:px-6">
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
                          <p className="text-sm font-medium text-indigo-600 capitalize">
                            {event.type}
                          </p>
                          {canEdit && (
                            <div className="flex space-x-2 ml-2">
                              <button
                                onClick={() => handleEditEvent(event.id)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (trip._id) {
                                    deleteEvent(trip._id, event.id);
                                    setTrip({ ...trip, events: trip.events.filter(e => e.id !== event.id) });
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {event.type === 'stay' ? (
                          <div className="mt-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {(event as StayEvent).accommodationName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Check-in: {new Date((event as StayEvent).checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">
                              Check-out: {new Date((event as StayEvent).checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {(event as StayEvent).address && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {(event as StayEvent).address}
                              </p>
                            )}
                            {event.notes && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                  /(https?:\/\/[^\s]+)/g,
                                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                ) }} />
                              </p>
                            )}
                          </div>
                        ) : event.type === 'destination' ? (
                          <div className="mt-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {(event as DestinationEvent).placeName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {(event as DestinationEvent).address && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {(event as DestinationEvent).address}
                              </p>
                            )}
                            {event.notes && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                  /(https?:\/\/[^\s]+)/g,
                                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                ) }} />
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {(event as ArrivalDepartureEvent).airport}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(event as ArrivalDepartureEvent).airline} {(event as ArrivalDepartureEvent).flightNumber}
                            </p>
                            {event.notes && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                Notes: <span dangerouslySetInnerHTML={{ __html: event.notes.replace(
                                  /(https?:\/\/[^\s]+)/g,
                                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">$1</a>'
                                ) }} />
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
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

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {isEditingEvent ? 'Edit Event' : 'Add Event'}
              </h2>
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Trip</h2>
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

            <div className="space-y-6">
              {/* Preview current thumbnail */}
              <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={editedTrip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
                  alt={editedTrip.name}
                  className="object-cover w-full h-full"
                />
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trip Name</label>
                  <input
                    type="text"
                    value={editedTrip.name}
                    onChange={(e) => setEditedTrip({ ...editedTrip, name: e.target.value })}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                    required
                    placeholder="Enter trip name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                  <input
                    type="url"
                    value={editedTrip.thumbnailUrl || ''}
                    onChange={(e) => setEditedTrip({ ...editedTrip, thumbnailUrl: e.target.value })}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                    placeholder="Enter image URL (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editedTrip.description || ''}
                    onChange={(e) => setEditedTrip({ ...editedTrip, description: e.target.value })}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                    rows={4}
                    placeholder="Enter trip description (optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEditingTrip(false)}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTripSave}
                  className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Trip Warning Modal */}
      {isLeaveWarningOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Leave Trip</h3>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveWarningOpen(false);
                  handleLeaveTrip();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Leave Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator and Share Modals */}
      <div style={{ zIndex: 9999 }}>
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