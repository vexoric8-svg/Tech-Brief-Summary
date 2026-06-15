/* Service worker: makes the app installable + usable offline.
   - App shell (html/css/js/icons): cache-first.
   - news.json: network-first, falling back to the last cached copy offline. */

const CACHE = 'tech-brief-v2';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isData = url.pathname.endsWith('/news.json') || url.pathname.endsWith('news.json');

  if (isData) {
    // network-first so fresh morning pushes win; cache as fallback
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./news.json', copy));
          return res;
        })
        .catch(() => caches.match('./news.json'))
    );
    return;
  }

  // shell: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Show a notification when a push arrives
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || 'Morning Tech Brief';
  const options = {
    body: data.body || 'A new briefing is ready.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'daily-brief',
    renotify: true,
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Open / focus the app when the notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    })
  );
});
