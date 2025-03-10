import React, { useEffect, useRef, useState } from 'react';
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

const TripMap: React.FC<TripMapProps> = ({ trip }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);

  const fetchRoute = async (start: Location, end: Location): Promise<RouteInfo | null> => {
    try {
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

      return {
        coordinates: data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
        duration: data.routes[0].duration,
        distance: data.routes[0].distance
      };
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

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keywords)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch location for ${keywords}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          event: {
            id: 'trip-location',
            type: 'destination',
            date: new Date().toISOString(),
            placeName: trip.name,
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
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (trip.events.length === 0) {
          // If no events, try to get location from trip name
          const tripLocation = await fetchTripLocation(trip.name);
          if (tripLocation) {
            setLocations([tripLocation]);
            if (mapRef.current) {
              mapRef.current.setView([tripLocation.lat, tripLocation.lon], 10);
            }
          }
          setIsLoading(false);
          return;
        }
        
        const locationPromises = trip.events.map(async (event) => {
          let searchQuery = '';
          
          if (event.location) {
            searchQuery = event.location;
          } else {
            if (event.type === 'arrival' || event.type === 'departure') {
              searchQuery = event.airport;
            } else if (event.type === 'stay') {
              searchQuery = `${event.accommodationName} ${event.address || ''}`.trim();
            } else if (event.type === 'destination') {
              searchQuery = `${event.placeName} ${event.address || ''}`.trim();
            }
          }

          if (!searchQuery) return null;

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
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name,
                event
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

        // Fetch routes between consecutive locations
        const routePromises: Promise<RouteInfo | null>[] = [];
        for (let i = 0; i < validLocations.length - 1; i++) {
          routePromises.push(fetchRoute(validLocations[i], validLocations[i + 1]));
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
  }, [trip]);

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
          title: `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} - ${event.airport}`,
          details: `${event.airline} ${event.flightNumber}`,
          date: formatDate(event.date)
        };
      case 'stay':
        return {
          title: event.accommodationName,
          details: event.address || '',
          date: `${formatDate(event.checkIn)} - ${formatDate(event.checkOut)}`
        };
      case 'destination':
        return {
          title: event.placeName,
          details: event.address || '',
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
            color="#3B82F6"
            weight={3}
            opacity={0.7}
          >
            <Tooltip permanent direction="center" offset={[0, -10]} className="bg-white px-2 py-1 rounded shadow">
              {formatDuration(route.duration / 60)} • {formatDistance(route.distance)}
            </Tooltip>
          </Polyline>
        ))}

        {/* Render markers */}
        {locations.map((location: Location) => {
          const eventDetails = getEventDetails(location.event);
          return (
            <Marker key={location.event.id} position={[location.lat, location.lon]}>
              <Popup>
                <div className="font-semibold">{eventDetails.title}</div>
                {eventDetails.details && (
                  <div className="text-sm text-gray-600">{eventDetails.details}</div>
                )}
                <div className="text-sm text-gray-600">{eventDetails.date}</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Map Legend */}
        <div className="leaflet-bottom leaflet-left">
          <div className="leaflet-control bg-white p-3 rounded-lg shadow-lg m-4">
            <h4 className="font-semibold mb-2">Legend</h4>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-blue-500"></div>
              <span className="text-sm">Driving Route</span>
            </div>
          </div>
        </div>
      </MapContainer>
    </div>
  );
};

export default TripMap; 