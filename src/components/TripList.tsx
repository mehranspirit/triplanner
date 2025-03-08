import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { Trip } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function TripList() {
  const navigate = useNavigate();
  const { state, addTrip, deleteTrip } = useTrip();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', thumbnailUrl: '' });
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newTripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'> = {
        name: newTrip.name,
        thumbnailUrl: newTrip.thumbnailUrl || undefined,
        description: '',
        startDate: '',
        endDate: '',
        events: [],
        owner: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        collaborators: [],
        shareableLink: undefined
      };

      const createdTrip = await api.createTrip(newTripData);
      addTrip(createdTrip);
      setNewTrip({ name: '', thumbnailUrl: '' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!tripId) {
      setError('Trip ID is missing');
      return;
    }

    try {
      await api.deleteTrip(tripId);
      deleteTrip(tripId);
      setError(null); // Clear any existing errors
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    }
  };

  if (state.loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error</h2>
        <p className="text-gray-600 mt-2">{state.error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Trips</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          Add New Trip
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {state.trips.map((trip) => (
          <div key={trip.id} className="card hover:shadow-lg">
            <img
              src={trip.thumbnailUrl}
              alt={trip.name}
              className="w-full h-48 object-cover rounded-t-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                target.onerror = null; // Prevent infinite loop if placeholder also fails
              }}
            />
            <div className="p-4">
              <h3 className="text-xl font-semibold text-gray-900">{trip.name}</h3>
              <p className="text-gray-600 mt-2">
                {trip.events.length} events planned
              </p>
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => navigate(`/trip/${trip.id}`)}
                  className="btn btn-primary"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleDeleteTrip(trip.id)}
                  className="btn btn-secondary"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add New Trip</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Trip Name</label>
                <input
                  type="text"
                  value={newTrip.name}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
                <input
                  type="url"
                  value={newTrip.thumbnailUrl}
                  onChange={(e) =>
                    setNewTrip({ ...newTrip, thumbnailUrl: e.target.value })
                  }
                  className="input"
                  placeholder="Enter image URL or leave empty"
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 