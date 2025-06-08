import { 
  Event, 
  EventType, 
  ArrivalDepartureEvent, 
  StayEvent, 
  DestinationEvent, 
  FlightEvent,
  TrainEvent,
  RentalCarEvent,
  BusEvent,
  ActivityEvent 
} from '@/types/eventTypes';

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

// Local/Base64 placeholder image for offline use
const OFFLINE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMjAgODBIMTgwVjEyMEgxMjBWODBaIiBmaWxsPSIjZDFkNWRiIi8+CjxjaXJjbGUgY3g9IjE0MCIgY3k9IjkwIiByPSI1IiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik0xMzAgMTEwTDE0NSA5NUwxNjAgMTEwSDE3MFYxMjBIMTMwVjExMFoiIGZpbGw9IiM5Y2EzYWYiLz4KPHRleHQgeD0iMTUwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+T2ZmbGluZTwvdGV4dD4KPC9zdmc+';

// Default thumbnails for each event type - using more reliable sources
const DEFAULT_THUMBNAILS: { [key: string]: string } = {
  arrival: OFFLINE_PLACEHOLDER,
  departure: OFFLINE_PLACEHOLDER,
  stay: OFFLINE_PLACEHOLDER,
  destination: OFFLINE_PLACEHOLDER,
  flight: OFFLINE_PLACEHOLDER,
  train: OFFLINE_PLACEHOLDER,
  rental_car: OFFLINE_PLACEHOLDER,
  bus: OFFLINE_PLACEHOLDER,
  activity: OFFLINE_PLACEHOLDER,
  default: OFFLINE_PLACEHOLDER
};

// Predefined thumbnails for common scenarios - using local placeholder when offline
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
  default: OFFLINE_PLACEHOLDER
};

const getSearchTerm = (event: Event): string => {
  switch (event.type) {
    case 'stay':
      return (event as StayEvent).accommodationName || 'hotel accommodation';
    case 'destination':
      return (event as DestinationEvent).placeName || 'travel destination';
    case 'arrival':
    case 'departure':
      return (event as ArrivalDepartureEvent).airport || 'airport terminal';
    case 'flight':
      return (event as FlightEvent).arrivalAirport || (event as FlightEvent).departureAirport || 'airplane';
    case 'train':
      return (event as TrainEvent).arrivalStation || (event as TrainEvent).departureStation || 'train station';
    case 'rental_car':
      return (event as RentalCarEvent).pickupLocation || (event as RentalCarEvent).dropoffLocation || 'car rental';
    case 'bus':
      return (event as BusEvent).departureStation || (event as BusEvent).arrivalStation || 'bus station';
    case 'activity': {
      const activityEvent = event as ActivityEvent;
      return `${activityEvent.activityType} ${activityEvent.title}`.trim() || 'outdoor activity';
    }
    default:
      return 'travel destination';
    }
};

const fetchFromPexels = async (searchTerm: string): Promise<string | null> => {
  // Skip Pexels API when offline to avoid network errors - no logging noise
  if (!navigator.onLine) {
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`,
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
      return data.photos[0].src.large2x;
    }
  } catch (error) {
    // Only log errors when online to reduce noise
    if (navigator.onLine) {
      console.warn('Failed to fetch from Pexels:', error);
    }
  }
  return null;
};

export const getEventThumbnail = async (event: Event): Promise<string> => {
  // 1. Check for user-provided thumbnail URL
  if (event.thumbnailUrl) {
    return event.thumbnailUrl;
  }

  const searchTerm = getSearchTerm(event);
  const cacheKey = `${event.type}-${searchTerm}`;

  // Check cache
  if (thumbnailCache[cacheKey]) {
    return thumbnailCache[cacheKey];
  }

  // 2. When offline, skip API and go straight to predefined/default
  if (!navigator.onLine) {
    const offlineThumbnail = getOfflineFallback(searchTerm, event.type);
    thumbnailCache[cacheKey] = offlineThumbnail;
    return offlineThumbnail;
  }

  // 3. Try Pexels API (only when online)
  const pexelsImage = await fetchFromPexels(searchTerm);
  if (pexelsImage) {
    thumbnailCache[cacheKey] = pexelsImage;
    return pexelsImage;
  }

  // 4. Fallback to predefined/default
  const fallbackThumbnail = getOfflineFallback(searchTerm, event.type);
  thumbnailCache[cacheKey] = fallbackThumbnail;
  return fallbackThumbnail;
};

export const getDefaultThumbnail = async (tripName: string): Promise<string> => {
  // Check cache first
  if (thumbnailCache[tripName]) {
    return thumbnailCache[tripName];
  }

  // When offline, use offline fallback immediately
  if (!navigator.onLine) {
    const offlineThumbnail = getOfflineFallback(tripName);
    thumbnailCache[tripName] = offlineThumbnail;
    return offlineThumbnail;
  }

  // Try Pexels API (only when online)
  const pexelsImage = await fetchFromPexels(tripName);
  if (pexelsImage) {
    thumbnailCache[tripName] = pexelsImage;
    return pexelsImage;
  }

  // Fallback to predefined/default
  const fallbackThumbnail = getOfflineFallback(tripName);
  thumbnailCache[tripName] = fallbackThumbnail;
  return fallbackThumbnail;
};

// Helper function to get offline fallback
const getOfflineFallback = (searchTerm: string, eventType?: string): string => {
  const lowercaseName = searchTerm.toLowerCase();
  
  // Check predefined thumbnails
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      // If offline and it's a Pexels URL, use offline placeholder
      return navigator.onLine ? url : OFFLINE_PLACEHOLDER;
    }
  }
  
  // Use event type default or general offline placeholder
  if (eventType && DEFAULT_THUMBNAILS[eventType]) {
    return DEFAULT_THUMBNAILS[eventType];
  }
  
  return OFFLINE_PLACEHOLDER;
};

// Export constants for potential use elsewhere
export { DEFAULT_THUMBNAILS, PREDEFINED_THUMBNAILS };


