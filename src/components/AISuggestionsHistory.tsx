import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AISuggestionHistory } from '@/types/eventTypes';

interface AISuggestionsHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  history: AISuggestionHistory[];
  onSelectSuggestion: (suggestion: AISuggestionHistory) => void;
}

export const AISuggestionsHistory: React.FC<AISuggestionsHistoryProps> = ({
  isOpen,
  onClose,
  history,
  onSelectSuggestion,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                Previous AI Suggestions
              </h3>
              
              <div className="space-y-4">
                {history.map((item) => (
                  <div
                    key={item._id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => onSelectSuggestion(item)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                        <p className="font-medium text-gray-900">
                          Places: {item.places.join(', ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          Activities: {item.activities.join(', ')}
                        </p>
                      </div>
                      <button
                        className="text-indigo-600 hover:text-indigo-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSuggestion(item);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
                
                {history.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No previous suggestions found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 