import React from 'react';
import { useParams } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { ExpenseDashboard } from '../components/expenses/ExpenseDashboard';
import { User } from '../types/eventTypes';

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' }): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
};

const ExpensesPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { state } = useTrip();
  const trip = state.trips.find(t => t._id === tripId);

  if (!trip) {
    return <div>Loading...</div>;
  }

  // Get all participants (owner + collaborators)
  const participants = [
    trip.owner,
    ...trip.collaborators
      .filter(isCollaboratorObject)
      .map(c => c.user)
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900">Trip Expenses</h2>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <ExpenseDashboard 
            tripId={tripId!} 
            participants={participants}
            currentUser={trip.owner}
          />
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage; 