self.addEventListener('install', (e) => (e as any).waitUntil((self as any).skipWaiting()));
self.addEventListener('activate', (e) => (e as any).waitUntil((self as any).clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = (e as any).request;
  if (req.method !== 'GET' || !req.url.startsWith((self as any).location.origin)) return;
  (e as any).respondWith(
    caches.open('pt-v1').then((c) =>
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
