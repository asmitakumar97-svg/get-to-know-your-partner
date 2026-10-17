const CACHE_PREFIX = `partner-playground-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const root = new URL('./', self.registration.scope);
    const response = await fetch(root, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the offline playroom.');
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)]
      .map(match => new URL(match[1], root).href);
    await cache.put(root, new Response(html, { headers: { 'Content-Type': 'text/html' } }));
    await cache.addAll([...assets, new URL('floral-tile.svg', root).href]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        return await fetch(event.request, { signal: controller.signal });
      } catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(new URL('./', self.registration.scope));
        return cached ?? Response.error();
      } finally {
        clearTimeout(timeout);
      }
    })());
  } else {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, { ignoreVary: true })).then(cached => cached ?? fetch(event.request)));
  }
});
