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
  isAdmin?: boolean;
}

export const api = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    console.log('Fetching users from API');
    const response = await fetch(`${API_URL}/api/auth/users`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to fetch users');
    }
    const users = await response.json();
    console.log('Users response from API:', users);
    return users.map((user: any) => ({
      ...user,
      _id: user._id,
      isAdmin: user.isAdmin || false
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
    console.log('Raw trips from API:', trips);
    return trips.map((trip: any) => {
      if (!trip) {
        console.error('Invalid trip data received:', trip);
        return null;
      }

      // Transform the trip data
      const transformedTrip: Trip = {
        _id: trip._id,
        name: trip.name,
        description: trip.description,
        thumbnailUrl: trip.thumbnailUrl,
        startDate: trip.startDate,
        endDate: trip.endDate,
        events: trip.events || [],
        owner: {
          _id: trip.owner._id,
          name: trip.owner.name,
          email: trip.owner.email
        },
        collaborators: (trip.collaborators || []).map((c: { user: { _id?: string, name: string, email: string }, role: 'editor' | 'viewer', addedAt: string }) => ({
          user: {
            _id: c.user._id,
            name: c.user.name,
            email: c.user.email
          },
          role: c.role,
          addedAt: c.addedAt
        })),
        shareableLink: trip.shareableLink,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
        isPublic: trip.isPublic
      };

      return transformedTrip;
    }).filter((trip: unknown): trip is Trip => trip !== null);
  },

  getTrip: async (id: string | undefined): Promise<Trip> => {
    if (!id) throw new Error('Trip ID is required');
    console.log('Fetching trip with ID:', id);
    const response = await fetch(`${API_URL}/api/trips/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch trip');
    }
    const trip = await response.json();
    console.log('Raw trip data:', trip);
    
    // Transform the trip data
    const transformedTrip: Trip = {
      _id: trip._id,
      name: trip.name,
      description: trip.description,
      thumbnailUrl: trip.thumbnailUrl,
      startDate: trip.startDate,
      endDate: trip.endDate,
      events: trip.events || [],
      owner: {
        _id: trip.owner._id,
        name: trip.owner.name,
        email: trip.owner.email
      },
      collaborators: (trip.collaborators || []).map((c: { user: { _id?: string, id?: string, name: string, email: string }, role: 'editor' | 'viewer', addedAt: string }) => ({
        user: {
          _id: c.user._id,
          name: c.user.name,
          email: c.user.email
        },
        role: c.role,
        addedAt: c.addedAt
      })),
      shareableLink: trip.shareableLink,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic
    };
    
    console.log('Transformed trip:', transformedTrip);
    return transformedTrip;
  },

  // Create a new trip
  createTrip: async (trip: Omit<Trip, '_id' | 'createdAt' | 'updatedAt'>): Promise<Trip> => {
    console.log('Creating trip with data:', trip);
    
    // Transform the owner data for the server
    const serverTripData = {
      ...trip,
      owner: trip.owner._id // Send just the owner ID to the server
    };
    
    console.log('Sending to server:', serverTripData);
    const response = await fetch(`${API_URL}/api/trips`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(serverTripData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Failed to create trip:', errorData);
      throw new Error(errorData?.message || 'Failed to create trip');
    }
    
    const createdTrip = await response.json();
    console.log('Raw created trip from API:', JSON.stringify(createdTrip, null, 2));

    // Validate the response
    if (!createdTrip || typeof createdTrip !== 'object') {
      console.error('Invalid response from server:', createdTrip);
      throw new Error('Server returned invalid response');
    }

    // Validate trip ID
    if (!createdTrip._id || typeof createdTrip._id !== 'string') {
      console.error('Created trip has invalid ID:', createdTrip);
      throw new Error(`Server returned invalid trip data: missing or invalid ID (${typeof createdTrip._id})`);
    }

    // Validate owner object
    if (!createdTrip.owner || typeof createdTrip.owner !== 'object') {
      console.error('Created trip has invalid owner:', createdTrip);
      throw new Error('Server returned invalid trip data: missing owner object');
    }

    // Validate owner ID
    if (!createdTrip.owner._id || typeof createdTrip.owner._id !== 'string') {
      console.error('Created trip owner has invalid ID:', createdTrip.owner);
      throw new Error(`Server returned invalid trip data: missing or invalid owner ID (${typeof createdTrip.owner._id})`);
    }

    // Validate required owner fields
    if (!createdTrip.owner.name || !createdTrip.owner.email) {
      console.error('Created trip owner is missing required fields:', createdTrip.owner);
      throw new Error('Server returned invalid trip data: owner missing required fields');
    }

    // Transform the server response to match our frontend Trip type
    const transformedTrip: Trip = {
      _id: createdTrip._id,
      name: createdTrip.name,
      thumbnailUrl: createdTrip.thumbnailUrl,
      description: createdTrip.description,
      startDate: createdTrip.startDate,
      endDate: createdTrip.endDate,
      owner: {
        _id: createdTrip.owner._id,
        name: createdTrip.owner.name,
        email: createdTrip.owner.email
      },
      events: createdTrip.events || [],
      collaborators: createdTrip.collaborators || [],
      shareableLink: createdTrip.shareableLink,
      createdAt: createdTrip.createdAt,
      updatedAt: createdTrip.updatedAt,
      isPublic: createdTrip.isPublic
    };
    
    console.log('Final transformed trip:', JSON.stringify(transformedTrip, null, 2));
    return transformedTrip;
  },

  // Update a trip
  updateTrip: async (trip: Trip): Promise<Trip> => {
    if (!trip._id) throw new Error('Trip ID is required for update');
    const response = await fetch(`${API_URL}/api/trips/${trip._id}`, {
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
      _id: updatedTrip._id,
      owner: {
        _id: updatedTrip.owner._id,
        name: updatedTrip.owner.name,
        email: updatedTrip.owner.email
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
      throw new Error(errorData.message || 'Failed to delete trip');
    }
  },

  // Delete a user
  deleteUser: async (userId: string): Promise<void> => {
    if (!userId) throw new Error('User ID is required for deletion');
    console.log('Initiating user deletion:', {
      userId,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error('User deletion failed:', {
        userId,
        status: response.status,
        error: errorData.message,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorData.message || 'Failed to delete user');
    }

    const result = await response.json();
    console.log('User deletion successful:', {
      userId,
      result,
      timestamp: new Date().toISOString()
    });
  },

  // Add a collaborator to a trip
  addCollaborator: async (tripId: string, email: string, role: 'editor' | 'viewer'): Promise<Trip> => {
    if (!tripId) throw new Error('Trip ID is required');
    if (!email) throw new Error('Email is required');
    const response = await fetch(`${API_URL}/api/trips/${tripId}/collaborators`, {
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
    const response = await fetch(`${API_URL}/api/trips/${tripId}/share`, {
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
    const response = await fetch(`${API_URL}/api/trips/${tripId}/share`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to revoke share link');
    }
  },
}; 