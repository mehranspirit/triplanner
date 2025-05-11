import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Trip, StayEvent, User } from '../types/eventTypes';
import { Trip as EventTypesTrip } from '@/types/eventTypes';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Avatar from '../components/Avatar';

// Create conversion functions to bridge the type differences
const convertToIndexTrip = (trip: EventTypesTrip): Trip => {
  // Create a trip that matches the IndexTrip type
  return {
    ...trip,
    // Ensure events is compatible with IndexTrip.events
    events: trip.events.map(event => ({
      ...event,
      // Add the date field required by IndexTrip.Event
      date: event.startDate?.split('T')[0] || ''
    }))
  } as unknown as Trip;
};

const convertToEventTypesTrip = (trip: Trip): EventTypesTrip => {
  // Create a trip that matches the EventTypesTrip type
  return trip as unknown as EventTypesTrip;
};

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' }): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
};

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

const PREDEFINED_THUMBNAILS = {
  beach: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  mountain: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=800',
  city: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  paris: 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=800',
  italy: 'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
  japan: 'https://images.pexels.com/photos/590478/pexels-photo-590478.jpeg?auto=compress&cs=tinysrgb&w=800',
  camping: 'https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg?auto=compress&cs=tinysrgb&w=800',
  ski: 'https://images.pexels.com/photos/848599/pexels-photo-848599.jpeg?auto=compress&cs=tinysrgb&w=800',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=800'
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

interface TripDuration {
  startDate: Date;
  endDate: Date;
  duration: number;
}

interface CategorizedTrips {
  ongoing: Trip[];
  upcoming: Trip[];
  past: Trip[];
}

const categorizeTripsByDate = (trips: Trip[], durations: { [key: string]: TripDuration }): CategorizedTrips => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return trips.reduce((acc: CategorizedTrips, trip: Trip) => {
    const duration = durations[trip._id];
    if (!duration) return acc;

    const { startDate, endDate } = duration;
    
    if (startDate <= today && today <= endDate) {
      acc.ongoing.push(trip);
    } else if (startDate > today) {
      acc.upcoming.push(trip);
    } else {
      acc.past.push(trip);
    }
    
    return acc;
  }, { ongoing: [], upcoming: [], past: [] });
};

// Add a new component for the countdown badge
const CountdownBadge: React.FC<{ startDate: Date }> = ({ startDate }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = startDate.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [startDate]);

  return (
    <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-md text-xs">
      {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
    </div>
  );
};

export default function TripList() {
  const navigate = useNavigate();
  const { state, addTrip, deleteTrip, updateTrip } = useTrip();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', thumbnailUrl: '', description: '' });
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', thumbnailUrl: '', description: '' });
  const [tripThumbnails, setTripThumbnails] = useState<{ [key: string]: string }>({});
  const [tripDurations, setTripDurations] = useState<{ [key: string]: TripDuration }>({});
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load thumbnails for trips
  useEffect(() => {
    const loadThumbnails = async () => {
      const thumbnails: { [key: string]: string } = {};
      // Convert state.trips (EventTypesTrip[]) to IndexTrip[]
      const indexTrips = state.trips.map(convertToIndexTrip);
      
      for (const trip of indexTrips) {
        // Only fetch default thumbnail if there's no custom thumbnail
        if (!trip.thumbnailUrl) {
          thumbnails[trip._id] = await getDefaultThumbnail(trip.name);
        } else {
          // If there's a custom thumbnail, use it directly
          thumbnails[trip._id] = trip.thumbnailUrl;
        }
      }
      setTripThumbnails(thumbnails);
    };
    loadThumbnails();
  }, [state.trips]);

  // Calculate trip durations
  useEffect(() => {
    const calculateTripDurations = () => {
      const durations: { [key: string]: TripDuration } = {};
      
      // Convert state.trips (EventTypesTrip[]) to IndexTrip[]
      const indexTrips = state.trips.map(convertToIndexTrip);
      
      indexTrips.forEach(trip => {
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        // Sort events by date
        const sortedEvents = [...trip.events].sort((a, b) => {
          // Parse dates without timezone conversion
          const parseDate = (dateStr: string | undefined) => {
            if (!dateStr) return new Date(); // Return current date as fallback
            
            try {
              // Handle both ISO and simple YYYY-MM-DD formats
              const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
              const [year, month, day] = datePart.split('-').map(Number);
            return new Date(year, month - 1, day);
            } catch (error) {
              console.error("Error parsing date:", dateStr, error);
              return new Date(); // Fallback to current date
            }
          };
          
          // Safely extract dates based on event type
          const getEventDate = (event: any): string | undefined => {
            if (event.type === 'stay' && 'checkIn' in event) {
              return event.checkIn;
            } else if ('date' in event) {
              return event.date;
            } else if ('startDate' in event) {
              return event.startDate;
            }
            return undefined;
          };
          
          const dateA = parseDate(getEventDate(a));
          const dateB = parseDate(getEventDate(b));
          return dateA.getTime() - dateB.getTime();
        });

        sortedEvents.forEach(event => {
          // Parse dates without timezone conversion
          const parseDate = (dateStr: string | undefined) => {
            if (!dateStr) return new Date(); // Return current date as fallback
            
            try {
              // Handle both ISO and simple YYYY-MM-DD formats
              const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
              const [year, month, day] = datePart.split('-').map(Number);
            return new Date(year, month - 1, day);
            } catch (error) {
              console.error("Error parsing date:", dateStr, error);
              return new Date(); // Fallback to current date
            }
          };
          
          // Safely extract date based on event type
          let eventDate: Date;
          if (event.type === 'stay' && 'checkIn' in event) {
            eventDate = parseDate((event as any).checkIn);
          } else if ('date' in event) {
            eventDate = parseDate((event as any).date);
          } else if ('startDate' in event) {
            eventDate = parseDate((event as any).startDate);
          } else {
            eventDate = new Date(); // Fallback
          }

          if (!startDate || eventDate < startDate) {
            startDate = eventDate;
          }

          // For stay events, use checkout date as potential end date
          if (event.type === 'stay' && 'checkOut' in event) {
            const checkoutDate = parseDate((event as any).checkOut);
            if (!endDate || checkoutDate > endDate) {
              endDate = checkoutDate;
            }
          } else if ('endDate' in event) {
            const eventEndDate = parseDate((event as any).endDate);
            if (!endDate || eventEndDate > endDate) {
              endDate = eventEndDate;
            }
          } else {
            if (!endDate || eventDate > endDate) {
              endDate = eventDate;
            }
          }
        });

        // If no events, use trip dates if available, otherwise current date
        if (!startDate && trip.startDate) {
          try {
            // Handle both ISO and simple YYYY-MM-DD formats
            const datePart = trip.startDate.includes('T') ? trip.startDate.split('T')[0] : trip.startDate;
            const [year, month, day] = datePart.split('-').map(Number);
          startDate = new Date(year, month - 1, day);
          } catch (error) {
            console.error("Error parsing trip start date:", trip.startDate, error);
            startDate = new Date(); // Fallback to current date
          }
        }
        if (!endDate && trip.endDate) {
          try {
            // Handle both ISO and simple YYYY-MM-DD formats
            const datePart = trip.endDate.includes('T') ? trip.endDate.split('T')[0] : trip.endDate;
            const [year, month, day] = datePart.split('-').map(Number);
          endDate = new Date(year, month - 1, day);
          } catch (error) {
            console.error("Error parsing trip end date:", trip.endDate, error);
            endDate = new Date(); // Fallback to current date
          }
        }
        if (!startDate) startDate = new Date();
        if (!endDate) endDate = startDate;

        const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        durations[trip._id] = {
          startDate,
          endDate,
          duration
        };
      });

      setTripDurations(durations);
    };

    calculateTripDurations();
  }, [state.trips]);

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}${end.getFullYear() !== start.getFullYear() ? `, ${end.getFullYear()}` : ''}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('User must be logged in to create a trip');
      return;
    }

    try {
      console.log('Creating new trip with data:', newTrip);
      
      // Create a partial trip object without required server-generated fields
      const newTripData = {
        name: newTrip.name,
        thumbnailUrl: newTrip.thumbnailUrl || undefined,
        description: newTrip.description || undefined,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        events: [],
        owner: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        },
        collaborators: [],
        isPublic: false,
        status: 'planning' as const,
        tags: []
      };

      // Use the API to create the trip
      const createdTrip = await api.createTrip(newTripData);
      
      // Add the server-created trip to the state
      await addTrip(createdTrip);
      
      setError(null);
      setIsModalOpen(false);
      setNewTrip({ name: '', thumbnailUrl: '', description: '' });
    } catch (err) {
      console.error('Error creating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    }
  };

  const handleEditSubmit = async (tripId: string) => {
    if (!tripId) {
      setError('Trip ID is missing');
        return;
      }

    try {
      const updatedData = {
        name: editFormData.name,
        thumbnailUrl: editFormData.thumbnailUrl || undefined,
        description: editFormData.description || undefined
      };

      // Find the original trip data
      const existingTrip = state.trips.find(t => t._id === tripId);
      if (!existingTrip) throw new Error('Trip not found');

      // Merge existing trip with updated fields
      const mergedTrip = {
        ...existingTrip,
        ...updatedData
      };

      // Update the trip
      await updateTrip(mergedTrip);
      setError(null);
      setEditingTripId(null);
    } catch (err) {
      console.error('Error updating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    }
  };

  const startEditing = (trip: Trip) => {
    setEditFormData({
      name: trip.name,
      thumbnailUrl: trip.thumbnailUrl || '',
      description: trip.description || ''
    });
    setEditingTripId(trip._id);
  };

  const handleDeleteTrip = async (tripId: string | undefined) => {
    if (!tripId) {
      setError('Trip ID is missing');
      return;
    }

    try {
      await deleteTrip(tripId);
      setError(null);
      setShowDeleteModal(false);
      setTripToDelete(null);
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    }
  };

  const openDeleteModal = (trip: Trip) => {
    setTripToDelete(trip);
    setShowDeleteModal(true);
  };

  const renderTripCard = (trip: Trip) => (
    <div
      key={trip._id}
      className="bg-white overflow-hidden shadow rounded-lg relative group"
    >
      {editingTripId === trip._id ? (
        <div className="p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleEditSubmit(trip._id); }}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
              <input
                type="url"
                value={editFormData.thumbnailUrl}
                onChange={(e) => setEditFormData({ ...editFormData, thumbnailUrl: e.target.value })}
                className="input"
                placeholder="Enter image URL"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="input"
                placeholder="Enter description"
                rows={2}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingTripId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Clickable card that navigates to trip details */}
          <div 
            onClick={() => navigate(`/trips/${trip._id}`)}
            className="cursor-pointer"
          >
            <div className="h-48 w-full relative">
              <img
                src={trip.thumbnailUrl || tripThumbnails[trip._id] || PREDEFINED_THUMBNAILS.default}
                alt={trip.name}
                className="h-full w-full object-cover"
              />
              {tripDurations[trip._id] && tripDurations[trip._id].startDate > new Date() && (
                <CountdownBadge startDate={tripDurations[trip._id].startDate} />
              )}
              {user && trip.owner._id !== user._id && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="relative group">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-indigo-700 shadow-sm backdrop-blur-sm">
                      Shared
                    </span>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {(() => {
                        const collaborator = trip.collaborators.find(c => isCollaboratorObject(c) && c.user._id === user?._id);
                        return collaborator && isCollaboratorObject(collaborator) && collaborator.role === 'editor' ? 'You can edit' : 'View only';
                      })()}
                    </div>
                  </div>
                </div>
              )}
              {/* Owner and Collaborator Avatars */}
              <div className="absolute bottom-2 right-2 flex -space-x-2 z-10">
                {/* Owner Avatar */}
                {trip.owner._id !== user?._id && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <Avatar
                      photoUrl={trip.owner.photoUrl || null}
                      name={trip.owner.name}
                      size="sm"
                      className="ring-2 ring-white hover:ring-indigo-200 transition-all peer"
                    />
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 peer-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {trip.owner.name} • Owner
                    </div>
                  </div>
                )}
                {/* Collaborator Avatars */}
                {trip.collaborators
                  .filter(isCollaboratorObject)
                  .filter(collaborator => collaborator.user._id !== user?._id)
                  .slice(0, 3)
                  .map((collaborator) => (
                  <div key={collaborator.user._id} className="relative" onClick={(e) => e.stopPropagation()}>
                    <Avatar
                      photoUrl={collaborator.user.photoUrl || null}
                      name={collaborator.user.name}
                      size="sm"
                      className="ring-2 ring-white hover:ring-indigo-200 transition-all peer"
                    />
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 peer-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {collaborator.user.name} • {collaborator.role}
                    </div>
                  </div>
                ))}
                {trip.collaborators.filter(isCollaboratorObject).filter(c => c.user._id !== user?._id).length > 3 && (
                  <div className="relative flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full ring-2 ring-white">
                    <span className="text-xs text-gray-600">+{trip.collaborators.filter(isCollaboratorObject).filter(c => c.user._id !== user?._id).length - 3}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-5 sm:p-6 h-[120px]">
              <h3 className="text-2xl font-semibold text-gray-900">{trip.name}</h3>
              {tripDurations[trip._id] && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatDateRange(tripDurations[trip._id].startDate, tripDurations[trip._id].endDate)}
                  <span className="ml-2 text-gray-500">
                    • {tripDurations[trip._id].duration} {tripDurations[trip._id].duration === 1 ? 'day' : 'days'}
                  </span>
                </p>
              )}
              {trip.description && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-1 max-w-[calc(100%-3rem)]">
                  {trip.description.split(' ').map((word, index) => {
                    // Check if the word is a URL
                    if (word.match(/^https?:\/\/\S+$/)) {
                      return (
                        <a
                          key={index}
                          href={word}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
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
          </div>
          
          {/* Action buttons for owner - positioned in bottom right corner */}
          {(user && trip.owner._id === user._id) && (
            <div className="absolute bottom-3 right-4 z-20 flex space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(trip);
                }}
                className="p-1.5 rounded-full bg-gray-100 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm"
                title="Edit trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(trip);
                }}
                className="p-1.5 rounded-full bg-gray-100 text-red-600 hover:bg-red-100 transition-colors shadow-sm"
                title="Delete trip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderTripSection = (title: string, trips: Trip[]) => (
    trips.length > 0 && (
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map(renderTripCard)}
        </div>
      </div>
    )
  );

  if (state.loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error</h2>
        <p className="text-gray-600 mt-2">{state.error}</p>
      </div>
    );
  }

  const categorizedTrips = categorizeTripsByDate(
    // Convert state.trips (EventTypesTrip[]) to IndexTrip[]
    state.trips.map(convertToIndexTrip),
    tripDurations
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Trips</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          Add New Trip
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {renderTripSection('Ongoing Trips', categorizedTrips.ongoing)}
      {renderTripSection('Upcoming Trips', categorizedTrips.upcoming)}
      {renderTripSection('Past Trips', categorizedTrips.past)}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && tripToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Delete Trip</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete "{tripToDelete.name}"? This action cannot be undone and will remove all events and collaborator access.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTripToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTrip(tripToDelete._id)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add New Trip</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Trip Name</label>
                <input
                  type="text"
                  value={newTrip.name}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
                <input
                  type="url"
                  value={newTrip.thumbnailUrl}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, thumbnailUrl: e.target.value })
                  }
                  className="input"
                  placeholder="Enter image URL or leave empty"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={newTrip.description}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, description: e.target.value })
                  }
                  className="input"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 