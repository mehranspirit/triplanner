import React, { useState } from 'react';
import { Trip, User } from '../types';
import { api } from '../services/api';
import Avatar from './Avatar';

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' }): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
};

interface CollaboratorModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (trip: Trip) => void;
}

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ trip, isOpen, onClose, onUpdate }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!trip._id) {
      setError('Trip ID is missing');
      return;
    }

    try {
      // Make the API call
      await api.addCollaborator(trip._id, email, role);
      
      // Fetch the latest trip data from the server
      const serverTrip = await api.getTrip(trip._id);
      
      // Log the updated collaborators
      //console.log('Updated collaborators after adding:', serverTrip.collaborators);
      
      // Update the UI with the server data
      onUpdate(serverTrip);
      
      // Reset form
      setEmail('');
      setRole('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add collaborator');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!trip._id) {
      setError('Trip ID is missing');
      return;
    }

    try {
      // Make the API call
      await api.removeCollaborator(trip._id, userId);
      
      // Fetch the latest trip data from the server
      const serverTrip = await api.getTrip(trip._id);
      
      // Log the updated collaborators
      //console.log('Updated collaborators after removing:', serverTrip.collaborators);
      
      // Update the UI with the server data
      onUpdate(serverTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
      
      // On error, fetch the latest trip data to ensure consistency
      try {
        const latestTrip = await api.getTrip(trip._id);
        onUpdate(latestTrip);
      } catch (fetchErr) {
        console.error('Failed to fetch latest trip data after error:', fetchErr);
      }
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    if (!trip._id) {
      setError('Trip ID is missing');
      return;
    }

    try {
      // console.log('Starting role update:', {
      //   tripId: trip._id,
      //   userId,
      //   newRole,
      //   currentCollaborators: trip.collaborators
      //     .filter(isCollaboratorObject)
      //     .map(c => ({
      //       userId: c.user._id,
      //       name: c.user.name,
      //       role: c.role
      //     }))
      // });
      
      // Create an optimistic update to maintain the order of collaborators
      const updatedTrip = {
        ...trip,
        collaborators: trip.collaborators
          .filter(isCollaboratorObject)
          .map(c => 
            c.user._id === userId 
              ? { ...c, role: newRole } 
              : c
          )
      };
      
      // Update the UI immediately to prevent visual reordering
      onUpdate(updatedTrip);
      
      // Make the API call in the background
      await api.updateCollaboratorRole(trip._id, userId, newRole);
      
      // Add a small delay to ensure the server has processed the update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Then fetch the latest trip data from the server
      try {
        const serverTrip = await api.getTrip(trip._id);
        
        // Log the updated collaborator data
        const updatedCollaborator = serverTrip.collaborators
          .filter(isCollaboratorObject)
          .find(c => c.user._id === userId);
        
        // console.log('Updated collaborator data:', {
        //   userId,
        //   name: updatedCollaborator?.user.name,
        //   role: updatedCollaborator?.role,
        //   roleType: typeof updatedCollaborator?.role
        // });
        
        // Update the UI with the server data, but maintain the order
        const orderedServerTrip = {
          ...serverTrip,
          collaborators: updatedTrip.collaborators.map(localCollab => {
            // Find the matching collaborator from the server data
            const serverCollab = serverTrip.collaborators
              .filter(isCollaboratorObject)
              .find(sc => sc.user._id === localCollab.user._id);
            // Use server data but maintain the order from local data
            return serverCollab || localCollab;
          })
        };
        
        onUpdate(orderedServerTrip);
        
        //console.log('Role update complete');
      } catch (fetchErr) {
        console.error('Error fetching updated trip:', fetchErr);
        // We already updated the UI optimistically, so no need to do it again
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
      
      // On error, fetch the latest trip data to ensure consistency
      try {
        const latestTrip = await api.getTrip(trip._id);
        onUpdate(latestTrip);
      } catch (fetchErr) {
        console.error('Failed to fetch latest trip data after error:', fetchErr);
      }
    }
  };

  const modalStyle = {
    zIndex: 1000, // Ensure the modal appears above other elements
    // ... existing styles ...
  };

  return (
    <div style={modalStyle} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Manage Collaborators</h3>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleAddCollaborator} className="mb-6">
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="input"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Add Collaborator
          </button>
        </form>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Current Collaborators</h4>
          <div className="max-h-60 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {trip.collaborators
                .filter(isCollaboratorObject)
                .map((collaborator) => (
                <li key={collaborator.user._id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <Avatar
                      photoUrl={collaborator.user.photoUrl || null}
                      name={collaborator.user.name}
                      size="sm"
                      className="ring-2 ring-gray-200"
                    />
                    <div>
                      <p className="font-medium">{collaborator.user.name}</p>
                      <p className="text-sm text-gray-500">{collaborator.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={collaborator.role}
                      onChange={(e) =>
                        handleRoleChange(
                          collaborator.user._id,
                          e.target.value as 'editor' | 'viewer'
                        )
                      }
                      className="input py-1"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      onClick={() => handleRemoveCollaborator(collaborator.user._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorModal; 