import { useState, useEffect } from 'react';

export interface OfflineRefreshState {
  isOfflineRefresh: boolean;
  hasServedFromCache: boolean;
  showOfflineIndicator: boolean;
  cacheAge: number | null;
}

export const useOfflineRefresh = () => {
  const [state, setState] = useState<OfflineRefreshState>({
    isOfflineRefresh: false,
    hasServedFromCache: false,
    showOfflineIndicator: false,
    cacheAge: null,
  });

  useEffect(() => {
    // Check if we're offline and if the page was served from cache
    const checkOfflineRefresh = () => {
      const isOffline = !navigator.onLine;
      
      // Check if service worker is active and serving from cache
      const checkServiceWorkerCache = async () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          try {
            // Check if the current page was served from cache
            const cache = await caches.open('triplanner-static-v1');
            const cachedResponse = await cache.match(window.location.pathname);
            
            if (cachedResponse) {
              const cacheDate = cachedResponse.headers.get('date');
              const cacheAge = cacheDate ? Date.now() - new Date(cacheDate).getTime() : null;
              
              setState(prev => ({
                ...prev,
                hasServedFromCache: true,
                cacheAge,
                isOfflineRefresh: isOffline,
                showOfflineIndicator: isOffline
              }));
            }
          } catch (error) {
            console.error('Error checking cache:', error);
          }
        }
      };

      // Check for offline refresh indicators
      const performance = window.performance;
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigationEntry) {
        const isRefresh = navigationEntry.type === 'reload';
        
        if (isRefresh && isOffline) {
          setState(prev => ({
            ...prev,
            isOfflineRefresh: true,
            showOfflineIndicator: true
          }));
        }
      }

      checkServiceWorkerCache();
    };

    checkOfflineRefresh();

    // Listen for online/offline events
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        isOfflineRefresh: false,
        showOfflineIndicator: false
      }));
      
      // Trigger background refresh when coming back online
      window.dispatchEvent(new CustomEvent('connectionRestored'));
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        showOfflineIndicator: true
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissOfflineIndicator = () => {
    setState(prev => ({
      ...prev,
      showOfflineIndicator: false
    }));
  };

  const formatCacheAge = (ageMs: number | null): string => {
    if (!ageMs) return 'Unknown';
    
    const minutes = Math.floor(ageMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return {
    ...state,
    dismissOfflineIndicator,
    formatCacheAge: (ageMs: number | null) => formatCacheAge(ageMs),
  };
}; 