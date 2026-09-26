const CACHE_NAME = "gamish777-admin-v7";
const ADMIN_SHELL = [
  "/admin",
  "/admin.css?v=7",
  "/admin.js?v=7",
  "/admin.webmanifest",
  "/admin-favicon-32.png",
  "/admin-icon-192.png",
  "/admin-icon-512.png",
  "/admin-icon-maskable-192.png",
  "/admin-icon-maskable-512.png",
  "/admin-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ADMIN_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("gamish777-admin-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/admin")))
  );
});
