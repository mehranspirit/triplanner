import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { Trip } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';

export default function TripList() {
  const navigate = useNavigate();
  const { state, addTrip, deleteTrip } = useTrip();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', thumbnailUrl: '' });
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trip: Omit<Trip, '_id'> = {
      id: uuidv4(),
      name: newTrip.name,
      thumbnailUrl: newTrip.thumbnailUrl || '',
      events: [],
      owner: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      collaborators: [],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await addTrip(trip);
    setNewTrip({ name: '', thumbnailUrl: '' });
    setIsModalOpen(false);
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
                  onClick={() => deleteTrip(trip.id)}
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