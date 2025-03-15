import React from 'react';
import { useParams } from 'react-router-dom';
import ActivityLog from '../components/ActivityLog';

const ActivityLogPage: React.FC = () => {
  const { tripId } = useParams<{ tripId?: string }>();
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {tripId ? 'Trip Activity Log' : 'Activity Log'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tripId 
            ? 'View all activities related to this trip' 
            : 'View all activities related to your trips'
          }
        </p>
      </div>
      
      <ActivityLog tripId={tripId} />
    </div>
  );
};

export default ActivityLogPage; 