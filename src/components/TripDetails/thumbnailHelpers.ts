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

// Default thumbnails for each event type
const DEFAULT_THUMBNAILS: { [key: string]: string } = {
  arrival: 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300',
  departure: 'https://images.pexels.com/photos/723240/pexels-photo-723240.jpeg?auto=compress&cs=tinysrgb&w=300',
  stay: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=300',
  destination: 'https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=300',
  flight: 'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg?auto=compress&cs=tinysrgb&w=300',
  train: 'https://images.pexels.com/photos/302428/pexels-photo-302428.jpeg?auto=compress&cs=tinysrgb&w=300',
  rental_car: 'https://images.pexels.com/photos/30292047/pexels-photo-30292047.jpeg?auto=compress&cs=tinysrgb&w=300',
  bus: 'https://images.pexels.com/photos/3608967/pexels-photo-3608967.jpeg?auto=compress&cs=tinysrgb&w=300',
  activity: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=300',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=300'
};

// Predefined thumbnails for common scenarios
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
    console.warn('Failed to fetch from Pexels:', error);
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

  // 2. Try Pexels API
  const pexelsImage = await fetchFromPexels(searchTerm);
  if (pexelsImage) {
    thumbnailCache[cacheKey] = pexelsImage;
    return pexelsImage;
  }

  // 3. Check predefined thumbnails
  const lowercaseName = searchTerm.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[cacheKey] = url;
      return url;
    }
  }

  // 4. Fallback to default event type thumbnail
  const defaultThumbnail = DEFAULT_THUMBNAILS[event.type as EventType] || DEFAULT_THUMBNAILS.default;
  thumbnailCache[cacheKey] = defaultThumbnail;
  return defaultThumbnail;
};

export const getDefaultThumbnail = async (tripName: string): Promise<string> => {
  // Check cache first
  if (thumbnailCache[tripName]) {
    return thumbnailCache[tripName];
  }

  // 1. Try Pexels API
  const pexelsImage = await fetchFromPexels(tripName);
  if (pexelsImage) {
    thumbnailCache[tripName] = pexelsImage;
    return pexelsImage;
  }

  // 2. Check predefined thumbnails
  const lowercaseName = tripName.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[tripName] = url;
      return url;
    }
  }

  // 3. Fallback to default travel image
  const defaultThumbnail = PREDEFINED_THUMBNAILS.default;
  thumbnailCache[tripName] = defaultThumbnail;
  return defaultThumbnail;
};

// Export constants for potential use elsewhere
export { DEFAULT_THUMBNAILS, PREDEFINED_THUMBNAILS };
