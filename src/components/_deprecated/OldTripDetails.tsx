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
  BusEvent,
  ActivityEvent,
  AISuggestionHistory
} from '@/types/eventTypes';
import { v4 as uuidv4 } from 'uuid';
import '../styles/TripDetails.css';
import CollaboratorModal from './CollaboratorModal';
import ShareModal from './ShareModal';
import TripMap from './TripMap';
import Avatar from './Avatar';
//import EventForm from './EventForm';
import { AISuggestionsModal } from './AISuggestionsModal';
import { AISuggestionsDisplay } from './AISuggestionsDisplay';
import { generateAISuggestions, generateDestinationSuggestions, parseEventFromText } from '../services/aiService';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/24/solid';
import { UserGroupIcon } from '@heroicons/react/24/solid';
import { ShareIcon } from '@heroicons/react/24/solid';
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid';
import TripNotes from './TripNotes';

// Import the TripContextType
import type { TripContextType } from '../context/TripContext';

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
  bus: 'https://images.pexels.com/photos/3608967/pexels-photo-3608967.jpeg?auto=compress&cs=tinysrgb&w=300',
  activity: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=300'
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
  hiking: 'https://images.pexels.com/photos/2755/people-hiking-climbing-adventure.jpg?auto=compress&cs=tinysrgb&w=800',
  biking: 'https://images.pexels.com/photos/100582/pexels-photo-100582.jpeg?auto=compress&cs=tinysrgb&w=800',
  kayaking: 'https://images.pexels.com/photos/1430673/pexels-photo-1430673.jpeg?auto=compress&cs=tinysrgb&w=800',
  surfing: 'https://images.pexels.com/photos/1654489/pexels-photo-1654489.jpeg?auto=compress&cs=tinysrgb&w=800',
  cooking: 'https://images.pexels.com/photos/3338497/pexels-photo-3338497.jpeg?auto=compress&cs=tinysrgb&w=800',
  workshop: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
  tour: 'https://images.pexels.com/photos/2972257/pexels-photo-2972257.jpeg?auto=compress&cs=tinysrgb&w=800',
  museum: 'https://images.pexels.com/photos/2519376/pexels-photo-2519376.jpeg?auto=compress&cs=tinysrgb&w=800',
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
    case 'activity': {
      const activityEvent = event as ActivityEvent;
      // Use both title and type for better image matching
      searchTerm = `${activityEvent.activityType} ${activityEvent.title}`.trim() || 'outdoor activity';
      break;
    }
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
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'notes'>('map');
  
  // Call useTrip at the top level, but handle potential errors in the effect
  const tripContext = useTrip();
  
  // Remove the try-catch block around useTrip and handle errors where the context is used
  
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
    location: { lat: 0, lng: 0 },
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
    busNumber: '',
    dropoffDate: ''
  });
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [airportSuggestions, setAirportSuggestions] = useState<Array<{
    name: string;
    iata: string;
    city: string;
    country: string;
    icao: string;
  }>>([]);
  const [showAirportSuggestions, setShowAirportSuggestions] = useState(false);
  const airportInputRef = useRef<HTMLInputElement>(null);
  const [eventThumbnails, setEventThumbnails] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: '', message: '' });
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAISuggestionsModalOpen, setIsAISuggestionsModalOpen] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<string | null>(null);
  const [suggestionsHistory, setSuggestionsHistory] = useState<AISuggestionHistory[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [airportQuery, setAirportQuery] = useState('');
  const [airlineQuery, setAirlineQuery] = useState('');
  const [airlineSuggestions, setAirlineSuggestions] = useState<Array<{
    name: string;
    iata: string;
    country: string;
  }>>([]);
  const [showAirlineSuggestions, setShowAirlineSuggestions] = useState(false);
  const airlineInputRef = useRef<HTMLInputElement>(null);
  const [departureAirportQuery, setDepartureAirportQuery] = useState('');
  const [arrivalAirportQuery, setArrivalAirportQuery] = useState('');
  const [showDepartureAirportSuggestions, setShowDepartureAirportSuggestions] = useState(false);
  const [showArrivalAirportSuggestions, setShowArrivalAirportSuggestions] = useState(false);
  const [departureAirportSuggestions, setDepartureAirportSuggestions] = useState<Array<{
    name: string;
    iata: string;
    city: string;
    country: string;
    icao: string;
  }>>([]);
  const [arrivalAirportSuggestions, setArrivalAirportSuggestions] = useState<Array<{
    name: string;
    iata: string;
    city: string;
    country: string;
    icao: string;
  }>>([]);
  const departureAirportInputRef = useRef<HTMLInputElement>(null);
  const arrivalAirportInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingDestinations, setIsGeneratingDestinations] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<'form' | 'text'>('form');
  const [eventText, setEventText] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);

  // Add type guard function at the top of the component
  const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' }): c is { user: User; role: 'viewer' | 'editor' } => {
    return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
  };

  const getCollaboratorRole = (collaborator: string | { user: User; role: 'viewer' | 'editor' }): 'viewer' | 'editor' => {
    return isCollaboratorObject(collaborator) ? collaborator.role : 'viewer';
  };

  const fetchAirports = async (query: string) => {
    if (query.length < 2) {
      setAirportSuggestions([]);
      return;
    }
    
    try {
      // For free tier, try using IATA code search (if available)
      // Adjust the parameter name according to the documentation if it's different.
      const url = `https://api.api-ninjas.com/v1/airports?iata=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      
      const json = await response.json();
  
      if (!response.ok) {
        console.error("API error:", json);
        setAirportSuggestions([]);
        return;
      }
  
      if (!Array.isArray(json)) {
        console.error("Unexpected response structure:", json);
        setAirportSuggestions([]);
        return;
      }
  
      const airports = json
        .filter((airport: any) => airport.iata && airport.name)
        .map((airport: any) => ({
          name: airport.name,
          iata: airport.iata,
          city: airport.city,
          country: airport.country,
          icao: airport.icao
        }));
  
      setAirportSuggestions(airports);
      setShowAirportSuggestions(true);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  // Add debounced airport search effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (airportQuery.length >= 2) {
        fetchAirports(airportQuery);
      } else {
        setAirportSuggestions([]);
      }
    }, 400); // debounce delay

    return () => clearTimeout(delayDebounce);
  }, [airportQuery]);

  const fetchDepartureAirports = async (query: string) => {
    if (query.length < 2) {
      setDepartureAirportSuggestions([]);
      return;
    }
    
    try {
      const url = `https://api.api-ninjas.com/v1/airports?iata=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      
      const json = await response.json();
  
      if (!response.ok) {
        console.error("API error:", json);
        setDepartureAirportSuggestions([]);
        return;
      }
  
      if (!Array.isArray(json)) {
        console.error("Unexpected response structure:", json);
        setDepartureAirportSuggestions([]);
        return;
      }
  
      const airports = json
        .filter((airport: any) => airport.iata && airport.name)
        .map((airport: any) => ({
          name: airport.name,
          iata: airport.iata,
          city: airport.city,
          country: airport.country,
          icao: airport.icao
        }));
  
      setDepartureAirportSuggestions(airports);
      setShowDepartureAirportSuggestions(true);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  const fetchArrivalAirports = async (query: string) => {
    if (query.length < 2) {
      setArrivalAirportSuggestions([]);
      return;
    }
    
    try {
      const url = `https://api.api-ninjas.com/v1/airports?iata=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      
      const json = await response.json();
  
      if (!response.ok) {
        console.error("API error:", json);
        setArrivalAirportSuggestions([]);
        return;
      }
  
      if (!Array.isArray(json)) {
        console.error("Unexpected response structure:", json);
        setArrivalAirportSuggestions([]);
        return;
      }
  
      const airports = json
        .filter((airport: any) => airport.iata && airport.name)
        .map((airport: any) => ({
          name: airport.name,
          iata: airport.iata,
          city: airport.city,
          country: airport.country,
          icao: airport.icao
        }));
  
      setArrivalAirportSuggestions(airports);
      setShowArrivalAirportSuggestions(true);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  // Add debounced departure airport search effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (departureAirportQuery.length >= 2) {
        fetchDepartureAirports(departureAirportQuery);
      } else {
        setDepartureAirportSuggestions([]);
      }
    }, 400); // debounce delay

    return () => clearTimeout(delayDebounce);
  }, [departureAirportQuery]);

  // Add debounced arrival airport search effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (arrivalAirportQuery.length >= 2) {
        fetchArrivalAirports(arrivalAirportQuery);
      } else {
        setArrivalAirportSuggestions([]);
      }
    }, 400); // debounce delay

    return () => clearTimeout(delayDebounce);
  }, [arrivalAirportQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (airportInputRef.current && !airportInputRef.current.contains(event.target as Node)) {
        setShowAirportSuggestions(false);
      }
      if (departureAirportInputRef.current && !departureAirportInputRef.current.contains(event.target as Node)) {
        setShowDepartureAirportSuggestions(false);
      }
      if (arrivalAirportInputRef.current && !arrivalAirportInputRef.current.contains(event.target as Node)) {
        setShowArrivalAirportSuggestions(false);
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

  const loadHistory = async (tripId: string) => {
    if (!user?._id) {
      console.log('Missing user ID:', { userId: user?._id });
      return;
    }

    try {
      //console.log('Loading AI suggestions history for:', { tripId, userId: user._id });
      const history = await api.getAISuggestions(tripId, user._id);
      //console.log('Loaded AI suggestions history:', history);
      setSuggestionsHistory(history);
    } catch (error) {
      console.error('Error loading AI suggestions history:', error);
      setError('Failed to load AI suggestions history');
    }
  };

  const fetchTrip = async () => {
    if (!id) return;

    try {
      setLoading(true);
      // Check if we're on a dream trip URL
      if (window.location.pathname.includes('/trips/dream/')) {
        navigate(`/trips/dream/${id}`);
        return;
      }

      const tripData = await api.getTrip(id);
      console.log('Fetched trip data:', {
        id: tripData._id,
        name: tripData.name,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        rawData: tripData
      });
      
      setTrip(tripData);
      setEventData({
        type: 'stay',
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
        status: 'exploring',
        thumbnailUrl: '',
        source: 'manual',
        location: { lat: 0, lng: 0 },
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
        busNumber: '',
        dropoffDate: ''
      });

      // Load thumbnails
      const thumbnail = await getDefaultThumbnail(tripData.name);
      setTripThumbnail(thumbnail);

      // Load event thumbnails
      const thumbnails: { [key: string]: string } = {};
      for (const event of tripData.events) {
        thumbnails[event.id] = await getEventThumbnail(event);
      }
      setEventThumbnails(thumbnails);

      // Load AI suggestions history
      await loadHistory(id);
    } catch (error) {
      console.error('Error fetching trip:', error);
      setError(error instanceof Error ? error.message : 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTrip = async () => {
      if (!id) return;

      try {
        setLoading(true);
        // Check if we're on a dream trip URL
        if (window.location.pathname.includes('/trips/dream/')) {
          navigate(`/trips/dream/${id}`);
          return;
        }

        const tripData = await api.getTrip(id);
        console.log('Fetched trip data:', {
          id: tripData._id,
          name: tripData.name,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          rawData: tripData
        });
        
        setTrip(tripData);
        // ... rest of the fetchTrip function ...
      } catch (error) {
        console.error('Error fetching trip:', error);
        setError(error instanceof Error ? error.message : 'Failed to load trip details');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id, navigate]);

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

  // Add click outside handler for status menu
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

  const handleTripUpdate = async (updatedTrip: Trip) => {
    //console.log('Updating trip with new data:', updatedTrip);
    
    try {
      // Create a deep copy of the updated trip to avoid reference issues
      const tripCopy = JSON.parse(JSON.stringify(updatedTrip)) as Trip;
      // Update the local state with the full new trip
      setTrip(tripCopy);
      
      // Use the API directly since we're handling errors here
      await api.updateTrip(updatedTrip);
      //console.log('Trip update complete');
    } catch (err) {
      console.error('Error updating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to update trip');
      // If update fails, fetch the latest trip data from the server
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
      await api.leaveTrip(trip._id);
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
      })),
      owner: {
        _id: trip.owner._id,
        name: trip.owner.name,
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl
      },
      collaborators: trip.collaborators.map(c => 
        isCollaboratorObject(c) ? c : { user: { _id: c, name: '', email: '' }, role: 'viewer' as const }
      ),
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic,
      shareableLink: trip.shareableLink,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      tags: trip.tags
    };
    
    return mappedTrip;
  }, [trip?._id, trip?.name, trip?.events, trip?.owner, trip?.collaborators, user]);

  // Export functions
  const handleExportPDF = async () => {
    try {
      if (!trip?._id) return;
      await api.exportTripAsPDF(trip._id);
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
        case 'flight':
          return '✈️';
        case 'stay':
          return '🏨';
        case 'destination':
          return '📍';
        case 'train':
          return '🚂';
        case 'rental_car':
          return '🚗';
        case 'bus':
          return '🚌';
        case 'activity':
          return '🏔️';
        default:
          return '📅';
      }
    };

    const getEventTitle = (event: Event): string => {
      const encodeText = (text: string | undefined | null) => {
        if (!text) return '';
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      switch (event.type) {
        case 'arrival':
        case 'departure': {
          const e = event as ArrivalDepartureEvent;
          return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${encodeText(e.airport || 'Airport')}`;
        }
        case 'stay': {
          const e = event as StayEvent;
          return encodeText(e.accommodationName || 'Accommodation');
        }
        case 'destination': {
          const e = event as DestinationEvent;
          return encodeText(e.placeName || 'Destination');
        }
        case 'flight': {
          const e = event as FlightEvent;
          return encodeText(`${e.airline || ''} ${e.flightNumber || 'Flight'}`.trim());
        }
        case 'train': {
          const e = event as TrainEvent;
          return encodeText(`${e.trainOperator || ''} ${e.trainNumber || 'Train'}`.trim());
        }
        case 'rental_car': {
          const e = event as RentalCarEvent;
          return encodeText(`${e.pickupLocation || ''} to ${e.dropoffLocation || ''}`);
        }
        case 'bus': {
          const e = event as BusEvent;
          return encodeText(`${e.busOperator || ''} ${e.busNumber || 'Bus'}`.trim());
        }
        case 'activity': {
          const e = event as ActivityEvent;
          return encodeText(`${e.title || 'Activity'} - ${e.activityType || ''}`.replace(/ - $/, ''));
        }
        default:
          return 'Event';
      }
    };

    const confirmedEvents = trip.events.filter((event: Event) => event.status === 'confirmed');
    const sortedEvents = sortEvents(confirmedEvents);
    
    // Group events by date
    const eventsByDate: Record<string, Event[]> = {};
    sortedEvents.forEach((event: Event) => {
      const dateString = event.date.split('T')[0];
      if (!eventsByDate[dateString]) {
        eventsByDate[dateString] = [];
      }
      eventsByDate[dateString].push(event);
    });

    const formatDateForExport = (dateString: string) => {
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${trip.name || 'Trip'} - Itinerary</title>
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
              padding: 0;
              margin-bottom: 15px;
              background-color: white;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              position: relative;
            }
            .event-thumbnail {
              position: absolute;
              top: 15px;
              right: 15px;
              width: 100px;
              height: 100px;
              object-fit: cover;
              border-radius: 6px;
              border: 1px solid #E5E7EB;
            }
            .event-content {
              padding: 15px;
              padding-right: 130px;
            }
            .event-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 10px;
            }
            .event-icon {
              font-size: 24px;
              display: flex;
              align-items: center;
            }
            .event-icon svg {
              width: 24px;
              height: 24px;
              color: #4F46E5;
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
              font-size: 1.1em;
            }
            .event-details {
              color: #6B7280;
              font-size: 0.9em;
              margin-top: 10px;
            }
            .event-detail-item {
              display: flex;
              margin-bottom: 4px;
            }
            .event-detail-label {
              font-weight: 500;
              min-width: 100px;
              color: #4B5563;
            }
            .event-detail-value {
              color: #6B7280;
            }
            .event-notes {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #E5E7EB;
              color: #6B7280;
              font-style: italic;
              font-size: 0.85em;
              line-height: 1.4;
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
          <h1 style="text-align: center; color: #111827; margin-bottom: 30px;">
            ${trip.name || 'Trip'} Itinerary
          </h1>
          ${Object.entries(eventsByDate)
            .map(([dateString, events]) => {
              return `
                <div class="date-header">
                  ${formatDateForExport(dateString)}
                </div>
                ${events.map(event => {
                  // Get event thumbnail
                  const thumbnail = event.thumbnailUrl || eventThumbnails[event.id] || DEFAULT_THUMBNAILS[event.type];
                  
                  // Process text to make links clickable and properly decode content
                  const processText = (text: string) => {
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
                        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
                        // Convert line breaks to HTML
                        .replace(/\n/g, '<br>');
                    } catch (e) {
                      // If decoding fails, return the original text
                      return text;
                    }
                  };

                  // Get event details based on type
                  const getEventDetails = (event: Event) => {
                      switch (event.type) {
                        case 'arrival':
                        case 'departure': {
                          const e = event as ArrivalDepartureEvent;
                        return [
                          ['Time', e.time],
                          ['Airport', e.airport],
                          ['Airline', e.airline],
                          ['Flight', e.flightNumber],
                          ['Terminal', e.terminal],
                          ['Gate', e.gate],
                          ['Booking Ref', e.bookingReference]
                        ].filter(([_, value]) => value);
                        }
                        case 'stay': {
                          const e = event as StayEvent;
                        return [
                          ['Accommodation', e.accommodationName],
                          ['Check-in', e.checkIn],
                          ['Check-out', e.checkOut],
                          ['Address', e.address],
                          ['Reservation', e.reservationNumber],
                          ['Contact', e.contactInfo]
                        ].filter(([_, value]) => value);
                        }
                        case 'destination': {
                          const e = event as DestinationEvent;
                        return [
                          ['Place', e.placeName],
                          ['Address', e.address],
                          ['Description', e.description],
                          ['Opening Hours', e.openingHours]
                        ].filter(([_, value]) => value);
                        }
                        case 'flight': {
                          const e = event as FlightEvent;
                        return [
                          ['Airline', e.airline],
                          ['Flight', e.flightNumber],
                          ['Departure Airport', e.departureAirport],
                          ['Departure Time', e.departureTime],
                          ['Arrival Airport', e.arrivalAirport],
                          ['Arrival Time', e.arrivalTime],
                          ['Terminal', e.terminal],
                          ['Gate', e.gate],
                          ['Booking Ref', e.bookingReference]
                        ].filter(([_, value]) => value);
                        }
                        case 'train': {
                          const e = event as TrainEvent;
                        return [
                          ['Operator', e.trainOperator],
                          ['Train Number', e.trainNumber],
                          ['Departure Station', e.departureStation],
                          ['Departure Time', e.departureTime],
                          ['Arrival Station', e.arrivalStation],
                          ['Arrival Time', e.arrivalTime],
                          ['Carriage', e.carriageNumber],
                          ['Seat', e.seatNumber],
                          ['Booking Ref', e.bookingReference]
                        ].filter(([_, value]) => value);
                        }
                        case 'rental_car': {
                          const e = event as RentalCarEvent;
                        return [
                          ['Company', e.carCompany],
                          ['Car Type', e.carType],
                          ['Pickup Location', e.pickupLocation],
                          ['Pickup Time', e.pickupTime],
                          ['Dropoff Location', e.dropoffLocation],
                          ['Dropoff Time', e.dropoffTime],
                          ['Dropoff Date', e.dropoffDate],
                          ['License Plate', e.licensePlate],
                          ['Booking Ref', e.bookingReference]
                        ].filter(([_, value]) => value);
                        }
                        case 'bus': {
                          const e = event as BusEvent;
                        return [
                          ['Operator', e.busOperator],
                          ['Bus Number', e.busNumber],
                          ['Departure Station', e.departureStation],
                          ['Departure Time', e.departureTime],
                          ['Arrival Station', e.arrivalStation],
                          ['Arrival Time', e.arrivalTime],
                          ['Seat', e.seatNumber],
                          ['Booking Ref', e.bookingReference]
                        ].filter(([_, value]) => value);
                        }
                        case 'activity': {
                          const e = event as ActivityEvent;
                        return [
                          ['Title', e.title],
                          ['Type', e.activityType],
                          ['Address', e.address],
                          ['Description', e.description]
                        ].filter(([_, value]) => value);
                        }
                        default:
                        return [];
                      }
                  };

                  return `
                    <div class="event-card">
                      <div class="event-content">
                        <img src="${thumbnail}" alt="${event.type}" class="event-thumbnail">
                        <div class="event-header">
                          <span class="event-icon" style="font-size: 24px;">${getEventIcon(event.type)}</span>
                          <span class="event-type">${event.type.replace('_', ' ')}</span>
                  </div>
                        <div class="event-title">${getEventTitle(event)}</div>
                        ${event.type === 'destination' && (event as DestinationEvent).description ? 
                          `<div class="event-details truncate-text">${processText((event as DestinationEvent).description || '')}</div>` : ''}
                        <div class="event-details">
                          ${getEventDetails(event)?.map(([label, value]) => 
                            `<div class="event-detail-item">
                              <span class="event-detail-label">${label}:</span>
                              <span class="event-detail-value">${processText(value || '')}</span>
                            </div>`
                          ).join('')}
                        </div>
                        ${event.notes ? `<div class="event-notes">${processText(event.notes)}</div>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              `;
            }).join('')}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up the URL object after a delay to ensure the new tab has loaded
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

      await handleTripUpdate(updatedTrip);
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

      const updatedTrip = {
        ...trip,
        events: trip.events.map(e => e.id === eventId ? updatedEvent : e)
      };

      await handleTripUpdate(updatedTrip);
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
    if (!trip?._id) return;
    
    try {
      if (tripContext) {
        await tripContext.deleteEvent(trip._id, eventId);
      } else {
        const updatedTrip = {
          ...trip,
          events: trip.events.filter(e => e.id !== eventId)
        };
        await api.updateTrip(updatedTrip);
      }
      // Update local trip state by filtering out the deleted event
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          events: prevTrip.events.filter(e => e.id !== eventId)
        };
      });
      // Close the modal after successful deletion
      setIsDeleteEventWarningOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
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
      location: { lat: 0, lng: 0 },
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
      busNumber: '',
      dropoffDate: ''
    });
    setEventText('');
    setActiveEventTab('text'); // Change default tab to text
    setIsEditingEvent(null);
    setFormFeedback({ type: '', message: '' });
    // Reset queries and suggestions for airports/airlines
    setAirportQuery('');
    setAirlineQuery('');
    setDepartureAirportQuery('');
    setArrivalAirportQuery('');
    setAirportSuggestions([]);
    setAirlineSuggestions([]);
    setDepartureAirportSuggestions([]);
    setArrivalAirportSuggestions([]);
    setShowAirportSuggestions(false);
    setShowAirlineSuggestions(false);
    setShowDepartureAirportSuggestions(false);
    setShowArrivalAirportSuggestions(false);
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
      await api.deleteTrip(trip._id);
      navigate('/trips');
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    } finally {
      setIsDeleteWarningOpen(false);
    }
  };

  const geocodeAddress = async (searchQuery: string): Promise<{ lat: number, lng: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch location for ${searchQuery}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (err) {
      console.warn(`Error geocoding address:`, err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !trip) {
      setFormFeedback({ type: 'error', message: 'User or trip data is missing' });
      return;
    }
    
    setIsSubmitting(true);
    setFormFeedback({ type: '', message: '' });

    try {
      const now = new Date().toISOString();
      const baseEvent = {
        id: isEditingEvent !== null ? isEditingEvent : uuidv4(),
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
        // Geocode the address for stay events, prioritizing address over accommodation name
        const searchQuery = eventData.address || eventData.accommodationName || '';
        const coordinates = searchQuery ? await geocodeAddress(searchQuery) : null;
        
        newEvent = {
          ...baseEvent,
          accommodationName: eventData.accommodationName || '',
          address: eventData.address || '',
          checkIn: eventData.date,
          checkOut: eventData.checkOut || '',
          reservationNumber: eventData.reservationNumber || '',
          contactInfo: eventData.contactInfo || '',
          location: coordinates ? {
            lat: coordinates.lat,
            lng: coordinates.lng,
            address: eventData.address || ''
          } : undefined
        } as StayEvent;
      } else if (eventData.type === 'destination') {
        // Geocode the address for destination events, prioritizing address over place name
        const searchQuery = eventData.address || eventData.placeName || '';
        const coordinates = searchQuery ? await geocodeAddress(searchQuery) : null;
        
        newEvent = {
          ...baseEvent,
          placeName: eventData.placeName || '',
          address: eventData.address || '',
          description: eventData.description || '',
          openingHours: eventData.openingHours || '',
          location: coordinates ? {
            lat: coordinates.lat,
            lng: coordinates.lng,
            address: eventData.address || ''
          } : undefined
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
          dropoffDate: eventData.dropoffDate || '',
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
      } else if (eventData.type === 'activity') {
        newEvent = {
          ...baseEvent,
          title: eventData.title || '',
          activityType: eventData.activityType || '',
          address: eventData.address || '',
          description: eventData.description || ''
        } as ActivityEvent;
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
        
        const updatedTrip: Trip = {
          ...trip,
          events: updatedEvents
        };
        
        await handleTripUpdate(updatedTrip);
        setTrip(updatedTrip);
        setFormFeedback({ type: 'success', message: 'Event updated successfully!' });
        setIsModalOpen(false);
        resetEventForm();
      } else {
        // Add new event
        const updatedTrip: Trip = {
          ...trip,
          events: [...trip.events, newEvent]
        };
        
        await handleTripUpdate(updatedTrip);
        setTrip(updatedTrip);
        setFormFeedback({ type: 'success', message: 'Event added successfully!' });
      setIsModalOpen(false);
      resetEventForm();
      }
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

  const handleAddEvent = async (newEvent: Event) => {
    if (!trip?._id) return;

    try {
      if (tripContext) {
        await tripContext.addEvent(trip._id, newEvent);
      } else {
        const updatedTrip = {
          ...trip,
          events: [...trip.events, newEvent]
        };
        await api.updateTrip(updatedTrip);
      }
      setIsModalOpen(false);
      resetEventForm();
    } catch (error) {
      console.error('Error adding event:', error);
      setError('Failed to add event');
    }
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
              <div className="relative" ref={airlineInputRef}>
                <input
                  type="text"
                  value={airlineQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAirlineQuery(value);
                    setEventData({ ...eventData, airline: value });
                  }}
                  className="input"
                  placeholder="Enter airline name"
                />
                {showAirlineSuggestions && airlineSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                    {airlineSuggestions.map((airline) => (
                      <li
                        key={airline.iata || airline.name}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          const airlineDisplay = `${airline.name}${airline.iata ? ` (${airline.iata})` : ''}${airline.country ? ` - ${airline.country}` : ''}`;
                          setEventData({ ...eventData, airline: airlineDisplay });
                          setAirlineQuery(airlineDisplay);
                          setShowAirlineSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{airline.name}{airline.iata ? ` (${airline.iata})` : ''}</div>
                        {airline.country && <div className="text-gray-600 text-xs">{airline.country}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mb-4 relative" ref={airportInputRef}>
              <label className="block text-gray-700 mb-2">Airport</label>
              <input
                type="text"
                value={airportQuery}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase(); // Convert to uppercase for IATA codes
                  setAirportQuery(value);
                  setEventData({ ...eventData, airport: value });
                }}
                className="input"
                placeholder="Enter airport IATA code (e.g., LAX, JFK)"
              />
              {showAirportSuggestions && airportSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                  {airportSuggestions.map((airport) => (
                    <li
                      key={airport.icao}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => {
                        const airportDisplay = `${airport.name} (${airport.iata}) - ${airport.city}, ${airport.country}`;
                        setEventData({ ...eventData, airport: airportDisplay });
                        setAirportQuery(airportDisplay); // Update to show full airport info
                        setShowAirportSuggestions(false);
                      }}
                    >
                      <div className="font-medium">{airport.name} ({airport.iata})</div>
                      <div className="text-gray-600 text-xs">{airport.city}, {airport.country}</div>
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
            {commonFields}
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
                    date: value,
                    checkIn: value
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
              <div className="relative" ref={airlineInputRef}>
                <input
                  type="text"
                  value={airlineQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAirlineQuery(value);
                    setEventData({ ...eventData, airline: value });
                  }}
                  className="input"
                  placeholder="Enter airline name"
                />
                {showAirlineSuggestions && airlineSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                    {airlineSuggestions.map((airline) => (
                      <li
                        key={airline.iata || airline.name}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          const airlineDisplay = `${airline.name}${airline.iata ? ` (${airline.iata})` : ''}${airline.country ? ` - ${airline.country}` : ''}`;
                          setEventData({ ...eventData, airline: airlineDisplay });
                          setAirlineQuery(airlineDisplay);
                          setShowAirlineSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{airline.name}{airline.iata ? ` (${airline.iata})` : ''}</div>
                        {airline.country && <div className="text-gray-600 text-xs">{airline.country}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
              <div className="relative" ref={departureAirportInputRef}>
                <input
                  type="text"
                  value={departureAirportQuery}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase(); // Convert to uppercase for IATA codes
                    setDepartureAirportQuery(value);
                    setEventData({ ...eventData, departureAirport: value });
                    setShowDepartureAirportSuggestions(true);
                  }}
                  className="input"
                  required
                  placeholder="Enter departure airport IATA code (e.g., LAX, JFK)"
                />
                {showDepartureAirportSuggestions && departureAirportSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                    {departureAirportSuggestions.map((airport) => (
                      <li
                        key={airport.icao}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          const airportDisplay = `${airport.name} (${airport.iata}) - ${airport.city}, ${airport.country}`;
                          setEventData({ ...eventData, departureAirport: airportDisplay });
                          setDepartureAirportQuery(airportDisplay);
                          setShowDepartureAirportSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{airport.name} ({airport.iata})</div>
                        <div className="text-gray-600 text-xs">{airport.city}, {airport.country}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Arrival Airport</label>
              <div className="relative" ref={arrivalAirportInputRef}>
                <input
                  type="text"
                  value={arrivalAirportQuery}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase(); // Convert to uppercase for IATA codes
                    setArrivalAirportQuery(value);
                    setEventData({ ...eventData, arrivalAirport: value });
                    setShowArrivalAirportSuggestions(true);
                  }}
                  className="input"
                  required
                  placeholder="Enter arrival airport IATA code (e.g., LAX, JFK)"
                />
                {showArrivalAirportSuggestions && arrivalAirportSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                    {arrivalAirportSuggestions.map((airport) => (
                      <li
                        key={airport.icao}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          const airportDisplay = `${airport.name} (${airport.iata}) - ${airport.city}, ${airport.country}`;
                          setEventData({ ...eventData, arrivalAirport: airportDisplay });
                          setArrivalAirportQuery(airportDisplay);
                          setShowArrivalAirportSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{airport.name} ({airport.iata})</div>
                        <div className="text-gray-600 text-xs">{airport.city}, {airport.country}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
              <label className="block text-gray-700 mb-2">Dropoff Date</label>
              <input
                type="date"
                value={eventData.dropoffDate}
                onChange={(e) =>
                  setEventData({ ...eventData, dropoffDate: e.target.value })
                }
                className="input"
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
      case 'activity':
        return (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={eventData.title || ''}
                onChange={(e) =>
                  setEventData({ ...eventData, title: e.target.value })
                }
                className="input"
                placeholder="Enter activity title"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Activity Type</label>
              <input
                type="text"
                value={eventData.activityType || ''}
                onChange={(e) =>
                  setEventData({ ...eventData, activityType: e.target.value })
                }
                className="input"
                placeholder="Enter activity type"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
              <input
                type="url"
                value={eventData.thumbnailUrl || ''}
                onChange={(e) =>
                  setEventData({ ...eventData, thumbnailUrl: e.target.value })
                }
                className="input"
                placeholder="Enter image URL or leave empty for automatic thumbnail"
              />
            </div>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Address (optional)</label>
              <input
                type="text"
                value={eventData.address || ''}
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
                value={eventData.description || ''}
                onChange={(e) =>
                  setEventData({ ...eventData, description: e.target.value })
                }
                className="input"
                placeholder="Enter description"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

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

  const handleAISuggestionsSubmit = async (places: string[], activities: string[]) => {
    if (!trip || !user) return;

    try {
      const suggestions = await generateAISuggestions({
        places,
        activities,
        tripDates: {
          startDate: trip.startDate,
          endDate: trip.endDate,
        },
      });

      // Save to history
      const historyItem: Omit<AISuggestionHistory, '_id'> = {
        userId: user._id,
        tripId: trip._id,
        places,
        activities,
        suggestions,
        createdAt: new Date().toISOString(),
      };

      try {
        const savedHistory = await api.saveAISuggestion(historyItem);
        setSuggestionsHistory(prev => [savedHistory, ...prev]);
        setAISuggestions(suggestions);
        setIsAISuggestionsModalOpen(false);
      } catch (error) {
        console.error('Error saving AI suggestion:', error);
        // Still show the suggestions even if saving fails
        setAISuggestions(suggestions);
        setIsAISuggestionsModalOpen(false);
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      setError('Failed to generate suggestions. Please try again later.');
    }
  };

  const handleSelectHistoryItem = (suggestion: AISuggestionHistory) => {
    setAISuggestions(suggestion.suggestions);
    setIsAISuggestionsModalOpen(false);
  };

  const handleDeleteHistoryItem = async (suggestionId: string) => {
    if (!trip?._id) {
      console.error('Cannot delete suggestion - missing trip ID');
      return;
    }

    try {
      await api.deleteAISuggestion(suggestionId);
      setSuccess('Suggestion deleted successfully');
      await loadHistory(trip._id);
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      setError('Failed to delete suggestion');
    }
  };

  const fetchAirlines = async (query: string) => {
    if (query.length < 2) {
      setAirlineSuggestions([]);
      return;
    }
    
    try {
      const url = `https://api.api-ninjas.com/v1/airlines?name=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      
      const json = await response.json();
  
      if (!response.ok) {
        console.error("API error:", json);
        setAirlineSuggestions([]);
        return;
      }
  
      if (!Array.isArray(json)) {
        console.error("Unexpected response structure:", json);
        setAirlineSuggestions([]);
        return;
      }
  
      const airlines = json
        .filter((airline: any) => airline.name)
        .map((airline: any) => ({
          name: airline.name,
          iata: airline.iata || '',
          country: airline.country || ''
        }));
  
      setAirlineSuggestions(airlines);
      setShowAirlineSuggestions(true);
    } catch (error) {
      console.error('Error fetching airlines:', error);
    }
  };

  // Add debounced airline search effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (airlineQuery.length >= 2) {
        fetchAirlines(airlineQuery);
      } else {
        setAirlineSuggestions([]);
      }
    }, 400); // debounce delay

    return () => clearTimeout(delayDebounce);
  }, [airlineQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (airlineInputRef.current && !airlineInputRef.current.contains(event.target as Node)) {
        setShowAirlineSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load AI suggestions history when component mounts
  useEffect(() => {
    if (trip?._id && user?._id) {
      loadHistory(trip._id);
    }
  }, [trip?._id, user?._id]);

  const handleGenerateDestinations = async () => {
    if (!trip || !user || user.photoUrl === undefined) return;

    try {
      //console.log('=== STARTING AI GENERATION ===');
      
      // Calculate trip dates from events
      const sortedEvents = [...trip.events].sort((a, b) => {
        const dateA = a.type === 'stay' ? new Date((a as StayEvent).checkIn).getTime() : new Date(a.date).getTime();
        const dateB = b.type === 'stay' ? new Date((b as StayEvent).checkIn).getTime() : new Date(b.date).getTime();
        return dateA - dateB;
      });

      let startDate: Date | null = null;
      let endDate: Date | null = null;

      sortedEvents.forEach(event => {
        const eventDate = event.type === 'stay' 
          ? new Date((event as StayEvent).checkIn)
          : new Date(event.date);

        if (!startDate || eventDate < startDate) {
          startDate = eventDate;
        }

        // For stay events, use checkout date as potential end date
        if (event.type === 'stay') {
          const checkoutDate = new Date((event as StayEvent).checkOut);
          if (!endDate || checkoutDate > endDate) {
            endDate = checkoutDate;
          }
        } else {
          if (!endDate || eventDate > endDate) {
            endDate = eventDate;
          }
        }
      });

      // If no events, use trip dates or current date
      if (!startDate) startDate = trip.startDate ? new Date(trip.startDate) : new Date();
      if (!endDate) endDate = trip.endDate ? new Date(trip.endDate) : startDate;

      //console.log('Trip details:', { 
      //  id: trip._id, 
      //  name: trip.name,
      //  calculatedStartDate: startDate.toISOString(),
      //  calculatedEndDate: endDate.toISOString(),
      //  rawTrip: trip
      //});

      setIsGeneratingDestinations(true);
      //console.log('Total events to process:', trip.events.length);
      
      const suggestions = await generateDestinationSuggestions(
        trip.events,
        { 
          startDate: startDate.toISOString(), 
          endDate: endDate.toISOString() 
        },
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl || null
        }
      );

      //console.log('Received suggestions:', suggestions.length);

      // Add suggestions to trip
      const updatedTrip = {
        ...trip,
        events: [...trip.events, ...suggestions]
      };

      await handleTripUpdate(updatedTrip);
      //console.log('=== AI GENERATION COMPLETE ===');
      setSuccess('Added 3 AI-suggested experiences');
    } catch (error) {
      //console.error('=== AI GENERATION ERROR ===');
      //console.error('Error details:', error);
      setError('Failed to generate suggestions');
    } finally {
      setIsGeneratingDestinations(false);
    }
  };

  const formatEventSummary = (event: Event): string => {
    switch (event.type) {
      case 'arrival':
      case 'departure': {
        const e = event as ArrivalDepartureEvent;
        return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${e.airport}${e.time ? ` at ${e.time}` : ''} on ${new Date(e.date).toLocaleDateString()}${e.airline ? ` with ${e.airline}` : ''}${e.flightNumber ? ` (${e.flightNumber})` : ''}`;
      }
      case 'stay': {
        const e = event as StayEvent;
        return `Stay at ${e.accommodationName} from ${new Date(e.checkIn).toLocaleDateString()} to ${new Date(e.checkOut || e.date).toLocaleDateString()}`;
      }
      case 'destination': {
        const e = event as DestinationEvent;
        return `Visit to ${e.placeName} on ${new Date(e.date).toLocaleDateString()}`;
      }
      case 'flight': {
        const e = event as FlightEvent;
        return `Flight from ${e.departureAirport} to ${e.arrivalAirport} on ${new Date(e.date).toLocaleDateString()}${e.airline ? ` with ${e.airline}` : ''}${e.flightNumber ? ` (${e.flightNumber})` : ''}`;
      }
      case 'train': {
        const e = event as TrainEvent;
        return `Train from ${e.departureStation} to ${e.arrivalStation} on ${new Date(e.date).toLocaleDateString()}${e.trainOperator ? ` with ${e.trainOperator}` : ''}${e.trainNumber ? ` (${e.trainNumber})` : ''}`;
      }
      case 'rental_car': {
        const e = event as RentalCarEvent;
        return `Car rental from ${e.pickupLocation} to ${e.dropoffLocation} on ${new Date(e.date).toLocaleDateString()}${e.carCompany ? ` with ${e.carCompany}` : ''}`;
      }
      case 'bus': {
        const e = event as BusEvent;
        return `Bus from ${e.departureStation} to ${e.arrivalStation} on ${new Date(e.date).toLocaleDateString()}${e.busOperator ? ` with ${e.busOperator}` : ''}${e.busNumber ? ` (${e.busNumber})` : ''}`;
      }
      case 'activity': {
        const e = event as ActivityEvent;
        return `${e.title}${e.activityType ? ` (${e.activityType})` : ''} on ${new Date(e.date).toLocaleDateString()}`;
      }
      default:
        return `${event.type} on ${new Date(event.date).toLocaleDateString()}`;
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip || !eventText.trim() || !user) return;

    setIsParsingText(true);
    try {
      const parsedEvents = await parseEventFromText({
        text: eventText,
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

      if (Array.isArray(parsedEvents)) {
        // Multiple events were returned
        const updatedTrip = {
          ...trip,
          events: [...trip.events, ...parsedEvents]
        };
        
        await handleTripUpdate(updatedTrip);
        setTrip(updatedTrip);
        
        // Create a summary of all parsed events
        const eventSummaries = parsedEvents.map(formatEventSummary);
        const summaryMessage = eventSummaries.map(summary => `• ${summary}`).join('\n');
        
        // Close the modal and show confirmation
        setIsModalOpen(false);
        resetEventForm();
        setConfirmationModal({
          isOpen: true,
          title: `Added ${parsedEvents.length} Events`,
          message: summaryMessage,
          onClose: () => setConfirmationModal(prev => ({ ...prev, isOpen: false }))
        });
      } else {
        // Single event was returned
        // Set the form data with the parsed event
        setEventType(parsedEvents.type);
        setEventData({
          ...parsedEvents,
          title: parsedEvents.type === 'activity' ? (parsedEvents as ActivityEvent).title : '',
          activityType: parsedEvents.type === 'activity' ? (parsedEvents as ActivityEvent).activityType : '',
          address: parsedEvents.type === 'activity' ? (parsedEvents as ActivityEvent).address : '',
          description: parsedEvents.type === 'activity' ? (parsedEvents as ActivityEvent).description : ''
        });
        
        // Show a summary of the parsed event
        const eventSummary = formatEventSummary(parsedEvents);
        
        // Switch to the form tab to let user verify/edit
        setActiveEventTab('form');
        setFormFeedback({ 
          type: 'success', 
          message: 'Event details parsed successfully. Please verify below.' 
        });
      }
    } catch (error) {
      setFormFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to parse event details'
      });
    } finally {
      setIsParsingText(false);
    }
  };

  // Add new state for confirmation modal
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onClose: () => {},
  });

  if (loading) {
    return (
      <div className="max-w-full md:max-w-7xl mx-auto px-0 md:px-4 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-full md:max-w-7xl mx-auto px-0 md:px-4 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-full md:max-w-7xl mx-auto px-0 md:px-4 flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-yellow-600 text-xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Trip Not Found</h2>
          <p className="text-gray-600">The requested trip could not be found.</p>
        </div>
      </div>
    );
  }

  const isOwner = user?._id === trip.owner._id;
  const collaborator = trip.collaborators.find(c => 
    isCollaboratorObject(c) && c.user._id === user?._id
  );
  const canEdit = isOwner || (collaborator && getCollaboratorRole(collaborator) === 'editor');

  // console.log('User and ownership debug:', {
  //   userId: user?._id,
  //   userIdType: typeof user?._id,
  //   ownerId: trip.owner._id,
  //   ownerIdType: typeof trip.owner._id,
  //   isOwner,
  //   user,
  //   tripOwner: trip.owner,
  //   collaborator,
  //   canEdit
  // });

  // console.log('Rendering collaborators:', trip.collaborators);

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
    const isAIGenerated = event.source === 'other' && event.notes?.includes('✨ AI-Generated Suggestion');
    
    const getEventIcon = (type: string) => {
      switch (type) {
        case 'arrival':
        case 'departure':
        case 'flight':
          return '✈️';
        case 'stay':
          return '🏨';
        case 'destination':
          return '📍';
        case 'train':
          return '🚂';
        case 'rental_car':
          return '🚗';
        case 'bus':
          return '🚌';
        case 'activity':
          return '🏔️';
        default:
          return '📅';
      }
    };

    const getEventTitle = (event: Event): string => {
      const encodeText = (text: string | undefined | null) => {
        if (!text) return '';
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      switch (event.type) {
        case 'arrival':
        case 'departure': {
          const e = event as ArrivalDepartureEvent;
          return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${encodeText(e.airport || 'Airport')}`;
        }
        case 'stay': {
          const e = event as StayEvent;
          return encodeText(e.accommodationName || 'Accommodation');
        }
        case 'destination': {
          const e = event as DestinationEvent;
          return encodeText(e.placeName || 'Destination');
        }
        case 'flight': {
          const e = event as FlightEvent;
          return encodeText(`${e.airline || ''} ${e.flightNumber || 'Flight'}`.trim());
        }
        case 'train': {
          const e = event as TrainEvent;
          return encodeText(`${e.trainOperator || ''} ${e.trainNumber || 'Train'}`.trim());
        }
        case 'rental_car': {
          const e = event as RentalCarEvent;
          return encodeText(`${e.pickupLocation || ''} to ${e.dropoffLocation || ''}`);
        }
        case 'bus': {
          const e = event as BusEvent;
          return encodeText(`${e.busOperator || ''} ${e.busNumber || 'Bus'}`.trim());
        }
        case 'activity': {
          const activityEvent = event as ActivityEvent;
          return encodeText(`${activityEvent.title || 'Activity'} - ${activityEvent.activityType || ''}`.replace(/ - $/, ''));
        }
        default:
          return 'Event';
      }
    };
    
    return (
      <div
        key={event.id}
        className={`event-card ${isAIGenerated ? 'border-l-4 border-l-indigo-400' : ''} bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden`}
      >
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={(e) => toggleEventExpansion(event.id, e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <span className="text-xl">
                  {event.type === 'destination' ? '📍' : getEventIcon(event.type)}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  {isAIGenerated && (
                    <span className="inline-flex items-center mr-2 text-indigo-600">
                      <SparklesIcon className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">AI Suggested</span>
                    </span>
                  )}
                  {getEventTitle(event)}
                </h3>
                <p className="text-xs text-gray-500">
                  {event.date && new Date(event.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            {/* Rest of the event card content */}
          </div>
        </div>
        {/* Rest of the event card */}
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
            <p>Check-in: {stayEvent.checkIn}</p>
            {stayEvent.checkOut && <p>Check-out: {stayEvent.checkOut}</p>}
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
            {destinationEvent.openingHours && <p>Hours: {destinationEvent.openingHours}</p>}
          </div>
        );
      }
      case 'activity': {
        const activityEvent = event as ActivityEvent;
        return (
          <div className="text-sm text-gray-600">
            <p>Type: {activityEvent.activityType}</p>
            {activityEvent.address && <p>Address: {activityEvent.address}</p>}
            {activityEvent.description && <p>Description: {activityEvent.description}</p>}
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
    bus: '🚌',
    activity: '🏔️'
  } as const;

  const eventTypeToLabel = {
    arrival: 'Arrival',
    departure: 'Departure',
    stay: 'Stay',
    destination: 'Destination',
    flight: 'Flight',
    train: 'Train',
    rental_car: 'Rental Car',
    bus: 'Bus',
    activity: 'Activity'
  } as const;

  const handleTripEdit = () => {
    if (!trip) return;
    const editedTripData: Trip = {
      _id: trip._id,
      name: trip.name,
      description: trip.description || '',
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status || 'planning',
      tags: trip.tags || [],
      thumbnailUrl: trip.thumbnailUrl,
      owner: trip.owner,
      collaborators: trip.collaborators,
      events: trip.events,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic,
      shareableLink: trip.shareableLink
    };
    setEditedTrip(editedTripData);
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
      setTripThumbnail(updatedTrip.thumbnailUrl || '');
      setIsEditingTrip(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    }
  };

  const handleEditEvent = (event: Event) => {
    setIsEditingEvent(event.id);
    setEventType(event.type);

    // Set the airport and airline queries for arrival/departure events
    if (event.type === 'arrival' || event.type === 'departure') {
      const e = event as ArrivalDepartureEvent;
      setAirportQuery(e.airport || '');
      setAirlineQuery(e.airline || '');
    } else if (event.type === 'flight') {
      const e = event as FlightEvent;
      setDepartureAirportQuery(e.departureAirport || '');
      setArrivalAirportQuery(e.arrivalAirport || '');
      setAirlineQuery(e.airline || '');
    }

    setEventData({
      type: event.type,
      date: event.date,
      notes: event.notes || '',
      thumbnailUrl: event.thumbnailUrl || '',
      status: event.status || 'confirmed',
      source: event.source || 'manual',
      location: event.location,
      title: event.type === 'activity' ? (event as ActivityEvent).title || '' : '',
      activityType: event.type === 'activity' ? (event as ActivityEvent).activityType || '' : '',
      address: event.type === 'activity' ? (event as ActivityEvent).address || '' : '',
      description: event.type === 'activity' ? (event as ActivityEvent).description || '' : '',
      ...(event.type === 'arrival' || event.type === 'departure'
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
            dropoffDate: (event as RentalCarEvent).dropoffDate || '',
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
        : {})
    });
    setIsModalOpen(true);
  };

  const renderCollaboratorInfo = (collaborator: string | { user: User; role: 'viewer' | 'editor' }) => {
    if (!isCollaboratorObject(collaborator)) return null;
    
    return (
      <div key={collaborator.user._id} className="relative group">
        <Avatar
          photoUrl={collaborator.user.photoUrl || null}
          name={collaborator.user.name}
          size="md"
          className="ring-2 ring-white"
        />
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {collaborator.user.name} • {collaborator.role}
        </div>
      </div>
    );
  };

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
            {/* AI Suggestions button */}
            <button
              onClick={() => setIsAISuggestionsModalOpen(true)}
              className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Get AI Travel Suggestions"
            >
              <SparklesIcon className="h-5 w-5" />
            </button>

            {/* Expense button */}
            <button
              onClick={() => navigate(`/trips/${id}/expenses`)}
              className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Manage Expenses"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </button>

            {canEdit && (
              <button
                onClick={handleTripEdit}
                className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
                title="Edit Trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
            
            {/* Export button */}
            <button
              onClick={handleExportHTML}
              className="p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Export Itinerary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 001.414 0L9 10.586V3a1 1 0 102 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
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
              .filter(collaborator => 
                isCollaboratorObject(collaborator) && 
                collaborator.user._id !== user?._id
              )
              .map(renderCollaboratorInfo)}
          </div>
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
                    <>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Add Event
                      </button>
                      <button
                        onClick={handleGenerateDestinations}
                        disabled={isGeneratingDestinations}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isGeneratingDestinations ? (
                          <>
                            <SparklesIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                            Suggest Experiences
                          </>
                        )}
                      </button>
                    </>
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
                
                sortedEvents.forEach((event: Event) => {
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
                                          case 'activity':
                                            return <span className="text-2xl">🏔️</span>;
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
                                            return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${(event as ArrivalDepartureEvent).airport || 'Airport'}`;
                                          case 'stay':
                                            return (event as StayEvent).accommodationName || 'Accommodation';
                                          case 'destination':
                                            return (event as DestinationEvent).placeName || 'Destination';
                                          case 'flight': {
                                            const e = event as FlightEvent;
                                            return `${e.airline || ''} ${e.flightNumber || 'Flight'}`.trim();
                                          }
                                          case 'train': {
                                            const e = event as TrainEvent;
                                            return `${e.trainOperator || ''} ${e.trainNumber || 'Train'}`.trim();
                                          }
                                          case 'rental_car': {
                                            const e = event as RentalCarEvent;
                                            return `${e.carCompany || 'Car'} Rental`;
                                          }
                                          case 'bus': {
                                            const e = event as BusEvent;
                                            return `${e.busOperator || ''} ${e.busNumber || 'Bus'}`.trim();
                                          }
                                          case 'activity': {
                                            const e = event as ActivityEvent;
                                            return `${e.title || 'Activity'} - ${e.activityType || ''}`.replace(/ - $/, '');
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
                                                <p>Check-in: {e.date}</p>
                                                {e.checkOut && <p>Check-out: {e.checkOut}</p>}
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
                                          case 'activity': {
                                            const e = event as ActivityEvent;
                                            return (
                                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                <p>Title: {e.title}</p>
                                                <p>Type: {e.activityType}</p>
                                                {e.address && <p>Address: {e.address}</p>}
                                                {e.description && <p>Description: {e.description}</p>}
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
                                                {e.dropoffDate && <p>Dropoff Date: {e.dropoffDate}</p>}
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
              <div className="flex justify-between items-center">
                <div className="flex w-full">
                  <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 py-2 text-base font-medium border-b-2 ${
                      activeTab === 'map'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Map
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-2 text-base font-medium border-b-2 ${
                      activeTab === 'notes'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Notes
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="h-full">
                {activeTab === 'map' && mapTripData && <TripMap trip={mapTripData} />}
                {activeTab === 'notes' && trip && (
                  <TripNotes
                    tripId={trip._id}
                    canEdit={trip.owner._id === user?._id || trip.collaborators.some(c => 
                      typeof c === 'object' && c.role === 'editor' && c.user._id === user?._id
                    )}
                  />
                )}
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
                  setEventText('');
                  setActiveEventTab('form');
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Buttons */}
            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => setActiveEventTab('text')}
                className={`flex-1 py-2 text-sm font-medium rounded-md ${
                  activeEventTab === 'text'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <SparklesIcon className="h-5 w-5" />
                  <span>AI Parse Text/Email</span>
                </div>
              </button>
              <button
                onClick={() => setActiveEventTab('form')}
                className={`flex-1 py-2 text-sm font-medium rounded-md ${
                  activeEventTab === 'form'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Manual Entry
              </button>
            </div>

            {/* Form Feedback */}
            {formFeedback.message && (
              <div
                className={`mb-4 p-4 rounded-md ${
                  formFeedback.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}
              >
                {formFeedback.message}
              </div>
            )}

            {activeEventTab === 'form' ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => handleEventTypeChange(e.target.value as EventType)}
                  className="input"
                >
                  <option value="arrival">✈️ Arrival</option>
                  <option value="departure">✈️ Departure</option>
                  <option value="stay">🏨 Stay</option>
                  <option value="destination">📍 Destination</option>
                  <option value="flight">✈️ Flight</option>
                  <option value="train">🚂 Train</option>
                  <option value="rental_car">🚗 Rental Car</option>
                  <option value="bus">🚌 Bus</option>
                  <option value="activity">🏔️ Activity</option>
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
            ) : (
              <form onSubmit={handleTextSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Paste Reservation Email or Describe Event
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 right-3">
                      <SparklesIcon className="h-5 w-5 text-indigo-500 animate-pulse" />
          </div>
                    <textarea
                      value={eventText}
                      onChange={(e) => setEventText(e.target.value)}
                      className="input min-h-[200px] pr-10"
                      placeholder="Paste any travel confirmation email (flights, hotels, trains, car rentals) or describe your event in natural language..."
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEventText('');
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex items-center space-x-2"
                    disabled={isParsingText}
                  >
                    {isParsingText ? (
                      <>
                        <SparklesIcon className="h-5 w-5 animate-spin" />
                        <span>Parsing...</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-5 w-5" />
                        <span>Parse with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
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

      {/* Add AI Suggestions Modal */}
      {trip && (
        <AISuggestionsModal
          isOpen={isAISuggestionsModalOpen}
          onClose={() => setIsAISuggestionsModalOpen(false)}
          tripDates={{
            startDate: trip.startDate,
            endDate: trip.endDate,
          }}
          onSubmit={handleAISuggestionsSubmit}
          history={suggestionsHistory}
          onSelectHistoryItem={handleSelectHistoryItem}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          getCreatorInfo={getCreatorInfo}
        />
      )}

      {/* Add AI Suggestions Display */}
      {aiSuggestions && (
        <AISuggestionsDisplay
          suggestions={aiSuggestions}
          onClose={() => setAISuggestions(null)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 1100 }}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-3 w-0 flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {confirmationModal.title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 whitespace-pre-line">
                    {confirmationModal.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={confirmationModal.onClose}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripDetails; 