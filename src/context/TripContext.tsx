import * as React from 'react';
import { Trip, Event } from '@/types/eventTypes';
import { api } from '../services/api';
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
    loading: false,
    error: null,
  });

  const { user } = useAuth();

  React.useEffect(() => {
    const fetchTrips = async () => {
      // Only fetch trips if we have a logged-in user
      if (!user) {
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        console.log('Fetching trips for user:', user._id);
        const trips = await api.getTrips();
        console.log('Fetched trips:', trips);
        dispatch({ type: 'SET_TRIPS', payload: trips });
      } catch (error) {
        console.error('Error fetching trips:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch trips' });
      }
    };

    fetchTrips();
  }, [user?._id]); // Re-fetch when user ID changes

  const addTrip = async (trip: Trip) => {
    try {
      console.log('Adding trip to context:', trip);
      
      if (!trip._id) {
        console.error('Trip is missing ID:', trip);
        throw new Error('Trip is missing ID');
      }

      // Check if the trip already exists in state
      const exists = state.trips.some(t => t._id === trip._id);
      console.log('Trip exists in state:', exists);
      
      if (!exists) {
        dispatch({ type: 'ADD_TRIP', payload: trip });
        console.log('Trip added to state:', trip);
      } else {
        console.log('Trip already exists in state, updating instead');
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
      const updatedTrip = await api.updateTrip(trip);
      dispatch({ type: 'UPDATE_TRIP', payload: updatedTrip });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update trip' });
    }
  };

  const deleteTrip = async (tripId: string) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await api.deleteTrip(tripId);
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