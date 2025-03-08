import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Trip, Event } from '../types';
import { api } from '../services/api';

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

interface TripContextType {
  state: TripState;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  addEvent: (tripId: string, event: Event) => Promise<void>;
  updateEvent: (tripId: string, event: Event) => Promise<void>;
  deleteEvent: (tripId: string, eventId: string) => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'SET_TRIPS':
      return {
        ...state,
        trips: action.payload,
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
          trip.id === action.payload.id ? action.payload : trip
        ),
      };
    case 'DELETE_TRIP':
      return {
        ...state,
        trips: state.trips.filter((trip) => trip.id !== action.payload),
      };
    case 'ADD_EVENT':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip.id === action.payload.tripId
            ? { ...trip, events: [...trip.events, action.payload.event] }
            : trip
        ),
      };
    case 'UPDATE_EVENT':
      return {
        ...state,
        trips: state.trips.map((trip) =>
          trip.id === action.payload.tripId
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
          trip.id === action.payload.tripId
            ? {
                ...trip,
                events: trip.events.filter(
                  (event) => event.id !== action.payload.eventId
                ),
              }
            : trip
        ),
      };
    default:
      return state;
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripReducer, {
    trips: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    const fetchTrips = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const trips = await api.getTrips();
        dispatch({ type: 'SET_TRIPS', payload: trips });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch trips' });
      }
    };
    fetchTrips();
  }, []);

  const addTrip = async (trip: Trip) => {
    try {
      const newTrip = await api.createTrip(trip);
      // Check if the trip already exists in state
      const exists = state.trips.some(t => t.id === newTrip.id);
      if (!exists) {
        dispatch({ type: 'ADD_TRIP', payload: newTrip });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create trip' });
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

  const addEvent = async (tripId: string, event: Event) => {
    try {
      const trip = state.trips.find((t) => t.id === tripId);
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
      const trip = state.trips.find((t) => t.id === tripId);
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
      const trip = state.trips.find((t) => t.id === tripId);
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
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
} 