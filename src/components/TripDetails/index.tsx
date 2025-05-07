import React from 'react';
import { useParams } from 'react-router-dom';
import { useTripDetails } from './hooks';
import { TripHeader } from './TripHeader';
import { cn } from '@/lib/utils';

export const TripDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    trip,
    loading,
    error,
    user,
    isOwner,
    canEdit,
    handleExportHTML: onExport,
    handleTripUpdate: onTripUpdate,
  } = useTripDetails();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-destructive text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-yellow-600 text-xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">Trip Not Found</h2>
          <p className="text-muted-foreground">The requested trip could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6 py-6">
      {/* Trip Header with Collaborators */}
      <TripHeader
        trip={trip}
        currentUserId={user?._id}
        isOwner={isOwner}
        canEdit={canEdit}
        onExport={onExport}
        onTripUpdate={onTripUpdate}
        className="mb-8"
      />

      {/* Rest of the trip details content */}
      {/* Add your existing trip details content here */}
    </div>
  );
}; 