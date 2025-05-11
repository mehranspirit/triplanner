import React from 'react';
import { Link } from 'react-router-dom';
import { DreamTrip } from '../types/dreamTripTypes';
import { useAuth } from '../context/AuthContext';
import { User } from '../types/eventTypes';

interface DreamTripListProps {
  trips: DreamTrip[];
}

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' }): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c;
};

export const DreamTripList: React.FC<DreamTripListProps> = ({ trips }) => {
  const { user } = useAuth();
  
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <Link
          key={trip._id}
          to={`/trips/dream/${trip._id}`}
          className="block group"
        >
          <div className="relative bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
            {trip.thumbnailUrl && (
              <div className="aspect-w-16 aspect-h-9 relative">
                <img
                  src={trip.thumbnailUrl}
                  alt={trip.title}
                  className="object-cover w-full h-full"
                />
                
                {/* Collaborator Avatars */}
                <div className="absolute bottom-2 right-2 flex -space-x-2 z-10">
                  {/* Owner Avatar */}
                  {trip.owner._id !== user?._id && (
                    <div className="relative group/avatar" onClick={(e) => e.stopPropagation()}>
                      <img
                        src={trip.owner.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(trip.owner.name)}&background=ffffff`}
                        alt={trip.owner.name}
                        className="w-8 h-8 rounded-full border-2 border-white shadow-md object-cover"
                      />
                      <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {trip.owner.name} • Owner
                      </div>
                    </div>
                  )}
                  
                  {/* Collaborator Avatars */}
                  {trip.collaborators
                    .filter(isCollaboratorObject)
                    .filter(collaborator => collaborator.user._id !== user?._id)
                    .slice(0, 3)
                    .map((collaborator) => (
                      <div key={collaborator.user._id} className="relative group/avatar" onClick={(e) => e.stopPropagation()}>
                        <img
                          src={collaborator.user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(collaborator.user.name)}&background=ffffff`}
                          alt={collaborator.user.name}
                          className="w-8 h-8 rounded-full border-2 border-white shadow-md object-cover"
                        />
                        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {collaborator.user.name} • {collaborator.role}
                        </div>
                      </div>
                    ))}
                  
                  {/* Show count of remaining collaborators if more than 3 */}
                  {trip.collaborators
                    .filter(isCollaboratorObject)
                    .filter(collaborator => collaborator.user._id !== user?._id)
                    .length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          +{trip.collaborators
                            .filter(isCollaboratorObject)
                            .filter(collaborator => collaborator.user._id !== user?._id)
                            .length - 3}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}
            
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-indigo-600">
                {trip.title}
              </h3>
              
              {trip.description && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                  {trip.description}
                </p>
              )}
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Dream Trip
                  </span>
                  <span className="text-sm text-gray-500">
                    Target: {new Date(trip.targetDate.year, trip.targetDate.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              {trip.tags && trip.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {trip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}; 