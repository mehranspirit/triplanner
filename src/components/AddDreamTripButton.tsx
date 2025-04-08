import React, { useState } from 'react';
import { DreamTripForm } from './DreamTripForm';

interface AddDreamTripButtonProps {
  onSuccess: () => void;
}

export const AddDreamTripButton: React.FC<AddDreamTripButtonProps> = ({ onSuccess }) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Dream Trip
      </button>

      {showForm && (
        <DreamTripForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            onSuccess();
            setShowForm(false);
          }}
        />
      )}
    </>
  );
}; 