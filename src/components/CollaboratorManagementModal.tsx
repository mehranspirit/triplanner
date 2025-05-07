import React, { useState, useEffect } from 'react';
import { DreamTrip } from '../types/dreamTripTypes';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' } | null | undefined): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c && 
    typeof c.user === 'object' && c.user !== null && '_id' in c.user;
};

interface CollaboratorManagementModalProps {
  trip: DreamTrip;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTrip: DreamTrip) => void;
}

export const CollaboratorManagementModal: React.FC<CollaboratorManagementModalProps> = ({
  trip,
  isOpen,
  onClose,
  onUpdate
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localTrip, setLocalTrip] = useState(trip);

  useEffect(() => {
    setLocalTrip(trip);
  }, [trip]);

  if (!isOpen) return null;

  const isOwner = trip.owner._id === user?._id;
  const isEditor = trip.collaborators?.some(c => {
    if (!c) return false;
    return isCollaboratorObject(c) && c.user._id === user?._id && c.role === 'editor';
  }) ?? false;
  const canManageCollaborators = isOwner || isEditor;

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const optimisticCollaborator = {
        user: { _id: 'temp', name: 'Adding...', email, photoUrl: null },
        role
      };
      const optimisticTrip = {
        ...localTrip,
        collaborators: [...(localTrip.collaborators || []), optimisticCollaborator]
      };
      setLocalTrip(optimisticTrip);
      onUpdate(optimisticTrip);

      const updatedTrip = await api.addDreamTripCollaborator(trip._id, email, role);
      setLocalTrip(updatedTrip);
      onUpdate(updatedTrip);
      setEmail('');
      setRole('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add collaborator');
      setLocalTrip(trip);
      onUpdate(trip);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    setIsLoading(true);
    try {
      const optimisticTrip = {
        ...localTrip,
        collaborators: (localTrip.collaborators || []).filter(c => {
          if (!c) return false;
          return !isCollaboratorObject(c) || c.user._id !== userId;
        })
      };
      setLocalTrip(optimisticTrip);
      onUpdate(optimisticTrip);

      const updatedTrip = await api.removeDreamTripCollaborator(trip._id, userId);
      setLocalTrip(updatedTrip);
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
      setLocalTrip(trip);
      onUpdate(trip);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'viewer' | 'editor') => {
    setIsLoading(true);
    try {
      const optimisticTrip = {
        ...localTrip,
        collaborators: (localTrip.collaborators || []).map(c => {
          if (!c || !isCollaboratorObject(c)) return c;
          if (c.user._id === userId) {
            return { ...c, role: newRole };
          }
          return c;
        })
      };
      setLocalTrip(optimisticTrip);
      onUpdate(optimisticTrip);

      const updatedTrip = await api.updateDreamTripCollaboratorRole(trip._id, userId, newRole);
      setLocalTrip(updatedTrip);
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collaborator role');
      setLocalTrip(trip);
      onUpdate(trip);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-xl relative">
        {/* Fixed Header */}
        <div className="p-6 border-b flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-900">Manage Collaborators</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* Fixed Add Collaborator Form */}
        {canManageCollaborators && (
          <div className="p-6 border-b flex-shrink-0">
            <form onSubmit={handleAddCollaborator}>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter collaborator's email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
                <div className="w-40">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scrollable Collaborators List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Collaborators</h3>
              {localTrip.collaborators?.filter(c => c !== null).map((collaborator) => {
                if (!isCollaboratorObject(collaborator)) return null;
                return (
                  <div
                    key={collaborator.user._id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <img
                        src={collaborator.user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(collaborator.user.name)}&background=ffffff`}
                        alt={collaborator.user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{collaborator.user.name}</div>
                        <div className="text-sm text-gray-500">{collaborator.user.email}</div>
                      </div>
                    </div>
                    {canManageCollaborators && (
                      <div className="flex items-center space-x-4">
                        <select
                          value={collaborator.role}
                          onChange={(e) => handleUpdateRole(collaborator.user._id, e.target.value as 'viewer' | 'editor')}
                          disabled={isLoading}
                          className="px-3 py-1 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          onClick={() => handleRemoveCollaborator(collaborator.user._id)}
                          disabled={isLoading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 