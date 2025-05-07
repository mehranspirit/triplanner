import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Trip, Event, StayEvent } from '../types/eventTypes';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

// Create custom marker icons
const defaultIcon = L.icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface CalendarMapProps {
  trip: Trip;
}

interface Location {
  lat: number;
  lng: number;
  name: string;
  event: Event;
  tripId: string;
  tripName: string;
  displayName: string;
  startDate: Date;
  endDate: Date;
}

const calendarLocationCache: { [key: string]: any } = {};

const getCalendarLocationCacheKey = (locationName: string) => `calendar_location_${locationName}`;

const CalendarMap: React.FC<CalendarMapProps> = ({ trip }) => {
  const mapRef = React.useRef<LeafletMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLocations, setMapLocations] = useState<Location[]>([]);

  const getEventDate = (event: Event) => {
    if (event.type === 'stay') {
      return (event as StayEvent).checkIn;
    }
    return event.startDate;
  };

  const getEventLocation = (event: Event) => {
    if (event.location) {
      return {
        lat: event.location.lat,
        lng: event.location.lng,
        name: event.location.address || 'Unknown location'
      };
    }
    return null;
  };

  const eventLocations = trip.events
    .map(event => {
      const location = getEventLocation(event);
      if (!location) return null;
      return {
        ...location,
        event
      };
    })
    .filter((loc): loc is Location => loc !== null)
    .sort((a, b) => {
      const dateA = getEventDate(a.event);
      const dateB = getEventDate(b.event);
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      setError(null);
      
      const locationPromises = eventLocations.map(async (loc) => {
        try {
          // Check cache first
          const cacheKey = getCalendarLocationCacheKey(loc.name);
          if (calendarLocationCache[cacheKey]) {
            console.log(`Using cached location data for location: ${loc.name}`);
            
            return {
              ...calendarLocationCache[cacheKey],
              tripId: trip._id,
              tripName: trip.name,
              startDate: new Date(loc.event.startDate),
              endDate: new Date(loc.event.endDate)
            };
          }

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc.name)}`
          );
          
          if (!response.ok) {
            throw new Error(`Failed to fetch location for ${loc.name}`);
          }

          const data = await response.json();
          
          if (data && data.length > 0) {
            const locationData = {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
              displayName: data[0].display_name,
              tripId: trip._id,
              tripName: trip.name,
              startDate: new Date(loc.event.startDate),
              endDate: new Date(loc.event.endDate)
            };

            // Cache the result
            calendarLocationCache[cacheKey] = locationData;
            
            return locationData;
          }
          return null;
        } catch (err) {
          console.warn(`Error fetching location for ${loc.name}:`, err);
          return null;
        }
      });

      try {
        const results = await Promise.all(locationPromises);
        const validLocations = results.filter((loc): loc is Location => loc !== null);
        setMapLocations(validLocations);
      } catch (err) {
        console.error('Error processing locations:', err);
        setError('Failed to process locations');
      } finally {
        setIsLoading(false);
      }
    };

    if (eventLocations.length > 0) {
      fetchLocations();
    }
  }, [eventLocations, trip._id]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading map...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (mapLocations.length === 0) {
    return <div className="text-gray-500">No locations to display</div>;
  }

  return (
    <MapContainer
      center={[mapLocations[0].lat, mapLocations[0].lng]}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {mapLocations.map((location, index) => (
        <Marker
          key={`${location.tripId}-${index}`}
          position={[location.lat, location.lng]}
        >
          <Popup>
            <div>
              <h3 className="font-semibold">{location.tripName}</h3>
              <p>{location.displayName}</p>
              <p className="text-sm text-gray-500">
                {new Date(location.startDate).toLocaleDateString()} - {new Date(location.endDate).toLocaleDateString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default CalendarMap; 