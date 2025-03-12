import React, { useState } from 'react';
import { Trip } from '../types';
import { api } from '../services/api';
import Avatar from './Avatar';

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
      await api.addCollaborator(trip._id, email, role);
      const updatedTrip = await api.getTrip(trip._id);
      onUpdate(updatedTrip);
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
      await api.removeCollaborator(trip._id, userId);
      const updatedTrip = await api.getTrip(trip._id);
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    if (!trip._id) {
      setError('Trip ID is missing');
      return;
    }

    try {
      await api.updateCollaboratorRole(trip._id, userId, newRole);
      const updatedTrip = await api.getTrip(trip._id);
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
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
          <ul className="space-y-2">
            {trip.collaborators.map((collaborator) => (
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