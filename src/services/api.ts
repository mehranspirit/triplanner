/// <reference types="vite/client" />
import { Event } from '../types';
import { Trip, AISuggestionHistory, User } from '../types/eventTypes';
import { API_URL } from '../config';
import { getHeaders } from '../utils/api.ts';
import { Expense, Settlement, ExpenseSummary } from '../types/expenseTypes';
import { DreamTrip } from '../types/dreamTripTypes';

type Collaborator = string | { user: User; role: 'editor' | 'viewer' };

const isCollaboratorObject = (c: Collaborator): c is { user: User; role: 'editor' | 'viewer' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
};

export interface TripNote {
  content: string;
  edits: {
    content: string;
    user: {
      _id: string;
      name: string;
      email: string;
      photoUrl: string | null;
    };
    timestamp: string;
  }[];
  lastEditedBy: {
    _id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
  lastEditedAt: string;
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
  exportTripAsPDF: (tripId: string) => Promise<void>;
  exportTripAsHTML: (tripId: string) => Promise<void>;
  voteEvent: (tripId: string, eventId: string, voteType: 'like' | 'dislike') => Promise<Trip>;
  removeVote: (tripId: string, eventId: string) => Promise<Trip>;
  getAISuggestions: (tripId: string, userId: string) => Promise<AISuggestionHistory[]>;
  saveAISuggestion: (suggestion: Omit<AISuggestionHistory, '_id'>) => Promise<AISuggestionHistory>;
  deleteAISuggestion: (suggestionId: string) => Promise<void>;
  getExpenses: (tripId: string) => Promise<Expense[]>;
  addExpense: (tripId: string, expense: Omit<Expense, '_id'>) => Promise<Expense>;
  updateExpense: (tripId: string, expenseId: string, updates: Partial<Expense>) => Promise<Expense>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  settleExpense: (tripId: string, expenseId: string, participantId: string) => Promise<void>;
  getSettlements: (tripId: string) => Promise<Settlement[]>;
  addSettlement: (tripId: string, settlement: Omit<Settlement, '_id'>) => Promise<Settlement>;
  updateSettlement: (tripId: string, settlementId: string, updates: Partial<Settlement>) => Promise<Settlement>;
  deleteSettlement: (tripId: string, settlementId: string) => Promise<void>;
  getExpenseSummary: (tripId: string) => Promise<ExpenseSummary>;
  getDreamTrip: (id: string | undefined) => Promise<DreamTrip>;
  addDreamTripCollaborator: (tripId: string, email: string, role: 'editor' | 'viewer') => Promise<DreamTrip>;
  removeDreamTripCollaborator: (tripId: string, userId: string) => Promise<DreamTrip>;
  updateDreamTripCollaboratorRole: (tripId: string, userId: string, role: 'editor' | 'viewer') => Promise<DreamTrip>;
  getTripNotes: (tripId: string) => Promise<TripNote>;
  updateTripNotes: (tripId: string, content: string) => Promise<TripNote>;
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
        isPublic: trip.isPublic,
        status: trip.status || 'planning',
        tags: trip.tags || []
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
    
    // Transform the trip data with proper type handling
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
      collaborators: Array.isArray(trip.collaborators) 
        ? trip.collaborators.map((c: any) => {
            if (!c) return null;
            if (typeof c === 'string') return c;
            
            try {
              return {
                user: {
                  _id: c.user?._id || c.user?.id || '',
                  name: c.user?.name || 'Unknown User',
                  email: c.user?.email || '',
                  photoUrl: c.user?.photoUrl || null
                },
                role: c.role || c._doc?.role || 'viewer'
              };
            } catch (err) {
              console.error('Error transforming collaborator:', err);
              return null;
            }
          }).filter(Boolean)
        : [],
      shareableLink: trip.shareableLink,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      isPublic: trip.isPublic,
      status: trip.status || 'planning',
      tags: trip.tags || []
    };

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
      isPublic: createdTrip.isPublic,
      status: createdTrip.status || 'planning',
      tags: createdTrip.tags || []
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
      const collaborator = trip.collaborators.find(c => isCollaboratorObject(c) && c.user._id === userId);
      
      if (!collaborator || !isCollaboratorObject(collaborator)) {
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

  // Export trip as PDF
  exportTripAsPDF: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    
    try {
      // Get the authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Make a direct fetch request to get the PDF
      const response = await fetch(`${API_URL}/api/trips/${tripId}/export/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to export trip as PDF');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `trip_${tripId}_itinerary.pdf`;
      
      // Append to the document
      document.body.appendChild(a);
      
      // Click the link
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting trip as PDF:', error);
      throw new Error('Failed to export trip as PDF');
    }
  },

  // Export trip as HTML
  exportTripAsHTML: async (tripId: string): Promise<void> => {
    if (!tripId) throw new Error('Trip ID is required');
    
    try {
      // Get the authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Make a direct fetch request to get the HTML first
      const response = await fetch(`${API_URL}/api/trips/${tripId}/export/html`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to export trip as HTML');
      }
      
      // Get the HTML content
      const html = await response.text();
      
      // Only try to open the window after we have the HTML content
      try {
        // Open a new window
        const newWindow = window.open('about:blank', '_blank');
        
        if (!newWindow) {
          throw new Error('Failed to open new window. Please check your popup blocker settings.');
        }
        
        // Write the HTML to the new window
        newWindow.document.open();
        newWindow.document.write(html);
        newWindow.document.close();
      } catch (windowError) {
        console.error('Error opening window:', windowError);
        // Create a temporary element to display the HTML
        const blob = new Blob([html], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trip_${tripId}_itinerary.html`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting trip as HTML:', error);
      throw new Error('Failed to export trip as HTML');
    }
  },

  voteEvent: async (tripId: string, eventId: string, voteType: 'like' | 'dislike'): Promise<Trip> => {
    if (!tripId || !eventId || !voteType) throw new Error('Trip ID, event ID, and vote type are required');
    console.log(`Voting on event: ${voteType}`, { tripId, eventId });
    
    const response = await fetch(`${API_URL}/api/trips/${tripId}/events/${eventId}/vote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ voteType }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to ${voteType} event`);
    }
    
    return await response.json();
  },
  
  removeVote: async (tripId: string, eventId: string): Promise<Trip> => {
    if (!tripId || !eventId) throw new Error('Trip ID and event ID are required');
    console.log('Removing vote from event:', { tripId, eventId });
    
    const response = await fetch(`${API_URL}/api/trips/${tripId}/events/${eventId}/vote`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to remove vote');
    }
    
    return await response.json();
  },

  getAISuggestions: async (tripId: string, userId: string): Promise<AISuggestionHistory[]> => {
    try {
      console.log('Fetching AI suggestions for:', { tripId, userId });
      const response = await fetch(`${API_URL}/api/trips/${tripId}/ai-suggestions/${userId}`, {
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to fetch AI suggestions:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData?.message || `Failed to fetch AI suggestions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetched AI suggestions:', data);
      
      // Transform the response to match AISuggestionHistory type
      return data.map((item: any) => ({
        _id: item._id,
        userId: item.userId,
        tripId: item.tripId,
        places: item.places,
        activities: item.activities,
        suggestions: item.suggestions,
        createdAt: item.createdAt
      }));
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      throw error;
    }
  },

  saveAISuggestion: async (suggestion: Omit<AISuggestionHistory, '_id'>): Promise<AISuggestionHistory> => {
    try {
      console.log('Saving AI suggestion to:', `${API_URL}/api/trips/${suggestion.tripId}/ai-suggestions`);
      console.log('Suggestion data:', suggestion);
      
      const response = await fetch(`${API_URL}/api/trips/${suggestion.tripId}/ai-suggestions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(suggestion),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to save AI suggestion:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData?.message || `Failed to save AI suggestion: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Saved AI suggestion response:', data);
      
      // Ensure the response matches the AISuggestionHistory type
      const transformedSuggestion: AISuggestionHistory = {
        _id: data._id,
        userId: data.userId,
        tripId: data.tripId,
        places: data.places,
        activities: data.activities,
        suggestions: data.suggestions,
        createdAt: data.createdAt
      };
      
      return transformedSuggestion;
    } catch (error) {
      console.error('Error saving AI suggestion:', error);
      throw error;
    }
  },

  deleteAISuggestion: async (suggestionId: string): Promise<void> => {
    try {
      console.log('Deleting AI suggestion:', suggestionId);
      const response = await fetch(`${API_URL}/api/trips/ai-suggestions/${suggestionId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to delete AI suggestion:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData?.message || `Failed to delete AI suggestion: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting AI suggestion:', error);
      throw error;
    }
  },

  // Expense Management
  getExpenses: async (tripId: string): Promise<Expense[]> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  addExpense: async (tripId: string, expense: Omit<Expense, '_id'>): Promise<Expense> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(expense),
    });
    if (!response.ok) throw new Error('Failed to add expense');
    return response.json();
  },

  updateExpense: async (tripId: string, expenseId: string, updates: Partial<Expense>): Promise<Expense> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update expense');
    return response.json();
  },

  deleteExpense: async (tripId: string, expenseId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete expense');
  },

  settleExpense: async (tripId: string, expenseId: string, participantId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses/${expenseId}/settle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ participantId }),
    });
    if (!response.ok) throw new Error('Failed to settle expense');
  },

  // Settlement Management
  getSettlements: async (tripId: string): Promise<Settlement[]> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/settlements`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch settlements');
    return response.json();
  },

  addSettlement: async (tripId: string, settlement: Omit<Settlement, '_id'>): Promise<Settlement> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/settlements`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settlement),
    });
    if (!response.ok) throw new Error('Failed to add settlement');
    return response.json();
  },

  updateSettlement: async (tripId: string, settlementId: string, updates: Partial<Settlement>): Promise<Settlement> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/settlements/${settlementId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update settlement');
    return response.json();
  },

  deleteSettlement: async (tripId: string, settlementId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/settlements/${settlementId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete settlement');
  },

  getExpenseSummary: async (tripId: string): Promise<ExpenseSummary> => {
    const response = await fetch(`${API_URL}/api/trips/${tripId}/expenses/summary`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch expense summary');
    return response.json();
  },

  // Dream Trip specific methods
  getDreamTrip: async (id: string | undefined): Promise<DreamTrip> => {
    if (!id) throw new Error('Trip ID is required');
    console.log('Fetching trip with ID:', id);
    const response = await fetch(`${API_URL}/api/trips/dream/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch trip');
    }
    const trip = await response.json();
    console.log('Raw trip data:', JSON.stringify(trip, null, 2));
    
    // Transform the trip data with proper type handling
    const transformedTrip: DreamTrip = {
      _id: trip._id,
      title: trip.title,
      description: trip.description,
      targetDate: trip.targetDate,
      ideas: trip.ideas || [],
      owner: {
        _id: trip.owner._id,
        name: trip.owner.name,
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl || null
      },
      collaborators: Array.isArray(trip.collaborators) 
        ? trip.collaborators.map((c: any) => {
            if (!c) return null;
            if (typeof c === 'string') return c;
            
            try {
              return {
                user: {
                  _id: c.user?._id || c.user?.id || '',
                  name: c.user?.name || 'Unknown User',
                  email: c.user?.email || '',
                  photoUrl: c.user?.photoUrl || null
                },
                role: c.role || c._doc?.role || 'viewer'
              };
            } catch (err) {
              console.error('Error transforming collaborator:', err);
              return null;
            }
          }).filter(Boolean)
        : [],
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      thumbnailUrl: trip.thumbnailUrl,
      isPublic: trip.isPublic,
      tags: trip.tags || [],
      location: trip.location,
      notes: trip.notes,
      settings: trip.settings,
      shareableLink: trip.shareableLink
    };

    return transformedTrip;
  },

  addDreamTripCollaborator: async (tripId: string, email: string, role: 'editor' | 'viewer'): Promise<DreamTrip> => {
    if (!tripId || !email || !role) throw new Error('Trip ID, email, and role are required');
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/collaborators`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add collaborator');
    }
    return response.json();
  },

  removeDreamTripCollaborator: async (tripId: string, userId: string): Promise<DreamTrip> => {
    if (!tripId || !userId) throw new Error('Trip ID and user ID are required');
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to remove collaborator');
    }
    return response.json();
  },

  updateDreamTripCollaboratorRole: async (tripId: string, userId: string, role: 'editor' | 'viewer'): Promise<DreamTrip> => {
    if (!tripId || !userId || !role) throw new Error('Trip ID, user ID, and role are required');
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/collaborators/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update collaborator role');
    }
    return response.json();
  },

  getTripNotes: async (tripId: string): Promise<TripNote> => {
    if (!tripId) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/api/trips/${tripId}/notes`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to fetch trip notes');
    }
    return response.json();
  },

  updateTripNotes: async (tripId: string, content: string): Promise<TripNote> => {
    if (!tripId) throw new Error('Trip ID is required');
    const response = await fetch(`${API_URL}/api/trips/${tripId}/notes`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to update trip notes');
    }
    return response.json();
  },
};

// Activity related functions
export const getActivities = async (page = 1, limit = 20): Promise<any> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/activities?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch activities');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

export const getTripActivities = async (tripId: string, page = 1, limit = 20): Promise<any> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/activities/trip/${tripId}?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch trip activities');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trip activities:', error);
    throw error;
  }
};