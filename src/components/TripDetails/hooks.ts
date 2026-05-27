import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { networkAwareApi } from '@/services/networkAwareApi';
// import { Trip, Event, EventType, User } from '@/types/eventTypes'; // Original import
import { Trip, Event, EventType, User } from '@/types/eventTypes'; // Ensure this points to the correct file
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/context/TripContext'; // Corrected import
import { getDefaultThumbnail, getEventThumbnail } from './thumbnailHelpers';
import { exportHtml, ItineraryExportMode } from './exportHelpers';
import { v4 as uuidv4 } from 'uuid';
import { syncEventLocationOnSave } from '@/utils/eventLocation';
import { normalizeActivityDestinationSchedule } from '@/utils/eventTime';

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
      const tripData = await networkAwareApi.getTrip(id);
      if (!tripData) {
        setError('Trip not found');
        setTrip(null);
        return;
      }
      
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
        thumbnails[event.id] = event.thumbnailUrl || await getEventThumbnail(event);
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
    
    try {
      // Create the full updated trip data
      const fullUpdatedTrip = { ...trip, ...updatedTripData } as Trip;
      
      // Update local state immediately for optimistic UI
      setTrip(fullUpdatedTrip);
      
      // If we have a thumbnail URL change, update it immediately
      if (updatedTripData.thumbnailUrl !== undefined) {
        setTripThumbnail(updatedTripData.thumbnailUrl || await getDefaultThumbnail(fullUpdatedTrip.name));
      }
      
      // Update in the backend
      if (tripContext?.updateTrip) {
        await tripContext.updateTrip(fullUpdatedTrip);
      } else {
        await networkAwareApi.updateTrip(fullUpdatedTrip);
      }
    } catch (err) {
      console.error('Error updating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to update trip');
      // Rollback on error by fetching the latest data
      await fetchTrip();
      throw err;
    }
  }, [trip, tripContext, fetchTrip]);

  const addEvents = useCallback(async (
    newEventsData: Array<Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>>
  ) => {
    if (!trip || newEventsData.length === 0) return [];

    const currentUser = user || defaultUser;
    const timestamp = new Date().toISOString();
    const newEventsWithMeta = newEventsData.map((newEventData) => {
      const normalizedEventData = normalizeActivityDestinationSchedule(newEventData as Event);
      return syncEventLocationOnSave({
        ...normalizedEventData,
        id: uuidv4(),
        createdBy: currentUser,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: currentUser,
        likes: [],
        dislikes: [],
      });
    });

    try {
      const updatedTrip = { ...trip, events: [...trip.events, ...newEventsWithMeta] };
      setTrip(updatedTrip);
      await handleTripUpdate(updatedTrip);

      const thumbnailEntries: Record<string, string> = {};
      await Promise.all(newEventsWithMeta.map(async (event) => {
        thumbnailEntries[event.id] = event.thumbnailUrl || await getEventThumbnail(event);
      }));
      setEventThumbnails(prev => ({ ...prev, ...thumbnailEntries }));

      return newEventsWithMeta;
    } catch (error) {
      console.error('hooks.ts addEvents: Error during batch event addition:', error);
      await fetchTrip();
      throw error;
    }
  }, [trip, user, handleTripUpdate, fetchTrip]);

  const addEvent = useCallback(async (newEventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>) => {
    const results = await addEvents([newEventData]);
    return results[0];
  }, [addEvents]);

  const updateEvent = useCallback(async (eventToUpdate: Event) => {
    if (!trip) return;
    const currentUser = user || defaultUser;
    const previousEvent = trip.events.find(event => event.id === eventToUpdate.id);
    const normalizedEventData = normalizeActivityDestinationSchedule(eventToUpdate);
    const eventWithMeta = syncEventLocationOnSave({
      ...normalizedEventData,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser,
    }, previousEvent);

    try {
      const updatedEvents = trip.events.map(e => e.id === eventToUpdate.id ? eventWithMeta : e);
      const updatedTrip = { ...trip, events: updatedEvents };

      setTrip(updatedTrip);

      const thumb = eventWithMeta.thumbnailUrl || await getEventThumbnail(eventWithMeta);
      setEventThumbnails(prev => ({ ...prev, [eventWithMeta.id]: thumb }));

      await handleTripUpdate(updatedTrip);

      return { event: eventWithMeta, previousEvent };
    } catch (error) {
      console.error('Error updating event:', error);
      await fetchTrip();
      throw error;
    }
  }, [trip, user, handleTripUpdate, fetchTrip]);

  const replaceTripEvents = useCallback((events: Event[]) => {
    setTrip((current) => (current ? { ...current, events } : current));
  }, []);

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
  const handleExportHTML = useCallback((mode: ItineraryExportMode = 'detailed') => {
      if (!trip) return;
      exportHtml(trip, eventThumbnails, mode);
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
    fetchTrip,
    addEvent,
    addEvents,
    updateEvent,
    deleteEvent,
    replaceTripEvents,
    handleExportHTML,
    canEdit: !!user && (isOwner || canEdit),
    isOwner: !!user && isOwner,
    user,
    handleTripUpdate
  };
};

// TODO: Implement useAirportSearch, useAirlineSearch, useClickOutside, useEventForm
