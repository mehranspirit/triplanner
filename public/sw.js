const CACHE_NAME = 'triplanner-v1';
const STATIC_CACHE_NAME = 'triplanner-static-v1';
const API_CACHE_NAME = 'triplanner-api-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  // Add other critical assets as needed
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  '/api/auth/profile',
  '/api/trips',
  '/api/trips/.*/expenses',
  '/api/trips/.*/notes',
  '/api/trips/.*/checklist',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('❌ Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - handle requests with offline-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  }
});

// Check if request is for static assets
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/static/') || 
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.ico');
}

// Check if request is for API
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

// Check if request is navigation (page load)
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving static asset from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('🌐 Fetching static asset from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Failed to serve static asset:', request.url, error);
    
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback
    return new Response('Offline', { status: 503 });
  }
}

// Handle API requests with network-first strategy (for fresh data)
async function handleAPIRequest(request) {
  try {
    console.log('🌐 API request:', request.method, request.url);
    
    // Try network first for API requests (to get fresh data)
    const networkResponse = await fetch(request.clone());
    
    // Cache successful GET requests
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('📦 Cached API response:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📡 Network failed for API request, checking cache:', request.url);
    
    // Only serve cached GET requests when offline
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('📦 Serving API response from cache:', request.url);
        // Add header to indicate cached response
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Served-From', 'cache');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        });
      }
    }
    
    // Return offline response for failed requests
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'No network connection available',
      timestamp: Date.now()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle navigation requests (page loads) with app shell strategy
async function handleNavigation(request) {
  try {
    console.log('🧭 Navigation request:', request.url);
    
    // Try network first for fresh content
    const networkResponse = await fetch(request);
    
    // Cache successful navigation responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📡 Network failed for navigation, serving cached version');
    
    // Serve cached version or app shell
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to cached index.html (app shell)
    const appShell = await caches.match('/');
    if (appShell) {
      return appShell;
    }
    
    // Final fallback
    return new Response('App offline - please refresh when connected', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'CACHE_URLS':
        // Allow app to request caching of specific URLs
        if (event.data.urls) {
          cacheUrls(event.data.urls);
        }
        break;
      case 'CLEAR_CACHE':
        clearAllCaches();
        break;
    }
  }
});

// Helper function to cache specific URLs
async function cacheUrls(urls) {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    await cache.addAll(urls);
    console.log('📦 Cached requested URLs:', urls);
  } catch (error) {
    console.error('❌ Failed to cache URLs:', error);
  }
}

// Helper function to clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('🗑️ All caches cleared');
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
} 