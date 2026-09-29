// Lembar · service worker (offline penuh)
// File ini dibuat otomatis oleh tools-build-sw.py dari sw.template.js.
const VERSION = 'lembar-b6e8c87f46';
const FONT_CACHE = 'lembar-fonts-v1';
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/boot.js",
  "js/collection.js",
  "js/components.js",
  "js/crypto.js",
  "js/data.js",
  "js/db.js",
  "js/i18n.js",
  "js/icons.js",
  "js/lang-en.js",
  "js/main.js",
  "js/media.js",
  "js/pickers.js",
  "js/reminders.js",
  "js/router.js",
  "js/sanitize.js",
  "js/share.js",
  "js/store.js",
  "js/theme.js",
  "js/ui.js",
  "js/views/archive.js",
  "js/views/backup.js",
  "js/views/books.js",
  "js/views/calendar.js",
  "js/views/cards.js",
  "js/views/editor.js",
  "js/views/help.js",
  "js/views/home.js",
  "js/views/lock.js",
  "js/views/onboarding.js",
  "js/views/pickers.js",
  "js/views/reminders.js",
  "js/views/search.js",
  "js/views/settings.js",
  "js/views/shell.js",
  "js/views/sketch.js",
  "js/views/stats.js",
  "js/views/tags.js",
  "js/views/templates.js",
  "js/lib/create.js",
  "js/lib/image.js",
  "js/lib/recorder.js",
  "js/lib/reminders.js",
  "js/lib/share.js",
  "js/lib/templates.js",
  "js/lib/zip.js",
  "js/lang/en.js",
  "icons/apple-touch-icon.png",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/sc-check.png",
  "icons/sc-journal.png",
  "icons/sc-new.png"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('lembar-') && k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: simpan agar tetap tampil saat offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigasi: selalu sajikan shell aplikasi dari cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const shell = await cache.match('index.html', { ignoreSearch: true });
      if (shell) return shell;
      try { return await fetch(req); } catch (e) { return new Response('Offline', { status: 503 }); }
    })());
    return;
  }

  // Aset: cache dulu, lalu jaringan
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.id;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if (id) c.postMessage({ type: 'open-note', id }); return; }
    }
    await self.clients.openWindow('./' + (id ? '#/note/' + id : ''));
  })());
});
