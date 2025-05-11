import React from 'react';
import { Trip } from '@/types/eventTypes';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import TripActions from './TripActions';
import { cn } from '@/lib/utils';

interface TripHeaderProps {
  trip: Trip;
  currentUserId?: string;
  isOwner: boolean;
  canEdit: boolean;
  onExport: () => void;
  onTripUpdate: (trip: Trip) => Promise<void>;
  className?: string;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  trip,
  currentUserId,
  isOwner,
  canEdit,
  onExport,
  onTripUpdate,
  className
}) => {
  // Filter collaborators to get only object type collaborators
  const collaborators = trip.collaborators
    .filter((c): c is { user: Trip['owner']; role: 'viewer' | 'editor' } => 
      typeof c === 'object' && c !== null && 'user' in c && 'role' in c
    );

  return (
    <div className={cn("relative w-full", className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg" />
      
      {/* Content */}
      <div className="relative p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Trip info */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{trip.name}</h1>
          {trip.description && (
            <p className="text-gray-600 text-sm">{trip.description}</p>
          )}
        </div>

        {/* Actions and collaborators */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          {/* Collaborator avatars */}
          <CollaboratorAvatars
            owner={trip.owner}
            collaborators={collaborators}
            currentUserId={currentUserId}
          />

          {/* Trip actions */}
          <TripActions
            trip={trip}
            isOwner={isOwner}
            canEdit={canEdit}
            onExport={onExport}
            onTripUpdate={onTripUpdate}
          />
        </div>
      </div>
    </div>
  );
}; 