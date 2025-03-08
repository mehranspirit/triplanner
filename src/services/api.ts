/// <reference types="vite/client" />
import { Trip, Event } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

export const api = {
  // Get all trips
  getTrips: async (): Promise<Trip[]> => {
    const response = await fetch(`${API_URL}/trips`);
    if (!response.ok) {
      throw new Error('Failed to fetch trips');
    }
    return response.json();
  },

  // Create a new trip
  createTrip: async (trip: Omit<Trip, '_id'>): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trip),
    });
    if (!response.ok) {
      throw new Error('Failed to create trip');
    }
    return response.json();
  },

  // Update a trip
  updateTrip: async (trip: Trip): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips/${trip.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trip),
    });
    if (!response.ok) {
      throw new Error('Failed to update trip');
    }
    return response.json();
  },

  // Delete a trip
  deleteTrip: async (tripId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/trips/${tripId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete trip');
    }
  },
}; 