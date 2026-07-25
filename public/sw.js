// MoniPay Service Worker - PWA + Offline + Notifications
const CACHE_NAME = 'monipay-v2';
const OFFLINE_CACHE = 'monipay-offline-v1';

// Core app shell to cache for offline
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

// API patterns to cache for offline receipt viewing
const CACHEABLE_API_PATTERNS = [
  '/functions/v1/orders',
  '/functions/v1/invoices',
  '/functions/v1/products',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first with offline fallback strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Cache API responses for offline receipt/transaction viewing
  const isCacheableApi = CACHEABLE_API_PATTERNS.some((p) => url.pathname.includes(p));

  if (isCacheableApi) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Return cached version when offline
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: 'offline', message: 'You are offline. Showing cached data.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // For navigation requests, try network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || caches.match(request))
    );
    return;
  }

  // For app shell assets, cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache static assets
        if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Handle notification clicks - deep link to relevant screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  if (data.type === 'payment_received' || data.type === 'deposit') {
    url = '/?screen=dashboard';
  } else if (data.type === 'invoice_received' || data.type === 'invoice_paid') {
    url = '/?screen=dashboard&tab=invoices';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Handle push notifications (for future server-sent push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'MoniPay', {
        body: payload.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: payload.data || {},
        tag: payload.tag || 'monipay',
      })
    );
  } catch (e) {
    // Fallback for text payloads
    event.waitUntil(
      self.registration.showNotification('MoniPay', {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
      })
    );
  }
});
