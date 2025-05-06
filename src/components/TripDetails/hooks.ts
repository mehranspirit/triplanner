import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
// import { Trip, Event, EventType, User } from '@/types/eventTypes'; // Original import
import { Trip, Event, EventType, User } from '@/types/eventTypes'; // Ensure this points to the correct file
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/context/TripContext'; // Corrected import
import { getDefaultThumbnail, getEventThumbnail } from './thumbnailHelpers';
import { exportHtml } from './exportHelpers'; // Assuming PDF export logic might be similar
import { v4 as uuidv4 } from 'uuid';

// Placeholder for a default/unknown user - adjust as needed
const defaultUser: User = {
  _id: 'unknown',
  name: 'Unknown User',
  email: 'unknown@example.com',
  photoUrl: null,
};

// Main hook for Trip Details page logic
export const useTripDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tripContext = useTrip(); // Use the correct context hook name

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tripThumbnail, setTripThumbnail] = useState<string>('');
  const [eventThumbnails, setEventThumbnails] = useState<{ [key: string]: string }>({});

  // --- Data Fetching ---
  const fetchTrip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const tripData = await api.getTrip(id);
      setTrip(tripData);
      
      // Load trip thumbnail
      if (tripData.thumbnailUrl) {
        setTripThumbnail(tripData.thumbnailUrl);
      } else {
        const defaultThumb = await getDefaultThumbnail(tripData.name);
        setTripThumbnail(defaultThumb);
      }
      
      // Load event thumbnails (consider doing this lazily or optimizing)
      const thumbnails: { [key: string]: string } = {};
      await Promise.all(tripData.events.map(async (event) => {
        thumbnails[event.id] = await getEventThumbnail(event);
      }));
      setEventThumbnails(thumbnails);

    } catch (err) {
      console.error('Error fetching trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trip details');
      setTrip(null); // Clear trip data on error
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // --- Event CRUD Operations ---
  const handleTripUpdate = useCallback(async (updatedTripData: Partial<Trip>) => {
    if (!trip) return;
    // Use the context update function if available, otherwise use API directly
    // This assumes the context handles optimistic updates + error handling
    if (tripContext?.updateTrip) {
        try {
            await tripContext.updateTrip({ ...trip, ...updatedTripData });
            // Refetch might be needed if context doesn't update local state automatically
            // fetchTrip(); 
        } catch (err) {
             console.error('Error updating trip via context:', err);
             setError(err instanceof Error ? err.message : 'Failed to update trip');
             // Optionally refetch on context error
             fetchTrip();
        }
    } else {
        // Fallback to direct API call if context method not available
        try {
            const fullUpdatedTrip = { ...trip, ...updatedTripData } as Trip;
            setTrip(fullUpdatedTrip); // Optimistic UI update
            await api.updateTrip(fullUpdatedTrip);
        } catch (err) {
            console.error('Error updating trip via API:', err);
            setError(err instanceof Error ? err.message : 'Failed to update trip');
            fetchTrip(); // Rollback/refetch on API error
        }
    }
  }, [trip, fetchTrip, tripContext]);

  const addEvent = useCallback(async (newEventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>) => {
    if (!trip) return;
    console.log("hooks.ts addEvent: Event data received:", newEventData);
    const currentUser = user || defaultUser; // Ensure we have a user object
    const newEventWithMeta: Event = {
      ...newEventData,
      id: uuidv4(),
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser,
      likes: [],
      dislikes: [],
    };
    console.log("hooks.ts addEvent: Event with metadata:", newEventWithMeta);
    
    try {
      // First update local state for immediate UI update
    const updatedTrip = { ...trip, events: [...trip.events, newEventWithMeta] };
      console.log("hooks.ts addEvent: Local trip state updated with new event");
      setTrip(updatedTrip);
      
      // Then update in backend
    await handleTripUpdate(updatedTrip);
      console.log("hooks.ts addEvent: Backend update completed");
      
      // Update thumbnail
    const thumb = await getEventThumbnail(newEventWithMeta);
    setEventThumbnails(prev => ({ ...prev, [newEventWithMeta.id]: thumb }));
      console.log("hooks.ts addEvent: Thumbnail added for new event");
      
      return newEventWithMeta;
    } catch (error) {
      console.error("hooks.ts addEvent: Error during event addition:", error);
      // Revert optimistic update on error
      await fetchTrip();
      throw error;
    }
  }, [trip, user, handleTripUpdate]);

  const updateEvent = useCallback(async (eventToUpdate: Event) => {
    if (!trip) return;
    console.log("hooks.ts updateEvent: Updating event:", eventToUpdate);
    const currentUser = user || defaultUser; // Ensure we have a user object
    const eventWithMeta = {
      ...eventToUpdate,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser,
    };
    
    try {
      // Update the events array
      const updatedEvents = trip.events.map(e => e.id === eventToUpdate.id ? eventWithMeta : e);
      const updatedTrip = { ...trip, events: updatedEvents };
      
      // Update local state for optimistic UI
      console.log("hooks.ts updateEvent: Updating local state optimistically");
      setTrip(updatedTrip);
      
      // Update thumbnail
      const thumb = await getEventThumbnail(eventWithMeta);
      setEventThumbnails(prev => ({ ...prev, [eventWithMeta.id]: thumb }));
      console.log("hooks.ts updateEvent: Thumbnail updated");
      
      // Update the backend without triggering a refresh
      await handleTripUpdate(updatedTrip);
      console.log("hooks.ts updateEvent: Backend update completed");
      
      return eventWithMeta;
    } catch (error) {
      console.error('Error updating event:', error);
      // Only refresh from server on error
      await fetchTrip();
      throw error;
    }
  }, [trip, user, handleTripUpdate, fetchTrip]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!trip) return;
    // Use context if available
     if (tripContext?.deleteEvent) {
         try {
             await tripContext.deleteEvent(trip._id, eventId);
             // Refetch might be needed if context doesn't update local state automatically
             // fetchTrip();
         } catch (err) {
             console.error('Error deleting event via context:', err);
             setError(err instanceof Error ? err.message : 'Failed to delete event');
             fetchTrip();
         }
     } else {
        const updatedEvents = trip.events.filter(e => e.id !== eventId);
        await handleTripUpdate({ ...trip, events: updatedEvents });
        setEventThumbnails(prev => {
          const { [eventId]: _, ...rest } = prev;
          return rest;
        });
     }
  }, [trip, handleTripUpdate, tripContext, fetchTrip]);
  
  // --- Export --- 
  const handleExportHTML = useCallback(() => {
      if (!trip) return;
      exportHtml(trip, eventThumbnails);
  }, [trip, eventThumbnails]);
  
  // --- Permissions ---
  const isOwner = user?._id === trip?.owner._id;
  const collaborator = trip?.collaborators.find(c => 
      typeof c === 'object' && c !== null && 'user' in c && c.user._id === user?._id
  );
  // Ensure collaborator is the correct type before accessing role
  const role = (typeof collaborator === 'object' && collaborator !== null && 'role' in collaborator) ? collaborator.role : undefined;
  const canEdit = isOwner || role === 'editor';

  // --- Return values ---
  return {
    trip,
    loading,
    error,
    tripThumbnail,
    eventThumbnails,
    fetchTrip, // Expose refetch capability
    addEvent,
    updateEvent,
    deleteEvent,
    handleExportHTML,
    // handleExportPDF, // Add similarly if needed
    canEdit,
    isOwner,
    user,
  };
};

// TODO: Implement useAirportSearch, useAirlineSearch, useClickOutside, useEventForm
