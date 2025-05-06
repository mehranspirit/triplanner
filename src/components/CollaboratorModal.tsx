import React, { useState } from 'react';
import { Trip, User } from '../types/eventTypes';
import { api } from '../services/api';
import Avatar from './Avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Plus, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

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
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!trip._id) {
      setError('Trip ID is missing');
      setIsLoading(false);
      return;
    }

    try {
      await api.addCollaborator(trip._id, email, role);
      const serverTrip = await api.getTrip(trip._id);
      onUpdate(serverTrip);
      setEmail('');
      setRole('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add collaborator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    setIsLoading(true);
    try {
      await api.removeCollaborator(trip._id, userId);
      const serverTrip = await api.getTrip(trip._id);
      onUpdate(serverTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    setIsLoading(true);
    try {
      await api.updateCollaboratorRole(trip._id, userId, newRole);
      const serverTrip = await api.getTrip(trip._id);
      onUpdate(serverTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-500" />
            Manage Collaborators
          </DialogTitle>
          <DialogDescription>
            Add or remove collaborators and manage their access levels for this trip.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* Add Collaborator Form */}
        <div className="border-t border-b py-6 flex-shrink-0">
          <form onSubmit={handleAddCollaborator} className="flex gap-4">
            <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter collaborator's email"
                className="w-full"
                required
              />
            </div>
            <Select
              value={role}
              onValueChange={(value: 'editor' | 'viewer') => setRole(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              disabled={isLoading}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isLoading ? 'Adding...' : 'Add'}
            </Button>
          </form>
        </div>

        {/* Collaborators List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-6 px-1">
            <h3 className="text-sm font-medium text-gray-500 mb-4 px-3">Current Collaborators</h3>
            <div className="space-y-3">
              {trip.collaborators
                .filter(isCollaboratorObject)
                .map((collaborator) => (
                  <div
                    key={collaborator.user._id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar
                        photoUrl={collaborator.user.photoUrl || null}
                        name={collaborator.user.name}
                        size="md"
                        className="ring-2 ring-white"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{collaborator.user.name}</div>
                        <div className="text-sm text-gray-500">{collaborator.user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={collaborator.role}
                        onValueChange={(value: 'editor' | 'viewer') => 
                          handleRoleChange(collaborator.user._id, value)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCollaborator(collaborator.user._id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CollaboratorModal; 