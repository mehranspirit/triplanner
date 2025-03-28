import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Trip, Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent } from '../types';

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
}

// Create module-level caches that persist across component mounts/unmounts
const routeCache: Record<string, RouteInfo> = {};
const locationCache: Record<string, { lat: number, lon: number, displayName: string }> = {};

// Function to get a cache key for a route
const getRouteCacheKey = (startLat: number, startLon: number, endLat: number, endLon: number): string => {
  return `route_${startLat}_${startLon}_${endLat}_${endLon}`;
};

// Function to get a cache key for a location query
const getLocationCacheKey = (query: string): string => {
  return `loc_${query.toLowerCase().trim()}`;
};

// Load cached data from localStorage on module initialization
try {
  const savedRoutes = localStorage.getItem('tripMapRouteCache');
  if (savedRoutes) {
    const parsedRoutes = JSON.parse(savedRoutes);
    Object.assign(routeCache, parsedRoutes);
    console.log('Loaded route cache from localStorage:', Object.keys(parsedRoutes).length, 'routes');
  }
  
  const savedLocations = localStorage.getItem('tripMapLocationCache');
  if (savedLocations) {
    const parsedLocations = JSON.parse(savedLocations);
    Object.assign(locationCache, parsedLocations);
    console.log('Loaded location cache from localStorage:', Object.keys(parsedLocations).length, 'locations');
  }
} catch (err) {
  console.warn('Failed to load cache from localStorage:', err);
}

// Function to save route cache to localStorage
const saveRouteCache = () => {
  try {
    localStorage.setItem('tripMapRouteCache', JSON.stringify(routeCache));
  } catch (err) {
    console.warn('Failed to save route cache to localStorage:', err);
  }
};

// Function to save location cache to localStorage
const saveLocationCache = () => {
  try {
    localStorage.setItem('tripMapLocationCache', JSON.stringify(locationCache));
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
      date: event.date,
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
    }))
  };
};

const TripMap: React.FC<TripMapProps> = ({ trip }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  
  // Extract only the data needed for the map to prevent unnecessary re-renders
  const mapRelevantData = useMemo(() => extractMapRelevantData(trip), [
    trip._id,
    trip.name,
    trip.events.map(event => `${event.id}-${event.status}-${event.type}-${event.date}-${event.location?.lat}-${event.location?.lng}`).join(',')
  ]);

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
      // Check cache first
      const cacheKey = getRouteCacheKey(start.lat, start.lon, end.lat, end.lon);
      if (routeCache[cacheKey]) {
        console.log(`Using cached route data for: ${start.displayName} to ${end.displayName}`);
        return { ...routeCache[cacheKey], type };
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let response;
      let route: RouteInfo;

      if (type === 'driving') {
        response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch driving route');
        }

        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
          return null;
        }

        route = {
          coordinates: data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]),
          duration: data.routes[0].duration,
          distance: data.routes[0].distance,
          type: 'driving'
        };
      } else if (type === 'flight') {
        // Calculate a curved path for the flight
        const distance = calculateDistance(start.lat, start.lon, end.lat, end.lon);
        const coordinates = generateFlightPath(start.lat, start.lon, end.lat, end.lon);
        
        // Estimate flight duration based on distance (assuming average speed of 800km/h)
        const duration = Math.round(distance / 800 * 60); // Convert to minutes
        
        route = {
          coordinates,
          duration,
          distance,
          type: 'flight',
          departureTime: new Date().toISOString(), // Default to current time
          arrivalTime: new Date(Date.now() + duration * 60000).toISOString() // Add duration to current time
        };
      } else {
        // For train routes, use a dashed line between points
        const coordinates = [[start.lat, start.lon], [end.lat, end.lon]] as [number, number][];
        const distance = calculateDistance(start.lat, start.lon, end.lat, end.lon);
        
        // Estimate train duration based on distance (assuming average speed of 120km/h)
        const duration = Math.round(distance / 120 * 60); // Convert to minutes
        
        route = {
          coordinates,
          duration,
          distance,
          type: 'train',
          departureTime: new Date().toISOString(), // Default to current time
          arrivalTime: new Date(Date.now() + duration * 60000).toISOString() // Add duration to current time
        };
      }
      
      // Cache the result
      routeCache[cacheKey] = route;
      
      // Save updated cache to localStorage
      saveRouteCache();
      
      return route;
    } catch (err) {
      console.warn('Error fetching route:', err);
      return null;
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
      // Remove common words and get keywords from trip name
      const keywords = tripName
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(word => !['trip', 'to', 'in', 'at', 'the', 'a', 'an'].includes(word))
        .join(' ');
        
      // Check cache first
      const cacheKey = getLocationCacheKey(keywords);
      if (locationCache[cacheKey]) {
        console.log(`Using cached location data for trip: ${tripName}`);
        return {
          ...locationCache[cacheKey],
          event: {
            id: 'trip-location',
            type: 'destination',
            date: new Date().toISOString(),
            placeName: trip.name,
            status: 'exploring',
            createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Event
        };
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keywords)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch location for ${keywords}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const locationData = {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
        
        // Cache the result
        locationCache[cacheKey] = locationData;
        
        // Save updated cache to localStorage
        saveLocationCache();
        
        return {
          ...locationData,
          event: {
            id: 'trip-location',
            type: 'destination',
            date: new Date().toISOString(),
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
  };

  useEffect(() => {
    console.log('TripMap: Fetching locations for events');
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (mapRelevantData.events.length === 0) {
          // If no events, try to get location from trip name
          const tripLocation = await fetchTripLocation(mapRelevantData.name);
          if (tripLocation) {
            setLocations([tripLocation]);
            if (mapRef.current) {
              mapRef.current.setView([tripLocation.lat, tripLocation.lon], 10);
            }
          }
          setIsLoading(false);
          return;
        }
        
        const locationPromises = mapRelevantData.events.map(async (event) => {
          let searchQuery = '';
          let departureLocation = null;
          let arrivalLocation = null;
          
          // If event has direct coordinates, use them
          if (event.location?.lat && event.location?.lng) {
            return {
              lat: event.location.lat,
              lon: event.location.lng,
              displayName: event.location.address || 'Location',
              event: {
                ...event,
                createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as Event
            };
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
              arrivalLocation = await fetchTripLocation(flightEvent.arrivalAirport || '');
              if (departureLocation && arrivalLocation) {
                return [departureLocation, arrivalLocation];
              }
              return null;
            }
            case 'train': {
              const trainEvent = (event as unknown) as TrainEvent;
              departureLocation = await fetchTripLocation(trainEvent.departureStation || '');
              arrivalLocation = await fetchTripLocation(trainEvent.arrivalStation || '');
              if (departureLocation && arrivalLocation) {
                return [departureLocation, arrivalLocation];
              }
              return null;
            }
            case 'rental_car': {
              const carEvent = (event as unknown) as RentalCarEvent;
              departureLocation = await fetchTripLocation(carEvent.pickupLocation || '');
              arrivalLocation = await fetchTripLocation(carEvent.dropoffLocation || '');
              if (departureLocation && arrivalLocation) {
                return [departureLocation, arrivalLocation];
              }
              return null;
            }
          }

          if (!searchQuery) return null;
          
          // Check cache first
          const cacheKey = getLocationCacheKey(searchQuery);
          if (locationCache[cacheKey]) {
            console.log(`Using cached location data for: ${searchQuery}`);
            return {
              ...locationCache[cacheKey],
              event: {
                ...event,
                createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as Event
            };
          }

          try {
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch location for ${searchQuery}`);
            }

            const data = await response.json();
            
            if (data && data.length > 0) {
              const locationData = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name
              };
              
              // Cache the result
              locationCache[cacheKey] = locationData;
              
              // Save updated cache to localStorage
              saveLocationCache();
              
              return {
                ...locationData,
                event: {
                  ...event,
                  createdBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  updatedBy: { _id: '', email: '', name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Event
              };
            }
            return null;
          } catch (err) {
            console.warn(`Error fetching location for ${searchQuery}:`, err);
            return null;
          }
        });

        const results = await Promise.all(locationPromises);
        const validLocations = results.flat().filter((loc): loc is Location => loc !== null);
        setLocations(validLocations);

        // Filter to only include confirmed events for routes
        const confirmedLocations = validLocations.filter(
          loc => !loc.event.status || loc.event.status === 'confirmed'
        );
        console.log('Confirmed locations for routes:', confirmedLocations.length);
        
        // Fetch routes between consecutive confirmed locations
        const routePromises: Promise<RouteInfo | null>[] = [];
        for (let i = 0; i < confirmedLocations.length - 1; i++) {
          const currentEvent = confirmedLocations[i].event;
          const nextEvent = confirmedLocations[i + 1].event;
          
          // Determine route type based on event types
          let routeType: 'driving' | 'train' | 'flight' = 'driving';
          
          // Check if either event is a train or flight
          if (currentEvent.type === 'train' || nextEvent.type === 'train') {
            routeType = 'train';
          } else if (currentEvent.type === 'flight' || nextEvent.type === 'flight') {
            routeType = 'flight';
          }
          
          // Only fetch route if we have valid locations
          if (confirmedLocations[i] && confirmedLocations[i + 1]) {
            routePromises.push(fetchRoute(confirmedLocations[i], confirmedLocations[i + 1], routeType));
          }
        }

        const routeResults = await Promise.all(routePromises);
        const validRoutes = routeResults.filter((route): route is RouteInfo => route !== null);
        console.log('Valid routes:', validRoutes.map(r => r.type));
        setRoutes(validRoutes);

        // If we have locations, fit the map bounds to show all markers and routes
        if (validLocations.length > 0 && mapRef.current) {
          const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lon]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      } finally {
        setIsLoading(false);
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
          date: formatDate(event.date)
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
          date: formatDate(event.date)
        };
      case 'flight': {
        const flightEvent = event as FlightEvent;
        return {
          title: `${flightEvent.airline || 'Flight'} ${flightEvent.flightNumber || ''}`,
          details: `${flightEvent.departureAirport || ''} to ${flightEvent.arrivalAirport || ''}`,
          date: formatDate(event.date)
        };
      }
      case 'train': {
        const trainEvent = event as TrainEvent;
        return {
          title: `${trainEvent.trainOperator || 'Train'} ${trainEvent.trainNumber || ''}`,
          details: `${trainEvent.departureStation || ''} to ${trainEvent.arrivalStation || ''}`,
          date: formatDate(event.date)
        };
      }
      case 'rental_car': {
        const carEvent = event as RentalCarEvent;
        return {
          title: `${carEvent.carCompany || 'Rental Car'}`,
          details: `${carEvent.pickupLocation || ''} to ${carEvent.dropoffLocation || ''}`,
          date: formatDate(event.date)
        };
      }
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
        key={`map-${trip._id}-${trip.events.map(e => `${e.id}-${e.status}-${e.type}-${e.date}-${e.location?.lat}-${e.location?.lng}`).join('-')}`}
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
        />
        
        {/* Render routes */}
        {routes.map((route, index) => {
          console.log('Rendering route:', route.type, route.coordinates.length);
          return (
            <Polyline
              key={`${route.type}-${index}`}
              positions={route.coordinates}
              color={route.type === 'driving' ? '#2563EB' : route.type === 'train' ? '#059669' : '#7C3AED'}
              weight={route.type === 'driving' ? 3 : 4}
              opacity={0.7}
              dashArray={route.type === 'train' ? '10, 10' : undefined}
            >
              <Tooltip permanent direction="center" offset={[0, -10]} className="bg-white px-2 py-1 rounded shadow text-xs font-medium">
                {route.type === 'driving' ? (
                  `${formatDuration(route.duration / 60)} • ${formatDistance(route.distance)}`
                ) : route.type === 'train' ? (
                  route.departureTime && route.arrivalTime ? 
                    `Train: ${new Date(route.departureTime).toLocaleTimeString()} - ${new Date(route.arrivalTime).toLocaleTimeString()}` :
                    'Train Route'
                ) : (
                  route.departureTime && route.arrivalTime ?
                    `Flight: ${new Date(route.departureTime).toLocaleTimeString()} - ${new Date(route.arrivalTime).toLocaleTimeString()}` :
                    'Flight Route'
                )}
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Render markers */}
        {locations.map((location: Location, index: number) => {
          const eventDetails = getEventDetails(location.event);
          // Check if the event is confirmed by looking at the original event in the trip
          const originalEvent = trip.events.find(e => e.id === location.event.id);
          const isConfirmed = !originalEvent?.status || originalEvent.status === 'confirmed';
          // Create a unique key for each marker
          const markerKey = location.event.id === 'trip-location' 
            ? `trip-location-${index}` 
            : location.event.id;
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