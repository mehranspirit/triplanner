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
  photoUrl?: string | null;
}

interface API {
  getUsers: () => Promise<User[]>;
  changeUserRole: (userId: string, isAdmin: boolean) => Promise<User>;
  getTrips: () => Promise<Trip[]>;
  getTrip: (id: string | undefined) => Promise<Trip>;
  createTrip: (trip: Omit<Trip, '_id' | 'createdAt' | 'updatedAt'>) => Promise<Trip>;
  updateTrip: (trip: Trip) => Promise<Trip>;
  leaveTrip: (tripId: string) => Promise<void>;
  removeCollaborator: (tripId: string, userId: string) => Promise<void>;
  updateCollaboratorRole: (tripId: string, userId: string, role: 'editor' | 'viewer') => Promise<void>;
  addCollaborator: (tripId: string, email: string, role: 'editor' | 'viewer') => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  generateShareLink: (tripId: string) => Promise<{ shareableLink: string }>;
  revokeShareLink: (tripId: string) => Promise<void>;
  login: (email: string, password: string) => Promise<{ token: string; user: User }>;
  register: (name: string, email: string, password: string) => Promise<{ token: string; user: User }>;
  logout: () => void;
  getCurrentUser: () => Promise<User>;
}

export const api: API = {
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

  // Change user role
  changeUserRole: async (userId: string, isAdmin: boolean): Promise<User> => {
    console.log('Changing user role:', { userId, isAdmin });
    const response = await fetch(`${API_URL}/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ isAdmin })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update user role');
    }
    
    const data = await response.json();
    console.log('Role change response:', data);
    return data.user;
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
          email: trip.owner.email,
          photoUrl: trip.owner.photoUrl || null
        },
        collaborators: (trip.collaborators || []).map((c: { user: { _id?: string, name: string, email: string, photoUrl?: string | null }, role: 'editor' | 'viewer', addedAt: string }) => ({
          user: {
            _id: c.user._id,
            name: c.user.name,
            email: c.user.email,
            photoUrl: c.user.photoUrl || null
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
    console.log('Raw trip data:', JSON.stringify(trip, null, 2));
    console.log('Raw collaborators:', JSON.stringify(trip.collaborators, null, 2));
    
    if (trip.collaborators && trip.collaborators.length > 0) {
      console.log('Collaborator roles:', trip.collaborators.map((c: any) => ({
        userId: c.user._id,
        name: c.user.name,
        role: c.role,
        roleType: typeof c.role
      })));
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
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl || null
      },
      collaborators: (trip.collaborators || []).map((c: { user: { _id?: string, id?: string, name: string, email: string, photoUrl?: string | null }, role: 'editor' | 'viewer', addedAt: string, _doc?: { role: 'editor' | 'viewer' } }) => {
        console.log('Mapping collaborator:', {
          userId: c.user._id,
          name: c.user.name,
          role: c._doc?.role || c.role,
          roleType: typeof (c._doc?.role || c.role)
        });
        return {
          user: {
            _id: c.user._id,
            name: c.user.name,
            email: c.user.email,
            photoUrl: c.user.photoUrl || null
          },
          role: c._doc?.role || c.role,
          addedAt: c.addedAt
        };
      }),
      shareableLink: trip.shareableLink,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic
    };
    
    console.log('Transformed collaborators:', JSON.stringify(transformedTrip.collaborators, null, 2));
    console.log('Transformed trip:', JSON.stringify(transformedTrip, null, 2));
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
    return updatedTrip;
  },

  // Leave a trip
  leaveTrip: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    console.log('Leaving trip with ID:', tripId);
    const response = await fetch(`${API_URL}/api/trips/${tripId}/leave`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to leave trip');
    }
  },

  removeCollaborator: async (tripId: string, userId: string): Promise<void> => {
    if (!tripId || !userId) throw new Error('Trip ID and user ID are required');
    console.log('Removing collaborator from trip:', { tripId, userId });
    const response = await fetch(`${API_URL}/api/trips/${tripId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to remove collaborator');
    }
  },

  updateCollaboratorRole: async (tripId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> => {
    if (!tripId || !userId || !role) throw new Error('Trip ID, user ID, and role are required');
    console.log('Updating collaborator role:', { tripId, userId, role });
    
    try {
      // We need to implement this endpoint on the server side
      // For now, let's use a workaround by removing and re-adding the collaborator
      
      // First, get the current trip to find the collaborator's email
      const trip = await api.getTrip(tripId);
      const collaborator = trip.collaborators.find(c => c.user._id === userId);
      
      if (!collaborator) {
        throw new Error('Collaborator not found');
      }
      
      // Remove the collaborator
      await fetch(`${API_URL}/api/trips/${tripId}/collaborators/${userId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      
      // Add the collaborator back with the new role
      await fetch(`${API_URL}/api/trips/${tripId}/collaborators`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          email: collaborator.user.email,
          role 
        }),
      });
      
      console.log('Successfully updated collaborator role using remove/add approach');
    } catch (error) {
      console.error('Error in updateCollaboratorRole:', error);
      throw error;
    }
  },

  addCollaborator: async (tripId: string, email: string, role: 'editor' | 'viewer'): Promise<void> => {
    if (!tripId || !email || !role) throw new Error('Trip ID, email, and role are required');
    console.log('Adding collaborator to trip:', { tripId, email, role });
    const response = await fetch(`${API_URL}/api/trips/${tripId}/collaborators`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add collaborator');
    }
  },

  deleteTrip: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    console.log('Deleting trip with ID:', tripId);
    const response = await fetch(`${API_URL}/api/trips/${tripId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete trip');
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (!userId) throw new Error('User ID is required');
    console.log('Deleting user with ID:', userId);
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete user');
    }
  },

  generateShareLink: async (tripId: string): Promise<{ shareableLink: string }> => {
    if (!tripId) throw new Error('Trip ID is required');
    console.log('Generating share link for trip:', tripId);
    const response = await fetch(`${API_URL}/api/trips/${tripId}/share-link`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate share link');
    }
    const data = await response.json();
    console.log('Share link generated:', data);
    return data;
  },

  revokeShareLink: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    console.log('Revoking share link for trip:', tripId);
    const response = await fetch(`${API_URL}/api/trips/${tripId}/share-link`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to revoke share link');
    }
  },

  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    if (!email || !password) throw new Error('Email and password are required');
    console.log('Logging in with email:', email);
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to login');
    }
    const data = await response.json();
    console.log('Login response:', data);
    return data;
  },

  register: async (name: string, email: string, password: string): Promise<{ token: string; user: User }> => {
    if (!name || !email || !password) throw new Error('Name, email, and password are required');
    console.log('Registering new user:', { name, email });
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to register');
    }
    const data = await response.json();
    console.log('Registration response:', data);
    return data;
  },

  logout: () => {
    console.log('Logging out');
    localStorage.removeItem('token');
  },

  getCurrentUser: async (): Promise<User> => {
    console.log('Fetching current user');
    const response = await fetch(`${API_URL}/api/auth/current-user`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch current user');
    }
    const user = await response.json();
    console.log('Current user response:', user);
    return user;
  },
};