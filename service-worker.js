// ============================================================
// Service Worker für Klassen-Dobble (Offline-Fähigkeit)
//
// WICHTIG BEI UPDATES: Wenn du index.html, style.css o.ä. änderst,
// erhöhe die Versionsnummer unten (v1 -> v2 -> ...). Sonst laden
// die iPads weiterhin die alte, gecachte Version und merken nichts
// von der Änderung - das ist die klassische Service-Worker-Falle.
// ============================================================
const CACHE_VERSION = 'v1';
const CACHE_NAME = `klassen-dobble-${CACHE_VERSION}`;

const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Installation: App-Shell cachen. Promise.allSettled statt cache.addAll,
// damit ein einzelner fehlender Eintrag (z.B. Icon noch nicht vorhanden)
// nicht die komplette Installation zum Absturz bringt.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled(
                APP_SHELL.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('Konnte nicht gecacht werden:', url, err);
                    })
                )
            )
        ).then(() => self.skipWaiting())
    );
});

// Aktivierung: alte Cache-Versionen aufräumen
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key.startsWith('klassen-dobble-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Abrufstrategie: Cache-First mit Netzwerk-Fallback, und bei Offline-Navigation
// (z.B. App-Start ohne Internet) Rückfall auf die gecachte index.html.
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});
