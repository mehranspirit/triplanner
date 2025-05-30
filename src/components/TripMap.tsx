import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Trip, Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent, BusEvent, ActivityEvent } from '@/types/eventTypes';

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

// Custom marker icons for different event statuses
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

interface TripMapProps {
  trip: Trip;
}

interface Location {
  lat: number;
  lon: number;
  displayName: string;
  event: Event;
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
const locationCache: Record<string, { lat: number, lon: number, displayName: string, timestamp: number }> = {};

// Cache duration constants
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const ROUTE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Function to get a cache key for a route
const getRouteCacheKey = (startLat: number, startLon: number, endLat: number, endLon: number): string => {
  return `route_${startLat}_${startLon}_${endLat}_${endLon}`;
};

// Function to get a cache key for a location query
const getLocationCacheKey = (query: string): string => {
  return `loc_${query.toLowerCase().trim()}`;
};

// Function to check if cache entry is valid
const isCacheValid = (timestamp: number, duration: number): boolean => {
  return Date.now() - timestamp < duration;
};

// Load cached data from localStorage on module initialization
try {
  const savedRoutes = localStorage.getItem('tripMapRouteCache');
  if (savedRoutes) {
    const parsedRoutes = JSON.parse(savedRoutes);
    Object.assign(routeCache, parsedRoutes);
  }
  
  const savedLocations = localStorage.getItem('tripMapLocationCache');
  if (savedLocations) {
    const parsedLocations = JSON.parse(savedLocations);
    Object.assign(locationCache, parsedLocations);
  }
} catch (err) {
  console.warn('Failed to load cache from localStorage:', err);
}

// Function to save route cache to localStorage
const saveRouteCache = () => {
  try {
    // Clean up expired routes before saving
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

// Function to save location cache to localStorage
const saveLocationCache = () => {
  try {
    // Clean up expired locations before saving
    const now = Date.now();
    const validLocations = Object.entries(locationCache).reduce((acc, [key, value]) => {
      if (isCacheValid(value.timestamp, LOCATION_CACHE_DURATION)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, typeof locationCache[string]>);
    
    localStorage.setItem('tripMapLocationCache', JSON.stringify(validLocations));
  } catch (err) {
    console.warn('Failed to save location cache to localStorage:', err);
  }
};

// Extract only the event data needed for the map to prevent unnecessary re-renders
const extractMapRelevantData = (trip: Trip) => {
  return {
    id: trip._id,
    name: trip.name,
    events: trip.events.map(event => ({
      id: event.id,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      status: event.status,
      // Type-specific fields
      airport: 'airport' in event ? event.airport : undefined,
      accommodationName: 'accommodationName' in event ? event.accommodationName : undefined,
      address: 'address' in event ? event.address : undefined,
      placeName: 'placeName' in event ? event.placeName : undefined,
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

// Update rate limiting configuration
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
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
      console.log(`Retrying request to ${url}, ${retries} attempts remaining, delay: ${nextDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, nextDelay));
      return fetchWithRetry(url, retries - 1, nextDelay);
    }
    throw error;
  }
};

const TripMap: React.FC<TripMapProps> = ({ trip }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  const loadingRef = useRef<boolean>(true); // Add ref to track loading state
  
  // Extract only the data needed for the map to prevent unnecessary re-renders
  const mapRelevantData = useMemo(() => extractMapRelevantData(trip), [
    trip._id,
    trip.name,
    trip.events.map(event => `${event.id}-${event.status}-${event.type}-${event.startDate}-${event.endDate}-${event.location?.lat}-${event.location?.lng}`).join(',')
  ]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Set loading ref to false when component unmounts
      loadingRef.current = false;
    };
  }, []);

  // Add a useEffect to handle trip updates
  useEffect(() => {
    console.log('TripMap: Trip data updated', {
      tripId: trip._id,
      eventCount: trip.events.length,
      eventStatuses: trip.events.map(e => e.status)
    });
  }, [trip]);

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

  // Add a useEffect to handle location updates
  useEffect(() => {
    console.log('TripMap: Locations updated', {
      locationCount: locations.length,
      locations: locations.map(loc => ({
        id: loc.event.id,
        status: loc.event.status,
        type: loc.event.type
      }))
    });
  }, [locations]);

  // Add a useEffect to handle route updates
  useEffect(() => {
    console.log('TripMap: Routes updated', {
      routeCount: routes.length,
      routeTypes: routes.map(r => r.type)
    });
  }, [routes]);

  // Add a useEffect to force marker updates when trip changes
  useEffect(() => {
    if (mapRef.current) {
      // Force a re-render of the map
      mapRef.current.invalidateSize();
      // Force a re-render of markers
      setLocations(prevLocations => [...prevLocations]);
      // Force a re-render of routes
      setRoutes(prevRoutes => [...prevRoutes]);
    }
  }, [trip]);

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

  // Helper function to fetch train route coordinates
  const fetchTrainRouteCoordinates = async (lat1: number, lon1: number, lat2: number, lon2: number): Promise<[number, number][]> => {
    try {
      // Use OpenStreetMap's Overpass API to get railway lines
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];(way["railway"](around:1000,${lat1},${lon1},${lat2},${lon2}););out body;>;out skel qt;`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch train route coordinates');
      }

      const data = await response.json();
      
      if (!data.elements || data.elements.length === 0) {
        // Fallback to a straight line if no railway lines found
        return [[lat1, lon1], [lat2, lon2]];
      }

      // Process the railway lines to create a path
      const coordinates: [number, number][] = data.elements
        .filter((el: any) => el.type === 'way')
        .map((el: any) => el.nodes.map((node: any) => [node.lat, node.lon] as [number, number]))
        .flat();

      return coordinates;
    } catch (err) {
      console.warn('Error fetching train route coordinates:', err);
      // Fallback to a straight line
      return [[lat1, lon1], [lat2, lon2]];
    }
  };

  const fetchTripLocation = async (tripName: string): Promise<Location | null> => {
    try {
      const keywords = tripName
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(word => !['trip', 'to', 'in', 'at', 'the', 'a', 'an'].includes(word))
        .join(' ');
        
      const cacheKey = getLocationCacheKey(keywords);
      if (locationCache[cacheKey] && isCacheValid(locationCache[cacheKey].timestamp, LOCATION_CACHE_DURATION)) {
        return {
          ...locationCache[cacheKey],
          event: {
            id: 'trip-location',
            type: 'destination',
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            placeName: trip.name,
            status: 'exploring',
            createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Event
        };
      }

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      try {
      const response = await fetchWithRetry(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keywords)}`
      );

      const data = await response.json();
      
      if (data && data.length > 0) {
        const locationData = {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
            displayName: data[0].display_name,
            timestamp: Date.now()
        };
        
        locationCache[cacheKey] = locationData;
        saveLocationCache();
        
        return {
          ...locationData,
          event: {
            id: 'trip-location',
            type: 'destination',
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            placeName: trip.name,
            status: 'exploring',
            createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Event
        };
      }
      return null;
    } catch (err) {
      console.warn(`Error fetching location for trip name:`, err);
        return null;
      }
    } catch (err) {
      console.warn(`Error in fetchTripLocation:`, err);
      return null;
    }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        loadingRef.current = true; // Reset loading ref when starting new fetch
        
        // Process locations sequentially to avoid rate limiting
        const processLocations = async () => {
          const results: (Location | Location[] | null)[] = [];
          
          for (const event of mapRelevantData.events) {
            // Check if loading should continue
            if (!loadingRef.current) {
              console.log('Loading stopped - map module closed');
              return results;
            }

            try {
          let searchQuery = '';
          let departureLocation = null;
          let arrivalLocation = null;
          
          // If event has direct coordinates, use them
          if (event.location?.lat && event.location?.lng) {
            let displayName = 'Location';
            
            switch (event.type) {
              case 'stay':
                displayName = ((event as unknown) as StayEvent).accommodationName || 'Stay';
                break;
              case 'destination':
                displayName = ((event as unknown) as DestinationEvent).placeName || 'Destination';
                break;
              default:
                displayName = event.location.address || 'Location';
            }
            
                results.push({
              lat: event.location.lat,
              lon: event.location.lng,
              displayName,
              event: {
                ...event,
                createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as Event
                });
                continue;
          }

          // Build search query based on event type
          switch (event.type) {
            case 'arrival':
            case 'departure':
              searchQuery = ((event as unknown) as ArrivalDepartureEvent).airport || '';
              break;
            case 'stay':
              searchQuery = `${((event as unknown) as StayEvent).accommodationName || ''} ${((event as unknown) as StayEvent).address || ''}`.trim();
              break;
            case 'destination':
              searchQuery = `${((event as unknown) as DestinationEvent).placeName || ''} ${((event as unknown) as DestinationEvent).address || ''}`.trim();
              break;
            case 'flight': {
              const flightEvent = (event as unknown) as FlightEvent;
              departureLocation = await fetchTripLocation(flightEvent.departureAirport || '');
                  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              arrivalLocation = await fetchTripLocation(flightEvent.arrivalAirport || '');
              if (departureLocation && arrivalLocation) {
                    results.push([departureLocation, arrivalLocation]);
              }
                  continue;
            }
            case 'train': {
              const trainEvent = (event as unknown) as TrainEvent;
              departureLocation = await fetchTripLocation(trainEvent.departureStation || '');
                  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              arrivalLocation = await fetchTripLocation(trainEvent.arrivalStation || '');
              if (departureLocation && arrivalLocation) {
                departureLocation.event = {
                  ...event,
                  ...trainEvent,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event;
                arrivalLocation.event = {
                  ...event,
                  ...trainEvent,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event;
                    results.push([departureLocation, arrivalLocation]);
              }
                  continue;
            }
            case 'rental_car': {
              const carEvent = (event as unknown) as RentalCarEvent;
              departureLocation = await fetchTripLocation(carEvent.pickupLocation || '');
                  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              arrivalLocation = await fetchTripLocation(carEvent.dropoffLocation || '');
              if (departureLocation && arrivalLocation) {
                    results.push([departureLocation, arrivalLocation]);
              }
                  continue;
            }
            case 'bus': {
              const busEvent = (event as unknown) as BusEvent;
              departureLocation = await fetchTripLocation(busEvent.departureStation || '');
                  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              arrivalLocation = await fetchTripLocation(busEvent.arrivalStation || '');
              if (departureLocation && arrivalLocation) {
                departureLocation.event = {
                  ...event,
                  ...busEvent,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event;
                arrivalLocation.event = {
                  ...event,
                  ...busEvent,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event;
                    results.push([departureLocation, arrivalLocation]);
              }
                  continue;
            }
          }

              if (!searchQuery) continue;
          
          // Check cache first
          const cacheKey = getLocationCacheKey(searchQuery);
              if (locationCache[cacheKey] && isCacheValid(locationCache[cacheKey].timestamp, LOCATION_CACHE_DURATION)) {
                results.push({
              ...locationCache[cacheKey],
              event: {
                ...event,
                createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as Event
                });
                continue;
          }

          try {
                // Check if loading should continue before making API call
                if (!loadingRef.current) {
                  console.log('Loading stopped before API call - map module closed');
                  return results;
                }

                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
            
                const response = await fetchWithRetry(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
            );
            
                // Check if loading should continue after API call
                if (!loadingRef.current) {
                  console.log('Loading stopped after API call - map module closed');
                  return results;
            }

            const data = await response.json();
            
            if (data && data.length > 0) {
              const locationData = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                    displayName: data[0].display_name,
                    timestamp: Date.now()
              };
              
              locationCache[cacheKey] = locationData;
              saveLocationCache();
              
                  results.push({
                ...locationData,
                event: {
                  ...event,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event
                  });
            }
          } catch (err) {
            console.warn(`Error fetching location for ${searchQuery}:`, err);
              }
            } catch (err) {
              console.warn(`Error processing event:`, err);
            }
          }
          
          return results;
        };

        const results = await processLocations();
        
        // Only update state if loading wasn't stopped
        if (loadingRef.current) {
        const validLocations = results.flat().filter((loc): loc is Location => loc !== null);
        setLocations(validLocations);

        // Filter to only include confirmed events for routes
        const confirmedLocations = validLocations.filter(
          loc => !loc.event.status || loc.event.status === 'confirmed'
        );
        
        // Fetch routes between consecutive confirmed locations
        const routePromises: Promise<RouteInfo | null>[] = [];
        for (let i = 0; i < confirmedLocations.length - 1; i++) {
            // Check if loading should continue
            if (!loadingRef.current) {
              console.log('Loading stopped during route fetching - map module closed');
              break;
            }

          const currentEvent = confirmedLocations[i].event;
          const nextEvent = confirmedLocations[i + 1].event;
          
          let routeType: 'driving' | 'train' | 'flight' = 'driving';
          
          if (currentEvent.type === 'train' || nextEvent.type === 'train') {
            routeType = 'train';
          } else if (currentEvent.type === 'flight' || nextEvent.type === 'flight') {
            routeType = 'flight';
          }
          
          if (confirmedLocations[i] && confirmedLocations[i + 1]) {
            routePromises.push(fetchRoute(confirmedLocations[i], confirmedLocations[i + 1], routeType));
          }
        }

        const routeResults = await Promise.all(routePromises);
        const validRoutes = routeResults.filter((route): route is RouteInfo => route !== null);
        setRoutes(validRoutes);

        // If we have locations, fit the map bounds to show all markers and routes
        if (validLocations.length > 0 && mapRef.current) {
          const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lon]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      } catch (err) {
        if (loadingRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch locations');
        }
      } finally {
        if (loadingRef.current) {
        setIsLoading(false);
        }
      }
    };

    fetchLocations();
  }, [mapRelevantData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || locations.length === 0) {
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
        center={[locations[0]?.lat || 0, locations[0]?.lon || 0]}
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
        {locations.map((location: Location, index: number) => {
          const eventDetails = getEventDetails(location.event);
          const originalEvent = trip.events.find(e => e.id === location.event.id);
          const isConfirmed = !originalEvent?.status || originalEvent.status === 'confirmed';
          const markerKey = location.event.id === 'trip-location' 
            ? `trip-location-${index}-${Date.now()}` 
            : `marker-${location.event.id}-${Date.now()}`;
          return (
            <Marker 
              key={markerKey}
              position={[location.lat, location.lon]} 
              icon={isConfirmed ? blueIcon : greenIcon}
            >
              <Popup>
                <div className="font-semibold">{eventDetails.title}</div>
                {eventDetails.details && (
                  <div className="text-sm text-gray-600">{eventDetails.details}</div>
                )}
                <div className="text-sm text-gray-600">{eventDetails.date}</div>
                {eventDetails.additionalInfo && (
                  <div className="text-sm text-gray-600 mt-1">{eventDetails.additionalInfo}</div>
                )}
                <div className={`text-sm mt-1 font-medium ${
                  isConfirmed ? 'text-blue-600' : 'text-green-600'
                }`}>
                  {isConfirmed ? 'Confirmed' : 'Exploring'}
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
      </MapContainer>
    </div>
  );
};

export default TripMap; 