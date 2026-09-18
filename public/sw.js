// Cache-first for static assets and navigations. /api/ is never cached: those
// responses are authenticated and per-user, and a shared cache would serve one
// user's cycle data to the next person on the device.
//
// NOTE: public/ is copied verbatim by Vite and is NOT typechecked. This file
// must stay valid plain JavaScript — a stray `as` cast here makes the browser
// refuse to parse the worker and registration fails silently.
const CACHE = 'pt-v15';

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // Returning early (rather than respondWith(fetch(req))) lets the browser
  // handle /api/ natively, keeping cookies and Set-Cookie untouched.
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
      )
    )
  );
});
