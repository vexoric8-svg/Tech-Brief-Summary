/* Service worker: makes the app installable + usable offline.
   - App shell (html/css/js/icons): cache-first.
   - news.json: network-first, falling back to the last cached copy offline. */

const CACHE = 'tech-brief-v1';
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
