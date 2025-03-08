import React, { useState } from 'react';
import { Trip } from '../types';
import { api } from '../services/api';

interface ShareModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (trip: Trip) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ trip, isOpen, onClose, onUpdate }) => {
  const [error, setError] = useState('');
  const [shareLink, setShareLink] = useState(trip.shareableLink || '');

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    try {
      const result = await api.generateShareLink(trip.id);
      const updatedTrip = { ...trip, shareableLink: result.shareableLink };
      setShareLink(result.shareableLink);
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    }
  };

  const handleRevokeLink = async () => {
    try {
      await api.revokeShareLink(trip.id);
      const updatedTrip = { ...trip, shareableLink: undefined };
      setShareLink('');
      onUpdate(updatedTrip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Share Trip</h3>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Shareable Link</label>
          {shareLink ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="input flex-1"
              />
              <button
                onClick={handleCopyLink}
                className="btn btn-secondary whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateLink}
              className="btn btn-primary w-full"
            >
              Generate Link
            </button>
          )}
        </div>

        {shareLink && (
          <div className="mb-6">
            <button
              onClick={handleRevokeLink}
              className="text-red-600 hover:text-red-800"
            >
              Revoke Link
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal; 