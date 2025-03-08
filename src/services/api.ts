/// <reference types="vite/client" />
import { Trip, Event } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const api = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/api/auth/users`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to fetch users');
    }
    const users = await response.json();
    return users.map((user: any) => ({
      ...user,
      id: user._id || user.id
    }));
  },

  // Get all trips
  getTrips: async (): Promise<Trip[]> => {
    const response = await fetch(`${API_URL}/api/trips`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch trips');
    }
    const trips = await response.json();
    return trips.map((trip: any) => ({
      ...trip,
      id: trip._id || trip.id,
      owner: {
        ...trip.owner,
        id: trip.owner._id || trip.owner.id
      }
    }));
  },

  getTrip: async (id: string | undefined): Promise<Trip> => {
    if (!id) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/api/trips/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch trip');
    }
    const trip = await response.json();
    return {
      ...trip,
      id: trip._id || trip.id,
      owner: {
        ...trip.owner,
        id: trip.owner._id || trip.owner.id
      }
    };
  },

  // Create a new trip
  createTrip: async (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> => {
    const response = await fetch(`${API_URL}/api/trips`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(trip),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to create trip');
    }
    const createdTrip = await response.json();
    
    // Ensure we only use _id as id and remove any duplicate id fields
    const { _id, owner, ...rest } = createdTrip;
    return {
      ...rest,
      id: _id,
      owner: {
        ...owner,
        id: owner._id
      }
    };
  },

  // Update a trip
  updateTrip: async (trip: Trip): Promise<Trip> => {
    if (!trip.id) throw new Error('Trip ID is required for update');
    const response = await fetch(`${API_URL}/api/trips/${trip.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(trip),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to update trip');
    }
    const updatedTrip = await response.json();
    return {
      ...updatedTrip,
      id: updatedTrip._id || updatedTrip.id,
      owner: {
        ...updatedTrip.owner,
        id: updatedTrip.owner._id || updatedTrip.owner.id
      }
    };
  },

  // Delete a trip
  deleteTrip: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required for deletion');
    console.log('Attempting to delete trip:', tripId);
    const response = await fetch(`${API_URL}/api/trips/${tripId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.log('Delete error response:', { status: response.status, data: errorData });
      
      switch (response.status) {
        case 403:
          throw new Error('You do not have permission to delete this trip');
        case 404:
          throw new Error('Trip not found');
        case 401:
          throw new Error('Please log in again to delete this trip');
        default:
          throw new Error(errorData?.message || `Failed to delete trip (${response.status})`);
      }
    }
  },

  // Add a collaborator to a trip
  addCollaborator: async (tripId: string, email: string, role: 'editor' | 'viewer'): Promise<Trip> => {
    if (!tripId) throw new Error('Trip ID is required');
    if (!email) throw new Error('Email is required');
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to add collaborator');
    }
    return response.json();
  },

  // Remove a collaborator from a trip
  removeCollaborator: async (tripId: string, userId: string): Promise<Trip> => {
    if (!tripId) throw new Error('Trip ID is required');
    if (!userId) throw new Error('User ID is required');
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to remove collaborator');
    }
    return response.json();
  },

  // Update a collaborator's role
  updateCollaboratorRole: async (tripId: string, userId: string, role: 'editor' | 'viewer'): Promise<Trip> => {
    if (!tripId) throw new Error('Trip ID is required');
    if (!userId) throw new Error('User ID is required');
    const response = await fetch(`${API_URL}/trips/${tripId}/collaborators/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to update collaborator role');
    }
    return response.json();
  },

  // Generate a share link for a trip
  generateShareLink: async (tripId: string): Promise<{ shareableLink: string }> => {
    if (!tripId) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/trips/${tripId}/share`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to generate share link');
    }
    return response.json();
  },

  // Revoke a share link for a trip
  revokeShareLink: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/trips/${tripId}/share`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to revoke share link');
    }
  },
}; 