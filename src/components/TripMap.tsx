import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Trip, Event, StayEvent } from '../types';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons for different event statuses
const blueIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const violetIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
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
    }))
  };
};

const TripMap: React.FC<TripMapProps> = React.memo(({ trip }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  
  // Extract only the data needed for the map to prevent unnecessary re-renders
  const mapRelevantData = useMemo(() => extractMapRelevantData(trip), [
    trip._id,
    trip.name,
    trip.events
  ]);

  const fetchRoute = async (start: Location, end: Location): Promise<RouteInfo | null> => {
    try {
      // Check cache first
      const cacheKey = getRouteCacheKey(start.lat, start.lon, end.lat, end.lon);
      if (routeCache[cacheKey]) {
        console.log(`Using cached route data for: ${start.displayName} to ${end.displayName}`);
        return routeCache[cacheKey];
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
        return null;
      }

      // Create route object with the correct structure
      const route: RouteInfo = {
        coordinates: data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]),
        duration: data.routes[0].duration,
        distance: data.routes[0].distance
      };
      
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
          
          if (event.location) {
            searchQuery = event.location.address || `${event.location.lat},${event.location.lng}`;
          } else {
            if (event.type === 'arrival' || event.type === 'departure') {
              searchQuery = (event as any).airport || '';
            } else if (event.type === 'stay') {
              searchQuery = `${(event as any).accommodationName || ''} ${(event as any).address || ''}`.trim();
            } else if (event.type === 'destination') {
              searchQuery = `${(event as any).placeName || ''} ${(event as any).address || ''}`.trim();
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
        const validLocations = results.filter((loc): loc is Location => loc !== null);
        setLocations(validLocations);

        // Filter to only include confirmed events for routes
        const confirmedLocations = validLocations.filter(
          loc => !loc.event.status || loc.event.status === 'confirmed'
        );
        console.log('Confirmed locations for routes:', confirmedLocations.length);
        
        // Fetch routes between consecutive confirmed locations only
        const routePromises: Promise<RouteInfo | null>[] = [];
        for (let i = 0; i < confirmedLocations.length - 1; i++) {
          routePromises.push(fetchRoute(confirmedLocations[i], confirmedLocations[i + 1]));
        }

        const routeResults = await Promise.all(routePromises);
        setRoutes(routeResults.filter((route): route is RouteInfo => route !== null));

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
          title: `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} - ${(event as any).airport}`,
          details: `${(event as any).airline} ${(event as any).flightNumber}`,
          date: formatDate(event.date)
        };
      case 'stay':
        return {
          title: (event as any).accommodationName,
          details: (event as any).address || '',
          date: `${formatDate((event as any).checkIn)} - ${formatDate((event as any).checkOut)}`
        };
      case 'destination':
        return {
          title: (event as any).placeName,
          details: (event as any).address || '',
          date: formatDate(event.date)
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
        center={[locations[0]?.lat || 0, locations[0]?.lon || 0]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Render routes */}
        {routes.map((route, index) => (
          <Polyline
            key={index}
            positions={route.coordinates}
            color="#2563EB"
            weight={3}
            opacity={0.7}
          >
            <Tooltip permanent direction="center" offset={[0, -10]} className="bg-white px-2 py-1 rounded shadow text-xs font-medium">
              {formatDuration(route.duration / 60)} • {formatDistance(route.distance)}
            </Tooltip>
          </Polyline>
        ))}

        {/* Render markers */}
        {locations.map((location: Location) => {
          const eventDetails = getEventDetails(location.event);
          return (
            <Marker key={location.event.id} position={[location.lat, location.lon]} icon={getMarkerIcon(location.event)}>
              <Popup>
                <div className="font-semibold">{eventDetails.title}</div>
                {eventDetails.details && (
                  <div className="text-sm text-gray-600">{eventDetails.details}</div>
                )}
                <div className="text-sm text-gray-600">{eventDetails.date}</div>
                {location.event.status && (
                  <div className={`text-sm mt-1 font-medium ${
                    location.event.status === 'confirmed' ? 'text-green-600' :
                    location.event.status === 'exploring' ? 'text-green-600' :
                    'text-purple-600'
                  }`}>
                    {location.event.status.charAt(0).toUpperCase() + location.event.status.slice(1)}
                  </div>
                )}
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
                <span className="text-sm">Driving Route (Confirmed Events)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm">Exploring</span>
              </div>
            </div>
          </div>
        </div>
      </MapContainer>
    </div>
  );
});

export default TripMap; 