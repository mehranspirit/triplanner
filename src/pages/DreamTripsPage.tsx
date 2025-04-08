import React, { useState, useEffect } from 'react';
import { DreamTrip } from '../types/dreamTripTypes';
import { dreamTripService } from '../services/dreamTripService';
import { DreamTripCard } from '../components/DreamTripCard';
import { AddDreamTripButton } from '../components/AddDreamTripButton';

export const DreamTripsPage: React.FC = () => {
  const [trips, setTrips] = useState<DreamTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await dreamTripService.getDreamTrips();
      setTrips(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dream trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center">
          <p className="text-lg font-semibold mb-2">Error</p>
          <p>{error}</p>
          <button
            onClick={fetchTrips}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dream Trips</h1>
        <AddDreamTripButton onSuccess={fetchTrips} />
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No dream trips yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <DreamTripCard
              key={trip._id}
              trip={trip}
              onUpdate={fetchTrips}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 