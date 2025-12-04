// Serve service worker with correct MIME type
// This ensures the SW is served as JavaScript even in preview environments

import { NextResponse } from "next/server"

const SW_VERSION = "2.0.1"
const BUILD_TIME = new Date().toISOString()

export async function GET() {
  const serviceWorkerCode = `
// Zezamii Pass Service Worker v${SW_VERSION}
// Built: ${BUILD_TIME}

const SW_VERSION = "${SW_VERSION}";
const BUILD_TIME = "${BUILD_TIME}";
const CACHE_PREFIX = "zezamii-pass";

const CACHES = {
  precache: CACHE_PREFIX + "-precache-v" + SW_VERSION,
  runtime: CACHE_PREFIX + "-runtime-v" + SW_VERSION,
  images: CACHE_PREFIX + "-images-v" + SW_VERSION,
  api: CACHE_PREFIX + "-api-v" + SW_VERSION,
};

const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/icon.svg",
  "/icon-192.jpg",
  "/icon-512.jpg",
  "/apple-touch-icon.jpg",
  "/zezamii-pass-logo.png",
];

// Install
self.addEventListener("install", function(event) {
  console.log("[SW] Installing version " + SW_VERSION);
  event.waitUntil(
    caches.open(CACHES.precache).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function(err) {
        console.warn("[SW] Precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", function(event) {
  console.log("[SW] Activating version " + SW_VERSION);
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      var validCaches = Object.values(CACHES);
      return Promise.all(
        cacheNames
          .filter(function(name) {
            return name.startsWith(CACHE_PREFIX) && validCaches.indexOf(name) === -1;
          })
          .map(function(name) {
            console.log("[SW] Deleting old cache: " + name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", function(event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") && url.pathname !== "/api/manifest") return;

  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      var fetchPromise = fetch(request).then(function(networkResponse) {
        if (networkResponse.ok && !url.pathname.startsWith("/api/")) {
          caches.open(CACHES.runtime).then(function(cache) {
            cache.put(request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(function() {
        if (request.mode === "navigate") {
          return caches.match("/offline");
        }
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Message handler
self.addEventListener("message", function(event) {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});

console.log("[SW] Service Worker v" + SW_VERSION + " loaded");
`

  return new NextResponse(serviceWorkerCode, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  })
}
