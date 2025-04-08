import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DreamTrip } from '../types/dreamTripTypes';
import { EditDreamTripForm } from './EditDreamTripForm';
import { dreamTripService } from '../services/dreamTripService';

// Predefined thumbnails as fallback
const PREDEFINED_THUMBNAILS = {
  beach: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  mountain: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=800',
  city: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  paris: 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=800',
  italy: 'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
  japan: 'https://images.pexels.com/photos/590478/pexels-photo-590478.jpeg?auto=compress&cs=tinysrgb&w=800',
  camping: 'https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg?auto=compress&cs=tinysrgb&w=800',
  ski: 'https://images.pexels.com/photos/848599/pexels-photo-848599.jpeg?auto=compress&cs=tinysrgb&w=800',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=800'
};

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

const getDefaultThumbnail = async (tripName: string): Promise<string> => {
  // Check cache first
  if (thumbnailCache[tripName]) {
    return thumbnailCache[tripName];
  }

  // Check predefined thumbnails
  const lowercaseName = tripName.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[tripName] = url;
      return url;
    }
  }

  try {
    // Remove common words and get keywords from trip name
    const keywords = tripName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => !['trip', 'to', 'in', 'at', 'the', 'a', 'an'].includes(word))
      .join(' ');

    // Try to fetch from Pexels API
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': import.meta.env.VITE_PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Pexels');
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.large2x;
      thumbnailCache[tripName] = imageUrl;
      return imageUrl;
    }
  } catch (error) {
    console.warn('Failed to fetch custom thumbnail:', error);
  }

  // Fallback to default travel image
  return PREDEFINED_THUMBNAILS.default;
};

interface DreamTripCardProps {
  trip: DreamTrip;
  onUpdate: () => void;
}

export const DreamTripCard: React.FC<DreamTripCardProps> = ({ trip, onUpdate }) => {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadThumbnail = async () => {
      if (trip.thumbnailUrl) {
        setThumbnailUrl(trip.thumbnailUrl);
      } else {
        const defaultThumbnail = await getDefaultThumbnail(trip.title);
        setThumbnailUrl(defaultThumbnail);
      }
    };
    loadThumbnail();
  }, [trip.thumbnailUrl, trip.title]);

  const handleDelete = async () => {
    try {
      await dreamTripService.deleteDreamTrip(trip._id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting dream trip:', error);
    }
  };

  return (
    <>
      <div className="bg-white overflow-hidden shadow rounded-lg relative group">
        {/* Clickable card that navigates to trip details */}
        <div 
          onClick={() => window.location.href = `/trips/dream/${trip._id}`}
          className="cursor-pointer"
        >
          {/* Image Section */}
          <div className="h-48 w-full relative">
            <img
              src={thumbnailUrl || PREDEFINED_THUMBNAILS.default}
              alt={trip.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = PREDEFINED_THUMBNAILS.default;
              }}
            />
            {/* Dream Trip Badge */}
            <div className="absolute top-2 left-2 z-10">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-600 text-white shadow-sm">
                Dream Trip
              </span>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-4 py-5 sm:p-6 h-[120px]">
            <h3 className="text-2xl font-semibold text-gray-900 group-hover:text-purple-600 transition-colors duration-200">
              {trip.title}
            </h3>
            
            {/* Target Date */}
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Target: {new Date(trip.targetDate.year, trip.targetDate.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </div>

            {/* Description */}
            {trip.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-1 max-w-[calc(100%-3rem)]">
                {trip.description}
              </p>
            )}

            {/* Tags */}
            {trip.tags && trip.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {trip.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 text-xs font-medium text-white bg-purple-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - positioned in bottom right corner */}
        <div className="absolute bottom-3 right-4 z-20 flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEditForm(true);
            }}
            className="p-1.5 rounded-full bg-gray-100 text-purple-600 hover:bg-purple-100 transition-colors shadow-sm"
            title="Edit trip"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteModal(true);
            }}
            className="p-1.5 rounded-full bg-gray-100 text-red-600 hover:bg-red-100 transition-colors shadow-sm"
            title="Delete trip"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <EditDreamTripForm
          trip={trip}
          onClose={() => setShowEditForm(false)}
          onSuccess={onUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Dream Trip</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{trip.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelete();
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 