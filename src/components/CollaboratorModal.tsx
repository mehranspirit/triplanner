import React, { useState, useEffect, useRef } from 'react';
import { Trip, User } from '../types/eventTypes';
import { api, TripInviteLink } from '../services/api';
import Avatar from './Avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Check, Copy, Link2, Trash2, X, Plus, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { copyInviteUrl } from '@/utils/publicAppUrl';

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
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [localTrip, setLocalTrip] = useState(trip);
  const [inviteLinks, setInviteLinks] = useState<TripInviteLink[]>([]);
  const [inviteLinkRole, setInviteLinkRole] = useState<'editor' | 'viewer'>('viewer');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const inviteInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const focusInviteInput = (inviteId: string) => {
    window.setTimeout(() => {
      const input = inviteInputRefs.current[inviteId];
      input?.focus();
      input?.select();
    }, 0);
  };

  useEffect(() => {
    setLocalTrip(trip);
  }, [trip]);

  useEffect(() => {
    if (!isOpen || !trip._id) return;

    const loadInviteLinks = async () => {
      try {
        const links = await api.getTripInviteLinks(trip._id);
        setInviteLinks(links);
      } catch (err) {
        // Viewer/collaborator permission errors should not hide current collaborator management.
        console.warn('Failed to load invite links:', err);
      }
    };

    loadInviteLinks();
  }, [isOpen, trip._id]);

  if (!isOpen) return null;

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trip._id) {
      setError('Trip ID is missing');
      setIsLoading(false);
      return;
    }

    try {
      await api.addCollaborator(trip._id, trimmedEmail, role);
      const serverTrip = await api.getTrip(trip._id);
      setLocalTrip(serverTrip);
      onUpdate(serverTrip);
      setEmail('');
      setRole('viewer');
      setSuccess(`${trimmedEmail} was added as a ${role}.`);
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
    setError('');
    
    // Store original state for rollback
    const originalTrip = localTrip;
    
    try {
      // Apply optimistic update
      const optimisticTrip = {
        ...localTrip,
        collaborators: localTrip.collaborators.filter(c => 
          isCollaboratorObject(c) && c.user._id !== userId
        )
      };
      setLocalTrip(optimisticTrip);
      onUpdate(optimisticTrip);

      // Attempt to remove collaborator
      await api.removeCollaborator(trip._id, userId);
      
      // Fetch fresh data from server to ensure consistency
      const serverTrip = await api.getTrip(trip._id);
      setLocalTrip(serverTrip);
      onUpdate(serverTrip);
    } catch (err) {
      console.error('Error removing collaborator:', err);
      
      // Rollback optimistic update
      setLocalTrip(originalTrip);
      onUpdate(originalTrip);
      
            // Handle different error types
      if (err instanceof Error) {
        const hasVersionConflict = (err as any).code === 'VERSION_CONFLICT' || 
                                   err.message.includes('VERSION_CONFLICT') || 
                                   err.message.includes('modified by another user');
        
        if (hasVersionConflict) {
          setError('The trip was updated by another user. The page will refresh with the latest data.');
          // Auto-refresh after a short delay
          setTimeout(async () => {
            try {
              const freshTrip = await api.getTrip(trip._id);
              setLocalTrip(freshTrip);
              onUpdate(freshTrip);
              setError('');
            } catch (refreshErr) {
              console.error('Error refreshing trip data:', refreshErr);
              setError('Failed to refresh trip data. Please reload the page.');
            }
          }, 2000);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to remove collaborator');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInviteLink = async () => {
    setError('');
    setSuccess('');
    setIsCreatingLink(true);

    try {
      const inviteLink = await api.createTripInviteLink(trip._id, inviteLinkRole);
      setInviteLinks(prev => [inviteLink, ...prev]);
      setSuccess(`Created a ${inviteLinkRole} invite link. Use Copy to share it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite link');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyInviteLink = async (inviteLink: TripInviteLink) => {
    const copied = await copyInviteUrl(
      inviteLink.inviteUrl,
      inviteInputRefs.current[inviteLink._id]
    );
    if (copied) {
      setError('');
      setCopiedInviteId(inviteLink._id);
      setSuccess('Invite link copied.');
      setTimeout(() => setCopiedInviteId(null), 2000);
      return;
    }

    focusInviteInput(inviteLink._id);
    setSuccess('');
    setError('Automatic copy is blocked here. The link is selected — press Copy again or use keyboard copy.');
  };

  const handleRevokeInviteLink = async (inviteLink: TripInviteLink) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await api.revokeTripInviteLink(trip._id, inviteLink._id);
      setInviteLinks(prev => prev.filter(link => link._id !== inviteLink._id));
      setSuccess('Invite link revoked.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer') => {
    setIsLoading(true);
    try {
      const optimisticTrip = {
        ...localTrip,
        collaborators: localTrip.collaborators.map(c => {
          if (isCollaboratorObject(c) && c.user._id === userId) {
            return { ...c, role: newRole };
          }
          return c;
        })
      };
      setLocalTrip(optimisticTrip);
      onUpdate(optimisticTrip);

      await api.updateCollaboratorRole(trip._id, userId, newRole);
      const serverTrip = await api.getTrip(trip._id);
      setLocalTrip(serverTrip);
      onUpdate(serverTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
      setLocalTrip(trip);
      onUpdate(trip);
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
        {success && (
          <div className="mt-4 flex-shrink-0 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="flex-shrink-0 space-y-4 border-y py-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-950">Add existing user</h3>
              <p className="text-xs text-slate-500">Use this when the person already has an account.</p>
            </div>
            <form onSubmit={handleAddCollaborator} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full"
                required
              />
              </div>
              <Select
                value={role}
                onValueChange={(value: 'editor' | 'viewer') => setRole(value)}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
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
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-950">Create invite link</h3>
              <p className="text-xs text-slate-600">Share this through Messages, WhatsApp, Slack, or anywhere else. The link grants the selected role after login.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={inviteLinkRole}
                onValueChange={(value: 'editor' | 'viewer') => setInviteLinkRole(value)}
              >
                <SelectTrigger className="w-full sm:w-[150px] bg-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer link</SelectItem>
                  <SelectItem value="editor">Editor link</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" onClick={handleCreateInviteLink} disabled={isCreatingLink}>
                <Link2 className="mr-2 h-4 w-4" />
                {isCreatingLink ? 'Creating...' : 'Create link'}
              </Button>
            </div>
            {inviteLinks.length > 0 && (
              <div className="mt-4 space-y-2">
                {inviteLinks.map(inviteLink => (
                  <div key={inviteLink._id} className="rounded-xl border border-blue-100 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize text-slate-900">{inviteLink.role} invite link</p>
                        <Input
                          ref={(element) => {
                            inviteInputRefs.current[inviteLink._id] = element;
                          }}
                          value={inviteLink.inviteUrl}
                          readOnly
                          onFocus={(event) => event.currentTarget.select()}
                          onClick={(event) => event.currentTarget.select()}
                          className="mt-1 h-8 cursor-text truncate bg-slate-50 text-xs text-slate-600"
                          aria-label={`${inviteLink.role} invite link`}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          Expires {new Date(inviteLink.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCopyInviteLink(inviteLink)}>
                          {copiedInviteId === inviteLink._id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copiedInviteId === inviteLink._id ? 'Copied' : 'Copy'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleRevokeInviteLink(inviteLink)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Collaborators List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-6 px-1">
            <h3 className="text-sm font-medium text-gray-500 mb-4 px-3">Current Collaborators</h3>
            <div className="space-y-3">
              {localTrip.collaborators
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