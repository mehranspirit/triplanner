import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { AISuggestionHistory } from '@/types/eventTypes';
import { AISuggestionsHistory } from './AISuggestionsHistory';

interface AISuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripDates: {
    startDate: string;
    endDate: string;
  };
  onSubmit: (places: string[], activities: string[]) => Promise<void>;
  history: AISuggestionHistory[];
  onSelectHistoryItem: (suggestion: AISuggestionHistory) => void;
}

export const AISuggestionsModal: React.FC<AISuggestionsModalProps> = ({
  isOpen,
  onClose,
  tripDates,
  onSubmit,
  history,
  onSelectHistoryItem,
}) => {
  const [places, setPlaces] = useState<string[]>(['']);
  const [activities, setActivities] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset history modal state when main modal opens
  useEffect(() => {
    if (isOpen) {
      setShowHistory(false);
    }
  }, [isOpen]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setError('Request cancelled');
    }
  };

  const handleAddPlace = () => {
    setPlaces([...places, '']);
  };

  const handleAddActivity = () => {
    setActivities([...activities, '']);
  };

  const handlePlaceChange = (index: number, value: string) => {
    const newPlaces = [...places];
    newPlaces[index] = value;
    setPlaces(newPlaces);
  };

  const handleActivityChange = (index: number, value: string) => {
    const newActivities = [...activities];
    newActivities[index] = value;
    setActivities(newActivities);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const filteredPlaces = places.filter(place => place.trim() !== '');
      const filteredActivities = activities.filter(activity => activity.trim() !== '');
      
      if (filteredPlaces.length === 0 || filteredActivities.length === 0) {
        throw new Error('Please add at least one place and one activity type');
      }

      await onSubmit(filteredPlaces, filteredActivities);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl relative">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Get AI Travel Suggestions
            </Dialog.Title>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHistory(true);
                }}
                className="text-gray-400 hover:text-gray-500"
                title="View Previous Suggestions"
                disabled={isLoading}
              >
                <ClockIcon className="h-6 w-6" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
                disabled={isLoading}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Places You Want to Visit
              </label>
              <div className="space-y-2">
                {places.map((place, index) => (
                  <input
                    key={index}
                    type="text"
                    value={place}
                    onChange={(e) => handlePlaceChange(index, e.target.value)}
                    placeholder="Enter a place (e.g., Paris, Tokyo)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoading}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleAddPlace}
                  className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                  disabled={isLoading}
                >
                  + Add Another Place
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Types of Activities You're Interested In
              </label>
              <div className="space-y-2">
                {activities.map((activity, index) => (
                  <input
                    key={index}
                    type="text"
                    value={activity}
                    onChange={(e) => handleActivityChange(index, e.target.value)}
                    placeholder="Enter an activity type (e.g., Museums, Hiking)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoading}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleAddActivity}
                  className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                  disabled={isLoading}
                >
                  + Add Another Activity
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 relative group"
              >
                {isLoading ? (
                  <>
                    <span className="opacity-0">Get Suggestions</span>
                    <ArrowPathIcon className="h-5 w-5 absolute inset-0 mx-auto animate-spin" />
                  </>
                ) : (
                  'Get Suggestions'
                )}
              </button>
            </div>
          </form>

          {isLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-4">Generating AI suggestions...</p>
                <button
                  onClick={handleCancelRequest}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          <AISuggestionsHistory
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            history={history}
            onSelectSuggestion={(suggestion) => {
              onSelectHistoryItem(suggestion);
              setShowHistory(false);
            }}
          />
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}; 