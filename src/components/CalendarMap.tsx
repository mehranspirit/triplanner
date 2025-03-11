import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Trip } from '../types';

// Create custom marker icons
const createMarkerIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const greyMarker = createMarkerIcon('grey');
const greenMarker = createMarkerIcon('green');
const blueMarker = createMarkerIcon('blue');

interface CalendarMapProps {
  trips: Trip[];
}

interface Location {
  lat: number;
  lon: number;
  displayName: string;
  tripId: string;
  tripName: string;
  startDate: Date;
  endDate: Date;
}

const CalendarMap: React.FC<CalendarMapProps> = ({ trips }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);

  const getTripMarkerIcon = (startDate: Date, endDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (endDate < today) {
      return greyMarker; // Past trip
    } else if (startDate <= today && today <= endDate) {
      return greenMarker; // Ongoing trip
    } else {
      return blueMarker; // Upcoming trip
    }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const locationPromises = trips.map(async (trip) => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trip.name)}`
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch location for ${trip.name}`);
            }

            const data = await response.json();
            
            if (data && data.length > 0) {
              // Find the first event date and last event date
              const eventDates = trip.events.map(event => 
                event.type === 'stay' 
                  ? [new Date(event.checkIn), new Date(event.checkOut)]
                  : [new Date(event.date), new Date(event.date)]
              ).flat();

              const startDate = new Date(Math.min(...eventDates.map(d => d.getTime())));
              const endDate = new Date(Math.max(...eventDates.map(d => d.getTime())));

              return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name,
                tripId: trip._id,
                tripName: trip.name,
                startDate,
                endDate
              };
            }
            return null;
          } catch (err) {
            console.warn(`Error fetching location for ${trip.name}:`, err);
            return null;
          }
        });

        const results = await Promise.all(locationPromises);
        const validLocations = results.filter((loc): loc is Location => loc !== null);
        
        setLocations(validLocations);

        // If we have locations, fit the map bounds to show all markers
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

    if (trips.length > 0) {
      fetchLocations();
    }
  }, [trips]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || locations.length === 0) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{error || 'No trip locations found'}</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="h-96 rounded-lg overflow-hidden">
      <MapContainer
        center={[locations[0].lat, locations[0].lon]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {locations.map((location) => (
          <Marker 
            key={location.tripId} 
            position={[location.lat, location.lon]}
            icon={getTripMarkerIcon(location.startDate, location.endDate)}
          >
            <Popup>
              <div className="font-semibold">{location.tripName}</div>
              <div className="text-sm text-gray-600">
                {formatDate(location.startDate)} - {formatDate(location.endDate)}
              </div>
              <div className="text-xs text-gray-500 mt-1">{location.displayName}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default CalendarMap; 