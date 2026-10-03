const CACHE_NAME = 'gym-bro-cache-v1';
const ASSETS = [
  '../../index.html',
  '../css/styles.css',
  './app.js',
  '../../data/exercises.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
