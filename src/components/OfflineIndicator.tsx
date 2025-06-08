import React, { useState, useEffect } from 'react';
import { networkAwareApi } from '../services/networkAwareApi';

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial sync status
    loadSyncStatus();

    // Update sync status periodically
    const interval = setInterval(loadSyncStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const hasPending = await networkAwareApi.hasPendingSync();
      const info = await networkAwareApi.getStorageInfo();
      setPendingSyncCount(info.pendingSync);
      setStorageInfo({ used: info.used, quota: info.quota });
    } catch (error) {
      console.warn('Failed to load sync status:', error);
    }
  };

  const handleForceSync = async () => {
    try {
      await networkAwareApi.forcSync();
      await loadSyncStatus();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isOnline && pendingSyncCount === 0) {
    return null; // Don't show indicator when online and no pending syncs
  }

  return (
    <div className={`fixed top-4 right-4 z-[9999] ${className}`}>
      <div 
        className={`
          backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-2xl
          transition-all duration-300 ease-in-out cursor-pointer
          ${isExpanded ? 'w-80 p-4' : 'w-auto px-4 py-2'}
          hover:bg-white/15 hover:scale-105
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Compact View */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="relative flex items-center">
            <div 
              className={`
                w-3 h-3 rounded-full transition-all duration-300
                ${isOnline 
                  ? 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-lg shadow-blue-500/50' 
                  : 'bg-gradient-to-r from-red-400 to-red-600 shadow-lg shadow-red-500/50'
                }
              `}
            >
              {/* Pulse animation for offline */}
              {!isOnline && (
                <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-75"></div>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="flex flex-col">
            <span className="text-gray-800 font-medium text-sm leading-tight">
              {isOnline ? 'Syncing...' : 'Offline Mode'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="text-gray-600 text-xs leading-tight">
                {pendingSyncCount} pending
              </span>
            )}
          </div>

          {/* Expand Icon */}
          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg 
              className="w-4 h-4 text-gray-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 space-y-3 border-t border-white/20 pt-3">
            {/* Capabilities */}
            <div className="space-y-2">
              <h4 className="text-gray-800 font-semibold text-sm">Available Features:</h4>
              <div className="grid grid-cols-1 gap-1 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Full expense management</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Settlement tracking & debt optimization</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Notes & checklists collaboration</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Event planning & management</span>
                </div>
              </div>
            </div>

            {/* Storage Info */}
            {storageInfo && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-700">
                  <span>Storage Used:</span>
                  <span>{formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-1.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((storageInfo.used / storageInfo.quota) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Sync Controls */}
            {isOnline && pendingSyncCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleForceSync();
                }}
                className="
                  w-full bg-gradient-to-r from-blue-500 to-purple-600 
                  text-white text-xs font-medium py-2 px-3 rounded-lg
                  hover:from-blue-600 hover:to-purple-700 
                  transition-all duration-200 transform hover:scale-105
                  shadow-lg hover:shadow-xl
                "
              >
                Sync Now ({pendingSyncCount} items)
              </button>
            )}

            {/* Offline Message */}
            {!isOnline && (
              <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-amber-800 text-xs font-medium">You're working offline</p>
                    <p className="text-amber-700 text-xs mt-1">
                      Changes will sync automatically when you're back online.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 