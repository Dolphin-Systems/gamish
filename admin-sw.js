const CACHE_NAME = "gamish777-admin-v21";
const ADMIN_SHELL = [
  "/admin.html",
  "/admin.css?v=20",
  "/admin.js?v=21",
  "/chat-images.js?v=1",
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
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/admin.html")))
  );
});

// Chat alerts: a player wrote in. Tapping the alert opens that conversation.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const playerId = data.playerId || "";
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title ? `💬 ${data.title}` : "💬 New player message", {
      body: data.body || "New message",
      icon: "/admin-icon-192.png",
      tag: playerId ? `chat-${playerId}` : "chat",
      renotify: true,
      data: { url: data.url || "/admin.html", playerId },
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => windows.forEach((client) => client.postMessage({ type: "chat-push", playerId }))),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url = "/admin.html", playerId = "" } = event.notification.data || {};
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => new URL(client.url).pathname.startsWith("/admin"));
    if (open) {
      open.postMessage({ type: "open-chat", playerId });
      return open.focus();
    }
    return self.clients.openWindow(url);
  }));
});
