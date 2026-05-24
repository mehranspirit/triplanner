import * as React from 'react';
import { Trip, Event } from '@/types/eventTypes';
import { api } from '../services/api';
import { networkAwareApi } from '../services/networkAwareApi';
import { useAuth } from './AuthContext';

interface TripState {
  trips: Trip[];
  loading: boolean;
  error: string | null;
}

type TripAction =
  | { type: 'SET_TRIPS'; payload: Trip[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_TRIP'; payload: Trip }
  | { type: 'UPDATE_TRIP'; payload: Trip }
  | { type: 'DELETE_TRIP'; payload: string }
  | { type: 'ADD_EVENT'; payload: { tripId: string; event: Event } }
  | { type: 'UPDATE_EVENT'; payload: { tripId: string; event: Event } }
  | { type: 'DELETE_EVENT'; payload: { tripId: string; eventId: string } };

export interface TripContextType {
  state: TripState;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  leaveTrip: (tripId: string) => Promise<void>;
  addEvent: (tripId: string, event: Event) => Promise<void>;
  updateEvent: (tripId: string, event: Event) => Promise<void>;
  deleteEvent: (tripId: string, eventId: string) => Promise<void>;
}

const TripContext = React.createContext<TripContextType | undefined>(undefined);

function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'SET_TRIPS':
      return {
        ...state,
        trips: action.payload.filter((trip, index, self) => 
          index === self.findIndex((t) => t._id === trip._id)
        ),
        loading: false,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };
    case 'ADD_TRIP':
      return {
        ...state,
        trips: [...state.trips, action.payload],
      };
    case 'UPDATE_TRIP':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip._id === action.payload._id ? action.payload : trip
        ),
      };
    case 'DELETE_TRIP':
      return {
        ...state,
        trips: state.trips.filter((trip) => trip._id !== action.payload),
      };
    case 'ADD_EVENT':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip._id === action.payload.tripId
            ? { ...trip, events: [...trip.events, action.payload.event] }
            : trip
        ),
      };
    case 'UPDATE_EVENT':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip._id === action.payload.tripId
            ? {
                ...trip,
                events: trip.events.map((event) =>
                  event.id === action.payload.event.id ? action.payload.event : event
                ),
              }
            : trip
        ),
      };
    case 'DELETE_EVENT':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip._id === action.payload.tripId
            ? {
                ...trip,
                events: trip.events.filter((event) => event.id !== action.payload.eventId),
              }
            : trip
        ),
      };
    default:
      return state;
  }
}

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = React.useReducer(tripReducer, {
    trips: [],
    loading: false, // Start with loading false for cached data
    error: null,
  });

  const { user } = useAuth();
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);
  const previousUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (user?._id && previousUserIdRef.current && previousUserIdRef.current !== user._id) {
      setInitialLoadComplete(false);
    }
    previousUserIdRef.current = user?._id ?? null;
  }, [user?._id]);

  // Load cached data immediately when user is available
  React.useEffect(() => {
    const loadCachedData = async () => {
      if (!user || initialLoadComplete) return;
      
      try {
        const result = await networkAwareApi.getCacheFirstTrips();
        dispatch({ type: 'SET_TRIPS', payload: result.data });
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error loading trips:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load data' });
        setInitialLoadComplete(true);
      }
    };

    loadCachedData();
  }, [user?._id, initialLoadComplete]);

  // Listen for background updates
  React.useEffect(() => {
    const handleTripsUpdated = (event: CustomEvent) => {
      dispatch({ type: 'SET_TRIPS', payload: event.detail.trips });
    };

    const handleTripUpdated = (event: CustomEvent) => {
      dispatch({ type: 'UPDATE_TRIP', payload: event.detail.trip });
    };

    window.addEventListener('tripsUpdated', handleTripsUpdated as EventListener);
    window.addEventListener('tripUpdated', handleTripUpdated as EventListener);
    
    return () => {
      window.removeEventListener('tripsUpdated', handleTripsUpdated as EventListener);
      window.removeEventListener('tripUpdated', handleTripUpdated as EventListener);
    };
  }, []);

  const addTrip = async (trip: Trip) => {
    try {
      if (!trip._id) {
        throw new Error('Trip is missing ID');
      }

      const exists = state.trips.some(t => t._id === trip._id);
      if (!exists) {
        dispatch({ type: 'ADD_TRIP', payload: trip });
      } else {
        dispatch({ type: 'UPDATE_TRIP', payload: trip });
      }
    } catch (error) {
      console.error('Error in addTrip:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to add trip' });
      throw error;
    }
  };

  const updateTrip = async (trip: Trip) => {
    try {
      const updatedTrip = await networkAwareApi.updateTrip(trip);
      dispatch({ type: 'UPDATE_TRIP', payload: updatedTrip });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update trip' });
    }
  };

  const deleteTrip = async (tripId: string) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await networkAwareApi.deleteTrip(tripId);
      dispatch({ type: 'DELETE_TRIP', payload: tripId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete trip';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error; // Re-throw to handle in component
    }
  };

  const leaveTrip = async (tripId: string) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await api.leaveTrip(tripId);
      dispatch({ type: 'DELETE_TRIP', payload: tripId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave trip';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  };

  const addEvent = async (tripId: string, event: Event) => {
    try {
      const trip = state.trips.find((t) => t._id === tripId);
      if (!trip) throw new Error('Trip not found');
      
      const updatedTrip = await api.updateTrip({
        ...trip,
        events: [...trip.events, event],
      });
      
      dispatch({ type: 'ADD_EVENT', payload: { tripId, event } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to add event' });
    }
  };

  const updateEvent = async (tripId: string, event: Event) => {
    try {
      const trip = state.trips.find((t) => t._id === tripId);
      if (!trip) throw new Error('Trip not found');
      
      const updatedTrip = await api.updateTrip({
        ...trip,
        events: trip.events.map((e) => (e.id === event.id ? event : e)),
      });
      
      dispatch({ type: 'UPDATE_EVENT', payload: { tripId, event } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update event' });
    }
  };

  const deleteEvent = async (tripId: string, eventId: string) => {
    try {
      const trip = state.trips.find((t) => t._id === tripId);
      if (!trip) throw new Error('Trip not found');
      
      const updatedTrip = await api.updateTrip({
        ...trip,
        events: trip.events.filter((e) => e.id !== eventId),
      });
      
      dispatch({ type: 'DELETE_EVENT', payload: { tripId, eventId } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete event' });
    }
  };

  return (
    <TripContext.Provider
      value={{
        state,
        addTrip,
        updateTrip,
        deleteTrip,
        leaveTrip,
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => {
  const context = React.useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}; 