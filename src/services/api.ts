/// <reference types="vite/client" />
import { Trip, Event } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Get all trips
  getTrips: async (): Promise<Trip[]> => {
    const response = await fetch(`${API_URL}/trips`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch trips');
    }
    return response.json();
  },

  getTrip: async (id: string | undefined): Promise<Trip> => {
    if (!id) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/trips/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch trip');
    return response.json();
  },

  // Create a new trip
  createTrip: async (trip: Omit<Trip, '_id'>): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips`, {
      method: 'POST',
      headers: getHeaders(),
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
      headers: getHeaders(),
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
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to delete trip');
    }
  },

  // Add a collaborator to a trip
  addCollaborator: async (tripId: string, email: string, role: 'editor' | 'viewer'): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      throw new Error('Failed to add collaborator');
    }
    return response.json();
  },

  // Remove a collaborator from a trip
  removeCollaborator: async (tripId: string, userId: string): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to remove collaborator');
    }
    return response.json();
  },

  // Update a collaborator's role
  updateCollaboratorRole: async (tripId: string, userId: string, role: 'editor' | 'viewer'): Promise<Trip> => {
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      throw new Error('Failed to update collaborator role');
    }
    return response.json();
  },

  // Generate a share link for a trip
  generateShareLink: async (tripId: string): Promise<{ shareableLink: string }> => {
    const response = await fetch(`${API_URL}/trips/${tripId}/share`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to generate share link');
    }
    return response.json();
  },

  // Revoke a share link for a trip
  revokeShareLink: async (tripId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/trips/${tripId}/share`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to revoke share link');
    }
  },
}; 