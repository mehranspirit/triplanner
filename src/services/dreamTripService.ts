import { API_URL } from '../config/index';
import { getHeaders } from '../utils/api';
import { DreamTrip, CreateDreamTripData, CreateTripIdeaData, UpdateTripIdeaData, TripIdea } from '../types/dreamTripTypes';
import { pexelsService } from './pexelsService';

export const dreamTripService = {
  // Dream Trip CRUD operations
  getDreamTrips: async (): Promise<DreamTrip[]> => {
    const response = await fetch(`${API_URL}/api/trips/dream`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch dream trips');
    }
    return response.json();
  },

  createDreamTrip: async (data: CreateDreamTripData): Promise<DreamTrip> => {
    // Only fetch from Pexels if no custom thumbnail URL is provided
    let thumbnailUrl = data.thumbnailUrl;
    if (!thumbnailUrl) {
      const pexelsImage = await pexelsService.searchImage(data.title);
      thumbnailUrl = pexelsImage || undefined;
    }
    
    const response = await fetch(`${API_URL}/api/trips/dream`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...data,
        thumbnailUrl
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create dream trip');
    }
    return response.json();
  },

  getDreamTrip: async (id: string): Promise<DreamTrip> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch dream trip');
    }
    return response.json();
  },

  updateDreamTrip: async (id: string, data: Partial<DreamTrip>): Promise<DreamTrip> => {
    // Only fetch from Pexels if name is being updated and no custom thumbnail URL is provided
    let thumbnailUrl = data.thumbnailUrl;
    if (data.title && !thumbnailUrl) {
      const pexelsImage = await pexelsService.searchImage(data.title);
      thumbnailUrl = pexelsImage || undefined;
    }

    const response = await fetch(`${API_URL}/api/trips/dream/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        ...data,
        thumbnailUrl
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update dream trip');
    }
    return response.json();
  },

  deleteDreamTrip: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete dream trip');
    }
  },

  // Idea CRUD operations
  addIdea: async (tripId: string, data: CreateTripIdeaData): Promise<TripIdea> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/ideas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add idea');
    }
    return response.json();
  },

  updateIdea: async (tripId: string, ideaId: string, data: UpdateTripIdeaData): Promise<TripIdea> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/ideas/${ideaId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update idea');
    }
    return response.json();
  },

  deleteIdea: async (tripId: string, ideaId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/ideas/${ideaId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete idea');
    }
  },

  // Collaboration operations
  addCollaborator: async (tripId: string, email: string, role: 'viewer' | 'editor'): Promise<DreamTrip> => {
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

  removeCollaborator: async (tripId: string, userId: string): Promise<DreamTrip> => {
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

  updateCollaboratorRole: async (tripId: string, userId: string, role: 'viewer' | 'editor'): Promise<DreamTrip> => {
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

  leaveTrip: async (tripId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/trips/dream/${tripId}/leave`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to leave trip');
    }
  },
}; 