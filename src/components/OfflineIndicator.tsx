import React, { useState, useEffect } from 'react';
import { WifiIcon, CloudArrowUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { networkAwareApi } from '../services/networkAwareApi';

interface StorageInfo {
  used: number;
  quota: number;
  pendingSync: number;
}

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const checkPendingSync = async () => {
      try {
        const pending = await networkAwareApi.hasPendingSync();
        setHasPendingSync(pending);
        
        const storage = await networkAwareApi.getStorageInfo();
        setStorageInfo(storage);
      } catch (error) {
        console.error('Failed to check pending sync:', error);
      }
    };

    // Set up event listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check pending sync periodically
    checkPendingSync();
    const interval = setInterval(checkPendingSync, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  const handleForceSync = async () => {
    if (isOnline) {
      try {
        await networkAwareApi.forcSync();
        setHasPendingSync(false);
      } catch (error) {
        console.error('Force sync failed:', error);
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Don't show anything if online and no pending sync
  if (isOnline && !hasPendingSync) {
    return null;
  }

  return (
    <div className="relative">
      {/* Main Indicator */}
      <div
        className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
          !isOnline
            ? 'bg-red-100 border border-red-300 text-red-800'
            : hasPendingSync
            ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
            : 'bg-green-100 border border-green-300 text-green-800'
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {!isOnline ? (
          <>
            <WifiIcon className="h-5 w-5" />
            <span className="font-medium">You're offline</span>
          </>
        ) : hasPendingSync ? (
          <>
            <CloudArrowUpIcon className="h-5 w-5" />
            <span className="font-medium">
              {storageInfo?.pendingSync || 0} changes to sync
            </span>
          </>
        ) : (
          <>
            <CloudArrowUpIcon className="h-5 w-5 text-green-600" />
            <span className="font-medium">All synced</span>
          </>
        )}
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div className="fixed top-16 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Offline Status</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Network Status */}
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isOnline ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-700">
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* Pending Sync Info */}
            {hasPendingSync && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    {storageInfo?.pendingSync || 0} operations pending sync
                  </span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Changes will automatically sync when you're back online
                </p>
                {isOnline && (
                  <button
                    onClick={handleForceSync}
                    className="mt-2 text-xs bg-yellow-600 text-white px-3 py-1 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Sync Now
                  </button>
                )}
              </div>
            )}

            {/* Storage Info */}
            {storageInfo && (
              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Storage Usage
                </h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Used:</span>
                    <span>{formatBytes(storageInfo.used)}</span>
                  </div>
                  {storageInfo.quota > 0 && (
                    <div className="flex justify-between">
                      <span>Available:</span>
                      <span>{formatBytes(storageInfo.quota)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Pending operations:</span>
                    <span>{storageInfo.pendingSync}</span>
                  </div>
                </div>
                
                {/* Storage Progress Bar */}
                {storageInfo.quota > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (storageInfo.used / storageInfo.quota) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {(
                        (storageInfo.used / storageInfo.quota) * 100
                      ).toFixed(1)}% used
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Offline Features Info */}
            {!isOnline && (
              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Available Offline
                </h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• View and edit trips</li>
                  <li>• Add and manage events</li>
                  <li>• Full expense management (add/edit/delete)</li>
                  <li>• Settlement tracking & debt simplification</li>
                  <li>• Expense settlements & participant management</li>
                  <li>• Edit trip notes</li>
                  <li>• Manage shared & personal checklists</li>
                  <li>• View all cached data</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Changes will sync automatically when you reconnect
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 