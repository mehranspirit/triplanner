import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Trip, Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent, BusEvent, ActivityEvent } from '@/types/eventTypes';
import { sortEventsByStart } from '@/utils/eventTime';
import { eventHasMapCoordinates } from '@/utils/eventLocation';
import { api } from '@/services/api';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom marker icons for different event statuses (legacy pin icons)
const blueIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const violetIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

// Function to get the appropriate icon based on event status
const getMarkerIcon = (event: Event) => {
  if (!event.status || event.status === 'confirmed') {
    return blueIcon;
  } else if (event.status === 'exploring') {
    return greenIcon;
  } else if (event.status === 'alternative') {
    return violetIcon;
  }
  return blueIcon; // Default fallback
};

const getLocationGroupKey = (lat: number, lon: number) => (
  `${lat.toFixed(4)},${lon.toFixed(4)}`
);

const createNumberedMarkerIcon = (label: string, variant: 'confirmed' | 'exploring') => {
  const colors = {
    confirmed: { bg: '#2563eb' },
    exploring: { bg: '#16a34a' },
  };
  const { bg } = colors[variant];
  const fontSize = label.length > 5 ? '8px' : label.length > 3 ? '9px' : '12px';

  return L.divIcon({
    className: 'numbered-map-marker-icon',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: ${bg};
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
        color: #ffffff;
        font-size: ${fontSize};
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.1;
        padding: 2px;
        box-sizing: border-box;
      ">${label}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

interface GroupedMapMarker {
  lat: number;
  lon: number;
  timelineNumbers: number[];
  label: string;
  locations: Location[];
}

interface TripMapProps {
  trip: Trip;
}

interface Location {
  lat: number;
  lon: number;
  displayName: string;
  event: Event;
  endpointRole?: 'departure' | 'arrival' | 'single';
}

interface RouteInfo {
  coordinates: [number, number][];
  duration: number;
  distance: number;
  type: 'driving' | 'train' | 'flight';
  departureTime?: string;
  arrivalTime?: string;
  timestamp: number;
}

// Create module-level caches that persist across component mounts/unmounts
const routeCache: Record<string, RouteInfo> = {};

// Cache duration constants
const ROUTE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Function to get a cache key for a route
const getRouteCacheKey = (startLat: number, startLon: number, endLat: number, endLon: number): string => {
  return `route_${startLat}_${startLon}_${endLat}_${endLon}`;
};

// Function to check if cache entry is valid
const isCacheValid = (timestamp: number, duration: number): boolean => {
  return Date.now() - timestamp < duration;
};

// Load cached route data from localStorage on module initialization
try {
  const savedRoutes = localStorage.getItem('tripMapRouteCache');
  if (savedRoutes) {
    const parsedRoutes = JSON.parse(savedRoutes);
    Object.assign(routeCache, parsedRoutes);
  }
} catch (err) {
  console.warn('Failed to load cache from localStorage:', err);
}

// Function to save route cache to localStorage
const saveRouteCache = () => {
  try {
    const now = Date.now();
    const validRoutes = Object.entries(routeCache).reduce((acc, [key, value]) => {
      if (isCacheValid(value.timestamp || now, ROUTE_CACHE_DURATION)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, RouteInfo>);

    localStorage.setItem('tripMapRouteCache', JSON.stringify(validRoutes));
  } catch (err) {
    console.warn('Failed to save route cache to localStorage:', err);
  }
};

const attachEventMeta = (event: Partial<Event> & Record<string, unknown>): Event => ({
  ...event,
  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Event);

const getEventMapDisplayName = (event: Partial<Event> & Record<string, unknown>): string => {
  switch (event.type) {
    case 'stay':
      return String(event.accommodationName || 'Stay');
    case 'destination':
      return String(event.placeName || 'Destination');
    case 'activity':
      return String(event.title || 'Activity');
    case 'flight':
      return event.flightNumber ? `Flight ${event.flightNumber}` : 'Flight';
    case 'train':
      return event.trainNumber ? `Train ${event.trainNumber}` : 'Train';
    case 'bus':
      return event.busNumber ? `Bus ${event.busNumber}` : 'Bus';
    case 'rental_car':
      return event.carCompany ? `${event.carCompany} rental car` : 'Rental car';
    case 'arrival':
    case 'departure':
      return `${event.type} ${event.airport || ''}`.trim();
    default:
      return String(event.type || 'Event');
  }
};

const buildStoredEventLocation = (
  event: Partial<Event> & Record<string, unknown>,
  endpointRole: Location['endpointRole'] = 'single',
): Location | null => {
  const fullEvent = event as unknown as Event;
  if (!eventHasMapCoordinates(fullEvent) || !fullEvent.location) {
    return null;
  }

  return {
    lat: Number(fullEvent.location.lat),
    lon: Number(fullEvent.location.lng),
    displayName: fullEvent.location.address || getEventMapDisplayName(event),
    endpointRole,
    event: attachEventMeta(event),
  };
};

const TRANSPORT_EVENT_TYPES = new Set<EventType>(['flight', 'train', 'bus', 'rental_car']);

const getTransportEndpointQueries = (
  event: Partial<Event> & Record<string, unknown>,
): { departure?: string; arrival?: string } => {
  switch (event.type) {
    case 'flight':
      return {
        departure: event.departureAirport ? String(event.departureAirport) : undefined,
        arrival: event.arrivalAirport ? String(event.arrivalAirport) : undefined,
      };
    case 'train':
    case 'bus':
      return {
        departure: event.departureStation ? String(event.departureStation) : undefined,
        arrival: event.arrivalStation ? String(event.arrivalStation) : undefined,
      };
    case 'rental_car':
      return {
        departure: event.pickupLocation ? String(event.pickupLocation) : undefined,
        arrival: event.dropoffLocation ? String(event.dropoffLocation) : undefined,
      };
    default:
      return {};
  }
};

const geocodeTransportEndpoint = async (
  query: string | undefined,
  event: Partial<Event> & Record<string, unknown>,
  endpointRole: 'departure' | 'arrival',
): Promise<Location | null> => {
  if (!query?.trim()) {
    return null;
  }

  try {
    const geocoded = await api.geocodeQuery(query.trim());
    if (!geocoded) {
      return null;
    }

    return {
      lat: Number(geocoded.lat),
      lon: Number(geocoded.lng),
      displayName: geocoded.displayName || query,
      endpointRole,
      event: attachEventMeta(event),
    };
  } catch (error) {
    console.warn(`Error geocoding transport endpoint "${query}":`, error);
    return null;
  }
};

const buildStoredEndpointLocation = (
  event: Partial<Event> & Record<string, unknown>,
  endpointRole: 'departure' | 'arrival',
  locationField: 'departureLocation' | 'arrivalLocation',
): Location | null => {
  const endpointLocation = event[locationField] as Event['location'] | undefined;
  if (!endpointLocation) {
    return null;
  }

  const endpointEvent = {
    ...event,
    location: endpointLocation,
  };

  if (!eventHasMapCoordinates(endpointEvent as Event)) {
    return null;
  }

  return {
    lat: Number(endpointLocation.lat),
    lon: Number(endpointLocation.lng),
    displayName: endpointLocation.address || getEventMapDisplayName(event),
    endpointRole,
    event: attachEventMeta(endpointEvent),
  };
};

const resolveTransportEventLocations = async (
  event: Partial<Event> & Record<string, unknown>,
): Promise<Location[]> => {
  const { departure, arrival } = getTransportEndpointQueries(event);
  const locations: Location[] = [];

  const storedDeparture = buildStoredEndpointLocation(event, 'departure', 'departureLocation');
  if (storedDeparture) {
    locations.push(storedDeparture);
  } else {
    const departureLocation = await geocodeTransportEndpoint(departure, event, 'departure');
    if (departureLocation) {
      locations.push(departureLocation);
    }
  }

  const storedArrival = buildStoredEndpointLocation(event, 'arrival', 'arrivalLocation');
  if (storedArrival) {
    locations.push(storedArrival);
  } else {
    const arrivalLocation = await geocodeTransportEndpoint(arrival, event, 'arrival');
    if (arrivalLocation) {
      locations.push(arrivalLocation);
    }
  }

  return locations;
};

const resolveMapLocations = async (
  events: ReturnType<typeof extractMapRelevantData>['events'],
  shouldContinue: () => boolean,
): Promise<{ locations: Location[]; skippedEvents: { eventId: string; label: string; reason: string }[] }> => {
  const locations: Location[] = [];
  const skippedEvents: { eventId: string; label: string; reason: string }[] = [];

  for (const event of events) {
    if (!shouldContinue()) {
      break;
    }

    if (TRANSPORT_EVENT_TYPES.has(event.type as EventType)) {
      const transportLocations = await resolveTransportEventLocations(event);
      if (transportLocations.length > 0) {
        locations.push(...transportLocations);
        continue;
      }

      skippedEvents.push({
        eventId: event.id,
        label: getEventMapDisplayName(event),
        reason: 'Could not map transport endpoints',
      });
      continue;
    }

    const storedLocation = buildStoredEventLocation(event);
    if (storedLocation) {
      locations.push(storedLocation);
      continue;
    }

    skippedEvents.push({
      eventId: event.id,
      label: getEventMapDisplayName(event),
      reason: 'No geocoded coordinates — use Review locations',
    });
  }

  return { locations, skippedEvents };
};

// Extract only the event data needed for the map to prevent unnecessary re-renders
const extractMapRelevantData = (trip: Trip) => {
  return {
    id: trip._id,
    name: trip.name,
    events: sortEventsByStart(trip.events).map(event => ({
      id: event.id,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      departureLocation: 'departureLocation' in event ? event.departureLocation : undefined,
      arrivalLocation: 'arrivalLocation' in event ? event.arrivalLocation : undefined,
      status: event.status,
      // Type-specific fields
      airport: 'airport' in event ? event.airport : undefined,
      accommodationName: 'accommodationName' in event ? event.accommodationName : undefined,
      address: 'address' in event ? event.address : undefined,
      placeName: 'placeName' in event ? event.placeName : undefined,
      title: 'title' in event ? event.title : undefined,
      checkIn: 'checkIn' in event ? event.checkIn : undefined,
      checkOut: 'checkOut' in event ? event.checkOut : undefined,
      airline: 'airline' in event ? event.airline : undefined,
      flightNumber: 'flightNumber' in event ? event.flightNumber : undefined,
      // Flight event fields
      departureAirport: 'departureAirport' in event ? event.departureAirport : undefined,
      arrivalAirport: 'arrivalAirport' in event ? event.arrivalAirport : undefined,
      // Train event fields
      trainOperator: 'trainOperator' in event ? event.trainOperator : undefined,
      trainNumber: 'trainNumber' in event ? event.trainNumber : undefined,
      departureStation: 'departureStation' in event ? event.departureStation : undefined,
      arrivalStation: 'arrivalStation' in event ? event.arrivalStation : undefined,
      // Rental car event fields
      carCompany: 'carCompany' in event ? event.carCompany : undefined,
      carType: 'carType' in event ? event.carType : undefined,
      pickupLocation: 'pickupLocation' in event ? event.pickupLocation : undefined,
      dropoffLocation: 'dropoffLocation' in event ? event.dropoffLocation : undefined,
      // Bus event fields
      busOperator: 'busOperator' in event ? event.busOperator : undefined,
      busNumber: 'busNumber' in event ? event.busNumber : undefined,
      departureTime: 'departureTime' in event ? event.departureTime : undefined,
      arrivalTime: 'arrivalTime' in event ? event.arrivalTime : undefined,
      seatNumber: 'seatNumber' in event ? event.seatNumber : undefined,
      bookingReference: 'bookingReference' in event ? event.bookingReference : undefined,
    }))
  };
};

const RATE_LIMIT_DELAY = 1100;
const MAX_RETRIES = 3;
const BACKOFF_FACTOR = 1.5; // Exponential backoff factor

// Add retry function for fetch requests with exponential backoff
const fetchWithRetry = async (url: string, retries = MAX_RETRIES, delay = RATE_LIMIT_DELAY): Promise<Response> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) { // Too Many Requests
        throw new Error('RATE_LIMITED');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      const isRateLimited = error instanceof Error && error.message === 'RATE_LIMITED';
      const nextDelay = isRateLimited ? delay * BACKOFF_FACTOR : delay;
      await new Promise(resolve => setTimeout(resolve, nextDelay));
      return fetchWithRetry(url, retries - 1, nextDelay);
    }
    throw error;
  }
};

const TripMap: React.FC<TripMapProps> = ({ trip }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [unmappedEvents, setUnmappedEvents] = useState<{ eventId: string; label: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  const loadingRef = useRef<boolean>(true); // Add ref to track loading state
  const routeEndpointEventTypes = new Set<EventType>(['flight', 'train', 'bus', 'rental_car']);

  const eventTimelineNumbers = useMemo(() => {
    const timelineNumbers = new Map<string, number>();
    sortEventsByStart(trip.events).forEach((event, index) => {
      timelineNumbers.set(event.id, index + 1);
    });
    return timelineNumbers;
  }, [trip.events]);

  const groupedMarkers = useMemo(() => {
    const groups = new Map<string, GroupedMapMarker>();

    locations.forEach((location) => {
      const timelineNumber = eventTimelineNumbers.get(location.event.id);
      if (timelineNumber === undefined) {
        return;
      }

      const key = getLocationGroupKey(location.lat, location.lon);
      const existing = groups.get(key);

      if (existing) {
        if (!existing.timelineNumbers.includes(timelineNumber)) {
          existing.timelineNumbers.push(timelineNumber);
        }
        existing.locations.push(location);
        return;
      }

      groups.set(key, {
        lat: location.lat,
        lon: location.lon,
        timelineNumbers: [timelineNumber],
        label: String(timelineNumber),
        locations: [location],
      });
    });

    return Array.from(groups.values()).map((group) => {
      const timelineNumbers = [...group.timelineNumbers].sort((left, right) => left - right);
      return {
        ...group,
        timelineNumbers,
        label: timelineNumbers.join(', '),
      };
    });
  }, [locations, eventTimelineNumbers]);

  const getMarkerVariant = (markerLocations: Location[]): 'confirmed' | 'exploring' => {
    const statuses = markerLocations.map((location) => {
      const originalEvent = trip.events.find((event) => event.id === location.event.id);
      return originalEvent?.status || location.event.status || 'confirmed';
    });

    if (statuses.some((status) => status === 'exploring')) {
      return 'exploring';
    }

    return 'confirmed';
  };

  const mapRelevantData = useMemo(() => extractMapRelevantData(trip), [
    trip._id,
    trip.name,
    trip.events.map(event => {
      const eventData = event as any;
      return [
        event.id,
        event.status,
        event.type,
        event.startDate,
        event.endDate,
        event.location?.lat,
        event.location?.lng,
        event.location?.address,
        eventData.address,
        eventData.airport,
        eventData.accommodationName,
        eventData.placeName,
        eventData.title,
        eventData.departureAirport,
        eventData.arrivalAirport,
        eventData.departureStation,
        eventData.arrivalStation,
        eventData.pickupLocation,
        eventData.dropoffLocation
      ].join('-');
    }).join(',')
  ]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Set loading ref to false when component unmounts
      loadingRef.current = false;
    };
  }, []);

  // Add a useEffect to force map update when locations change
  useEffect(() => {
    if (mapRef.current && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lon]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations]);

  // Add a useEffect to force map update when routes change
  useEffect(() => {
    if (mapRef.current && routes.length > 0) {
      const bounds = L.latLngBounds(routes.flatMap(route => route.coordinates));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes]);

  const fetchRoute = async (start: Location, end: Location, type: 'driving' | 'train' | 'flight' = 'driving'): Promise<RouteInfo | null> => {
    try {
      const cacheKey = getRouteCacheKey(start.lat, start.lon, end.lat, end.lon);
      const cachedRoute = routeCache[cacheKey];
      
      if (cachedRoute && isCacheValid(cachedRoute.timestamp, ROUTE_CACHE_DURATION)) {
        return { ...cachedRoute, type };
      }
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      let route: RouteInfo;

      if (type === 'driving') {
        const response = await fetchWithRetry(
          `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`
        );

        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
          return null;
        }

        route = {
          coordinates: data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]),
          duration: data.routes[0].duration,
          distance: data.routes[0].distance,
          type: 'driving',
          timestamp: Date.now()
        };

        // Cache the result
        routeCache[cacheKey] = route;
        saveRouteCache();
      } else if (type === 'flight') {
        const distance = calculateDistance(start.lat, start.lon, end.lat, end.lon);
        const coordinates = generateFlightPath(start.lat, start.lon, end.lat, end.lon);
        
        route = {
          coordinates,
          duration: Math.round(distance / 800 * 60),
          distance,
          type: 'flight',
          departureTime: new Date().toISOString(),
          arrivalTime: new Date(Date.now() + Math.round(distance / 800 * 60) * 60000).toISOString(),
          timestamp: Date.now()
        };
      } else {
        // For train routes, use a simple straight line
        route = {
          coordinates: [[start.lat, start.lon], [end.lat, end.lon]],
          duration: 0,
          distance: calculateDistance(start.lat, start.lon, end.lat, end.lon),
          type: 'train',
          timestamp: Date.now()
        };
      }
      
      return route;
    } catch (err) {
      console.warn('Error fetching route:', err);
      // Fallback to straight line for any type if there's an error
      return {
        coordinates: [[start.lat, start.lon], [end.lat, end.lon]],
        duration: 0,
        distance: calculateDistance(start.lat, start.lon, end.lat, end.lon),
        type,
        timestamp: Date.now()
      };
    }
  };

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance in meters
  };

  const toRad = (value: number): number => {
    return value * Math.PI / 180;
  };

  // Helper function to generate a curved flight path
  const generateFlightPath = (lat1: number, lon1: number, lat2: number, lon2: number): [number, number][] => {
    const points: [number, number][] = [];
    const steps = 50;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;
      
      // Add a curve to the path
      const curve = Math.sin(t * Math.PI) * 0.5;
      points.push([lat + curve, lon] as [number, number]);
    }
    
    return points;
  };

  useEffect(() => {
    const loadMapData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        loadingRef.current = true;

        const { locations: validLocations, skippedEvents } = await resolveMapLocations(
          mapRelevantData.events,
          () => loadingRef.current,
        );

        if (!loadingRef.current) {
          return;
        }

        setLocations(validLocations);
        setUnmappedEvents(skippedEvents);

        const confirmedLocations = validLocations.filter(
          (loc) => !loc.event.status || loc.event.status === 'confirmed',
        );

        const routePromises: Promise<RouteInfo | null>[] = [];
        for (let i = 0; i < confirmedLocations.length - 1; i += 1) {
          if (!loadingRef.current) {
            break;
          }

          const currentEvent = confirmedLocations[i].event;
          const nextEvent = confirmedLocations[i + 1].event;
          const isSameTransportEvent =
            currentEvent.id === nextEvent.id &&
            routeEndpointEventTypes.has(currentEvent.type) &&
            confirmedLocations[i].endpointRole === 'departure' &&
            confirmedLocations[i + 1].endpointRole === 'arrival';

          let routeType: 'driving' | 'train' | 'flight' = 'driving';

          if (isSameTransportEvent) {
            if (currentEvent.type === 'train' || currentEvent.type === 'bus') {
              routeType = 'train';
            } else if (currentEvent.type === 'flight') {
              routeType = 'flight';
            }
          }

          routePromises.push(fetchRoute(confirmedLocations[i], confirmedLocations[i + 1], routeType));
        }

        const routeResults = await Promise.all(routePromises);
        if (!loadingRef.current) {
          return;
        }

        const validRoutes = routeResults.filter((route): route is RouteInfo => route !== null);
        setRoutes(validRoutes);

        if (validLocations.length > 0 && mapRef.current) {
          const bounds = L.latLngBounds(validLocations.map((loc) => [loc.lat, loc.lon]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (err) {
        if (loadingRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
        }
      } finally {
        if (loadingRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadMapData();
  }, [mapRelevantData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || groupedMarkers.length === 0) {
    return (
      <div className="flex justify-center items-center h-full bg-gray-50 rounded-lg">
        <p className="text-gray-500">{error || 'No locations found'}</p>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventDetails = (event: Event) => {
    switch (event.type) {
      case 'arrival':
      case 'departure':
        return {
          title: `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} - ${(event as ArrivalDepartureEvent).airport}`,
          details: `${(event as ArrivalDepartureEvent).airline} ${(event as ArrivalDepartureEvent).flightNumber}`,
          date: formatDate(event.startDate)
        };
      case 'stay':
        return {
          title: (event as StayEvent).accommodationName,
          details: (event as StayEvent).address || '',
          date: `${formatDate((event as StayEvent).checkIn)} - ${formatDate((event as StayEvent).checkOut)}`
        };
      case 'destination':
        return {
          title: (event as DestinationEvent).placeName,
          details: (event as DestinationEvent).address || '',
          date: formatDate(event.startDate)
        };
      case 'flight': {
        const flightEvent = event as FlightEvent;
        return {
          title: `${flightEvent.airline || 'Flight'} ${flightEvent.flightNumber || ''}`,
          details: `${flightEvent.departureAirport || ''} to ${flightEvent.arrivalAirport || ''}`,
          date: formatDate(event.startDate)
        };
      }
      case 'train': {
        const trainEvent = event as TrainEvent;
        return {
          title: `${trainEvent.trainOperator || 'Train'} ${trainEvent.trainNumber || ''}`,
          details: `${trainEvent.departureStation || ''} to ${trainEvent.arrivalStation || ''}`,
          date: formatDate(event.startDate),
          additionalInfo: [
            trainEvent.departureTime && `Departure: ${trainEvent.departureTime}`,
            trainEvent.arrivalTime && `Arrival: ${trainEvent.arrivalTime}`,
            trainEvent.seatNumber && `Seat: ${trainEvent.seatNumber}`,
            trainEvent.bookingReference && `Booking Reference: ${trainEvent.bookingReference}`
          ].filter(Boolean).join(' • ')
        };
      }
      case 'rental_car': {
        const carEvent = event as RentalCarEvent;
        return {
          title: `${carEvent.carCompany || 'Rental Car'}`,
          details: `${carEvent.pickupLocation || ''} to ${carEvent.dropoffLocation || ''}`,
          date: formatDate(event.startDate)
        };
      }
      case 'bus': {
        const busEvent = event as BusEvent;
        return {
          title: `${busEvent.busOperator || 'Bus'} ${busEvent.busNumber || ''}`,
          details: `${busEvent.departureStation || ''} to ${busEvent.arrivalStation || ''}`,
          date: formatDate(event.startDate),
          additionalInfo: [
            busEvent.departureTime && `Departure: ${busEvent.departureTime}`,
            busEvent.arrivalTime && `Arrival: ${busEvent.arrivalTime}`,
            busEvent.seatNumber && `Seat: ${busEvent.seatNumber}`,
            busEvent.bookingReference && `Booking Reference: ${busEvent.bookingReference}`
          ].filter(Boolean).join(' • ')
        };
      }
      case 'activity': {
        const activityEvent = event as ActivityEvent;
        return {
          title: activityEvent.title || 'Activity',
          details: activityEvent.description || '',
          date: formatDate(event.startDate),
          additionalInfo: activityEvent.activityType
        };
      }
      default:
        return {
          title: 'Event',
          details: '',
          date: formatDate(event.startDate)
        };
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (meters: number): string => {
    const km = Math.round(meters / 100) / 10;
    return `${km} km`;
  };

  return (
    <div className="h-full rounded-lg overflow-hidden [&_.leaflet-pane]:!z-[1] [&_.leaflet-control]:!z-[2] [&_.leaflet-top]:!z-[2] [&_.leaflet-bottom]:!z-[2]">
      <MapContainer
        key={`map-container-${trip._id}-${Date.now()}`}
        center={[groupedMarkers[0]?.lat || locations[0]?.lat || 0, groupedMarkers[0]?.lon || locations[0]?.lon || 0]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          crossOrigin="anonymous"
          maxNativeZoom={19}
          maxZoom={19}
          updateWhenIdle={true}
          updateWhenZooming={false}
          subdomains={['a', 'b', 'c']}
        />
        
        {/* Render routes */}
        {routes.map((route, index) => (
          <Polyline
            key={`route-${route.type}-${index}-${Date.now()}`}
            positions={route.coordinates}
            color={route.type === 'driving' ? '#2563EB' : route.type === 'train' ? '#059669' : '#7C3AED'}
            weight={route.type === 'driving' ? 3 : 4}
            opacity={0.7}
            dashArray={route.type === 'train' ? '10, 10' : undefined}
          >
            {route.type === 'driving' && (
              <Tooltip permanent direction="center" offset={[0, -10]} className="bg-white px-2 py-1 rounded shadow text-xs font-medium">
                {formatDuration(route.duration / 60)}
              </Tooltip>
            )}
          </Polyline>
        ))}

        {/* Render markers */}
        {groupedMarkers.map((marker) => {
          const markerVariant = getMarkerVariant(marker.locations);
          const markerEntries = marker.timelineNumbers
            .map((timelineNumber) => {
              const location = marker.locations.find(
                (entry) => eventTimelineNumbers.get(entry.event.id) === timelineNumber
              ) || marker.locations[0];

              return {
                timelineNumber,
                location,
                eventDetails: getEventDetails(location.event),
                originalEvent: trip.events.find((event) => event.id === location.event.id),
              };
            })
            .sort((left, right) => left.timelineNumber - right.timelineNumber);

          return (
            <Marker
              key={`marker-group-${marker.label}-${marker.lat}-${marker.lon}`}
              position={[marker.lat, marker.lon]}
              icon={createNumberedMarkerIcon(marker.label, markerVariant)}
            >
              <Popup>
                <div className="space-y-3">
                  {markerEntries.map(({ timelineNumber, eventDetails, originalEvent }) => {
                    const isConfirmed = !originalEvent?.status || originalEvent.status === 'confirmed';

                    return (
                      <div
                        key={`${timelineNumber}-${eventDetails.title}`}
                        className={timelineNumber === markerEntries[markerEntries.length - 1].timelineNumber ? '' : 'border-b border-gray-200 pb-3'}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Stop {timelineNumber}
                        </div>
                        <div className="font-semibold">{eventDetails.title}</div>
                        {eventDetails.details && (
                          <div className="text-sm text-gray-600">{eventDetails.details}</div>
                        )}
                        <div className="text-sm text-gray-600">{eventDetails.date}</div>
                        {eventDetails.additionalInfo && (
                          <div className="mt-1 text-sm text-gray-600">{eventDetails.additionalInfo}</div>
                        )}
                        <div className={`mt-1 text-sm font-medium ${
                          isConfirmed ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {isConfirmed ? 'Confirmed' : 'Exploring'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Map Legend */}
        <div className="leaflet-bottom leaflet-left">
          <div className="leaflet-control bg-white p-3 rounded-lg shadow-lg m-4">
            <h4 className="font-semibold mb-2">Legend</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-blue-600"></div>
                <span className="text-sm">Driving Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-emerald-600" style={{ borderTop: '2px dashed #059669' }}></div>
                <span className="text-sm">Train Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-violet-600"></div>
                <span className="text-sm">Flight Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</div>
                <span className="text-sm">Timeline stop number</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Confirmed Event</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm">Exploring Event</span>
              </div>
            </div>
          </div>
        </div>

        {unmappedEvents.length > 0 && (
          <div className="leaflet-top leaflet-right">
            <div className="leaflet-control m-4 max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-lg">
              <div className="font-semibold">
                {unmappedEvents.length} event{unmappedEvents.length === 1 ? '' : 's'} not shown on map
              </div>
              <div className="mt-2 space-y-1">
                {unmappedEvents.slice(0, 4).map((event) => (
                  <div key={`${event.eventId}-${event.reason}`}>
                    <span className="font-medium">{event.label}:</span> {event.reason}
                  </div>
                ))}
                {unmappedEvents.length > 4 && (
                  <div>And {unmappedEvents.length - 4} more.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
};

export default TripMap; 