import React from 'react';
import { Link } from 'react-router-dom';
import { DreamTrip } from '../types/dreamTripTypes';

interface DreamTripListProps {
  trips: DreamTrip[];
}

export const DreamTripList: React.FC<DreamTripListProps> = ({ trips }) => {
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
              <div className="aspect-w-16 aspect-h-9">
                <img
                  src={trip.thumbnailUrl}
                  alt={trip.title}
                  className="object-cover w-full h-full"
                />
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
                
                <div className="flex items-center space-x-2">
                  {trip.collaborators.length > 0 && (
                    <div className="flex -space-x-2">
                      {trip.collaborators.slice(0, 3).map((collaborator, index) => (
                        <div
                          key={index}
                          className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                        >
                          <span className="text-xs font-medium text-gray-600">
                            {typeof collaborator === 'string' ? '?' : collaborator.user.name[0]}
                          </span>
                        </div>
                      ))}
                      {trip.collaborators.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            +{trip.collaborators.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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