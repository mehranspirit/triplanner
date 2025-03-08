import React, { useState } from 'react';
import { api } from '../services/api';
import { Trip } from '../types';

interface ShareModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTrip: Trip) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  trip,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTogglePublic = async () => {
    setLoading(true);
    try {
      const updatedTrip = await api.updateTrip({
        ...trip,
        isPublic: !trip.isPublic,
      });
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip visibility');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      const { shareableLink } = await api.generateShareLink(trip.id);
      onUpdate({ ...trip, shareableLink });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    setLoading(true);
    try {
      await api.revokeShareLink(trip.id);
      onUpdate({ ...trip, shareableLink: undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (trip.shareableLink) {
      try {
        await navigator.clipboard.writeText(trip.shareableLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        setError('Failed to copy link to clipboard');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Share Trip</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Trip Visibility</h4>
              <p className="text-sm text-gray-500">
                {trip.isPublic
                  ? 'Anyone with the link can view this trip'
                  : 'Only collaborators can view this trip'}
              </p>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={loading}
              className={`${
                trip.isPublic ? 'bg-indigo-600' : 'bg-gray-200'
              } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              <span className="sr-only">Toggle public access</span>
              <span
                className={`${
                  trip.isPublic ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
              />
            </button>
          </div>

          {/* Shareable Link */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Shareable Link</h4>
            {trip.shareableLink ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={trip.shareableLink}
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleRevokeLink}
                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Revoke
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Generate Link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal; 