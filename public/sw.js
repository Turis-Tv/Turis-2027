const CACHE = "turis-tv-shell-v3";
const SHELL = ["/manifest.webmanifest", "/icons/turis-tv-192.png", "/icons/turis-tv-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Nooit HTML, streams, tokens of PIN cachen. Zo blijft een nieuwe deployment
  // onmiddellijk zichtbaar en kan geen oude look vastplakken.
  if (url.pathname.startsWith("/api/") || request.mode === "navigate") return;

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
    )
  );
});
