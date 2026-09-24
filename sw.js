const CACHE_NAME = 'pagos-escolares-v3';
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './data.js',
    './supabase.js',
    './manifest.json',
    './icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // CACHE FIRST / STALE-WHILE-REVALIDATE strategy
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Fetch from network in background to update cache
                const fetchPromise = fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed, cache will be used
                    });

                // Return cached response immediately if available
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If no cache, wait for network
                return fetchPromise
                    .then(networkResponse => {
                        if (networkResponse.ok) {
                            return networkResponse;
                        }
                        throw new Error('Network response not ok');
                    })
                    .catch(() => {
                        // If no cache and network failed
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});