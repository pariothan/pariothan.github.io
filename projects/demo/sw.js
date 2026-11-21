// Serves the unlocked demo's files from the browser's cache. Nothing here is fetched from the network.
const PREFIX = 'private-demo-';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  const base = new URL('./app/', self.registration.scope);
  if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) return;
  e.respondWith((async () => {
    const want = u.origin + (u.pathname === base.pathname ? base.pathname + 'index.html' : u.pathname);
    for (const name of await caches.keys()) {
      if (!name.startsWith(PREFIX)) continue;
      const hit = await (await caches.open(name)).match(want);
      if (!hit) continue;
      const range = /^bytes=(\d+)-(\d*)$/.exec(e.request.headers.get('range') || '');
      if (!range) return hit;
      // media elements ask for byte ranges
      const all = await hit.blob(), from = Number(range[1]), to = range[2] ? Math.min(Number(range[2]), all.size - 1) : all.size - 1;
      return new Response(all.slice(from, to + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || '', 'Content-Range': `bytes ${from}-${to}/${all.size}`, 'Accept-Ranges': 'bytes' } });
    }
    // not unlocked on this device: back to the door
    return Response.redirect(self.registration.scope, 302);
  })());
});
