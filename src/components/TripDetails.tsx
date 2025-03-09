import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Trip, Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import '../styles/TripDetails.css';
import CollaboratorModal from './CollaboratorModal';
import ShareModal from './ShareModal';

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
  const { state, updateTrip, deleteTrip, addEvent, updateEvent, deleteEvent } = useTrip();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const handleTripUpdate = (updatedTrip: Trip) => {
    setTrip(updatedTrip);
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

  const handleEditEvent = (event: Event) => {
    setEventType(event.type);
    setEventData({
      ...eventData,
      thumbnailUrl: event.thumbnailUrl || '',
      date: event.date || '',
      location: event.location || '',
      notes: event.notes || '',
      ...(event.type === 'arrival' || event.type === 'departure'
        ? {
            flightNumber: (event as ArrivalDepartureEvent).flightNumber || '',
            airline: (event as ArrivalDepartureEvent).airline || '',
            time: (event as ArrivalDepartureEvent).time || '',
            airport: (event as ArrivalDepartureEvent).airport || '',
            terminal: (event as ArrivalDepartureEvent).terminal || '',
            gate: (event as ArrivalDepartureEvent).gate || '',
            bookingReference: (event as ArrivalDepartureEvent).bookingReference || '',
          }
        : event.type === 'stay'
        ? {
            accommodationName: (event as StayEvent).accommodationName || '',
            address: (event as StayEvent).address || '',
            checkIn: (event as StayEvent).checkIn || '',
            checkOut: (event as StayEvent).checkOut || '',
            reservationNumber: (event as StayEvent).reservationNumber || '',
            contactInfo: (event as StayEvent).contactInfo || '',
          }
        : {
            placeName: (event as DestinationEvent).placeName || '',
            address: (event as DestinationEvent).address || '',
            description: (event as DestinationEvent).description || '',
            openingHours: (event as DestinationEvent).openingHours || '',
          }),
    });
    setIsEditingEvent(event.id);
    setIsModalOpen(true);
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

  return (
    <div className="max-w-full md:max-w-7xl mx-auto">
      <div className="relative">
        {/* Full width thumbnail image with overlay */}
        <div className="px-0 sm:px-0 md:px-4">
          <div className="w-full h-[300px] relative rounded-none md:rounded-lg overflow-hidden">
            <img
              src={trip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
              alt={trip.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{trip.name}</h1>
              {trip.description && (
                <p className="text-lg sm:text-xl text-white/90">{trip.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {isOwner && (
          <div className="absolute top-4 right-4 sm:right-6 md:right-8 flex space-x-2">
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
          </div>
        )}

        {/* Edit Trip Modal */}
        {isEditingTrip && editedTrip && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white w-full sm:rounded-lg shadow-xl sm:max-w-3xl sm:w-full max-h-screen sm:max-h-[90vh] overflow-y-auto">
              <form onSubmit={(e) => { e.preventDefault(); handleTripSave(); }}>
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Edit Trip</h2>
                    <button
                      type="button"
                      onClick={() => setIsEditingTrip(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-6 py-4">
                  <div className="space-y-4">
                    {/* Preview current thumbnail */}
                    <div className="aspect-video w-full overflow-hidden rounded-lg">
                      <img
                        src={editedTrip.thumbnailUrl || tripThumbnail || PREDEFINED_THUMBNAILS.default}
                        alt={editedTrip.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Trip Name</label>
                      <input
                        type="text"
                        value={editedTrip.name}
                        onChange={(e) => setEditedTrip({ ...editedTrip, name: e.target.value })}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Thumbnail URL</label>
                      <input
                        type="url"
                        value={editedTrip.thumbnailUrl || ''}
                        onChange={(e) => setEditedTrip({ ...editedTrip, thumbnailUrl: e.target.value })}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter image URL"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={editedTrip.description || ''}
                        onChange={(e) => setEditedTrip({ ...editedTrip, description: e.target.value })}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        rows={3}
                        placeholder="Enter trip description"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTrip(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Trip metadata */}
      <div className="px-0 sm:px-0 md:px-4">
        <div className="bg-white shadow rounded-none md:rounded-lg mt-0 sm:mt-6 mb-0 sm:mb-6">
          <div className="px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Created by {trip.owner.name} • {new Date(trip.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {!isOwner && (
                <div className="text-sm text-gray-500">
                  Your role: {collaborator?.role || 'Viewer'}
                </div>
              )}
            </div>
            {trip.shareableLink && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Shared
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Events list */}
        <div className="bg-white shadow rounded-none md:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
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
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {trip.events
                .sort((a, b) => {
                  const dateA = a.type === 'stay' ? new Date((a as StayEvent).checkIn).getTime() : new Date(a.date).getTime();
                  const dateB = b.type === 'stay' ? new Date((b as StayEvent).checkIn).getTime() : new Date(b.date).getTime();
                  return dateA - dateB;
                })
                .map((event) => (
                <li key={event.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <img
                        src={event.thumbnailUrl || DEFAULT_THUMBNAILS[event.type]}
                        alt={event.type}
                        className="h-24 w-24 object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-indigo-600 capitalize">
                        {event.type}
                      </p>
                      {event.type === 'stay' ? (
                        <div>
                          <p className="text-sm text-gray-900">{(event as StayEvent).accommodationName}</p>
                          <p className="text-sm text-gray-500">
                            Check-in: {new Date((event as StayEvent).checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-500">
                            Check-out: {new Date((event as StayEvent).checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {event.notes && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              Notes: {event.notes}
                            </p>
                          )}
                        </div>
                      ) : event.type === 'destination' ? (
                        <div>
                          <p className="text-sm text-gray-900">{(event as DestinationEvent).placeName}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {event.notes && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              Notes: {event.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-900">
                            {(event as ArrivalDepartureEvent).airport}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(event as ArrivalDepartureEvent).airline} {(event as ArrivalDepartureEvent).flightNumber}
                          </p>
                          {event.notes && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              Notes: {event.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditEvent(event)}
                          className="text-indigo-600 hover:text-indigo-900"
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
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
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

      {/* Modals */}
      <CollaboratorModal
        trip={{
          ...trip,
          _id: trip._id || id || '' // Ensure _id is always a string
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
  );
};

export default TripDetails; 