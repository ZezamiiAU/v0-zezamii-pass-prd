// Zezamii Pass Service Worker v2
// Implements Workbox-style patterns for robust caching

const SW_VERSION = "2.0.0"
const BUILD_TIME = "2024-12-04T00:00:00Z"
const CACHE_PREFIX = "zezamii-pass"

const CACHES = {
  precache: `${CACHE_PREFIX}-precache-v${SW_VERSION}`,
  runtime: `${CACHE_PREFIX}-runtime-v${SW_VERSION}`,
  images: `${CACHE_PREFIX}-images-v${SW_VERSION}`,
  api: `${CACHE_PREFIX}-api-v${SW_VERSION}`,
}

const PRECACHE_ASSETS = [
  { url: "/", revision: SW_VERSION },
  { url: "/offline", revision: SW_VERSION },
  { url: "/icon.svg", revision: "1" },
  { url: "/icon-192.jpg", revision: "1" },
  { url: "/icon-512.jpg", revision: "1" },
  { url: "/apple-touch-icon.jpg", revision: "1" },
  { url: "/zezamii-pass-logo.png", revision: "1" },
  { url: "/api/manifest", revision: SW_VERSION },
]

const BACKGROUND_SYNC_QUEUE = "failed-requests-queue"
const pendingRequests = []

const CACHE_DURATIONS = {
  api: 5 * 60, // 5 minutes for API responses
  images: 30 * 24 * 60 * 60, // 30 days for images
  pages: 24 * 60 * 60, // 24 hours for pages
}

const MAX_CACHE_ENTRIES = {
  runtime: 60,
  images: 100,
  api: 30,
}

// ============================================
// Utility Functions
// ============================================

// Generate cache key with revision for precache
function getPrecacheKey(entry) {
  if (typeof entry === "string") return entry
  return `${entry.url}?__WB_REVISION__=${entry.revision}`
}

// Check if cached response is expired
function isExpired(response, maxAge) {
  if (!response) return true
  const dateHeader = response.headers.get("sw-cache-date")
  if (!dateHeader) return false
  const cacheDate = new Date(dateHeader).getTime()
  const now = Date.now()
  return now - cacheDate > maxAge * 1000
}

// Add cache date header to response
function addCacheHeaders(response) {
  const headers = new Headers(response.headers)
  headers.set("sw-cache-date", new Date().toISOString())
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// Limit cache size using LRU strategy
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    const deleteCount = keys.length - maxEntries
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i])
    }
  }
}

// ============================================
// Install Event
// ============================================
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing version ${SW_VERSION}`)

  event.waitUntil(
    (async () => {
      const precache = await caches.open(CACHES.precache)

      for (const asset of PRECACHE_ASSETS) {
        const url = typeof asset === "string" ? asset : asset.url
        try {
          const response = await fetch(url, { cache: "reload" })
          if (response.ok) {
            const key = getPrecacheKey(asset)
            await precache.put(key, addCacheHeaders(response))
          }
        } catch (err) {
          console.warn(`[SW] Failed to precache ${url}:`, err)
        }
      }

      console.log(`[SW] Precached ${PRECACHE_ASSETS.length} assets`)
    })(),
  )

  // Activate immediately
  self.skipWaiting()
})

// ============================================
// Activate Event
// ============================================
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating version ${SW_VERSION}`)

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      const validCaches = Object.values(CACHES)

      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && !validCaches.includes(name))
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`)
            return caches.delete(name)
          }),
      )

      await processPendingRequests()
    })(),
  )

  // Take control of all pages immediately
  self.clients.claim()
})

// ============================================
// Fetch Event - Strategy Router
// ============================================
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (but queue POST/PUT for background sync if they fail)
  if (request.method !== "GET") {
    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      event.respondWith(handleMutationRequest(request))
    }
    return
  }

  // Skip external resources (Stripe, analytics, etc.)
  if (!url.origin.includes(self.location.origin)) return

  // Route to appropriate caching strategy
  if (url.pathname.startsWith("/api/")) {
    if (isCacheableApi(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, CACHES.api, CACHE_DURATIONS.api))
    } else {
      // Non-cacheable API routes go straight to network
      event.respondWith(networkOnly(request))
    }
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, CACHES.images, CACHE_DURATIONS.images))
  } else if (isPrecached(url.pathname)) {
    event.respondWith(precacheFirst(request))
  } else {
    event.respondWith(networkFirst(request, CACHES.runtime, CACHE_DURATIONS.pages))
  }
})

// ============================================
// Caching Strategies
// ============================================

// Network only - for sensitive API calls
async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch (err) {
    if (request.mode === "navigate") {
      return caches.match("/offline")
    }
    throw err
  }
}

// Cache first - for images and static assets
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, addCacheHeaders(networkResponse.clone()))
      await trimCache(cacheName, MAX_CACHE_ENTRIES.images)
    }
    return networkResponse
  } catch (err) {
    if (cachedResponse) return cachedResponse
    throw err
  }
}

// Network first - for HTML pages
async function networkFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName)

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, addCacheHeaders(networkResponse.clone()))
      await trimCache(cacheName, MAX_CACHE_ENTRIES.runtime)
    }
    return networkResponse
  } catch (err) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse

    // Fallback to offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline")
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    })
  }
}

// Stale while revalidate - for API responses
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  // Start network fetch in background
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, addCacheHeaders(response.clone()))
        await trimCache(cacheName, MAX_CACHE_ENTRIES.api)
      }
      return response
    })
    .catch(() => null)

  // Return cached response immediately if available and fresh
  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    return cachedResponse
  }

  // Wait for network if no cached response
  const networkResponse = await networkPromise
  if (networkResponse) return networkResponse
  if (cachedResponse) return cachedResponse

  return new Response(JSON.stringify({ error: "Offline" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  })
}

// Precache first - for precached assets
async function precacheFirst(request) {
  const url = new URL(request.url)
  const precache = await caches.open(CACHES.precache)

  // Try to find matching precached entry
  const asset = PRECACHE_ASSETS.find((a) => {
    const assetUrl = typeof a === "string" ? a : a.url
    return assetUrl === url.pathname
  })

  if (asset) {
    const key = getPrecacheKey(asset)
    const cachedResponse = await precache.match(key)
    if (cachedResponse) return cachedResponse
  }

  // Fallback to direct match or network
  const directMatch = await precache.match(request)
  if (directMatch) return directMatch

  return networkFirst(request, CACHES.runtime, CACHE_DURATIONS.pages)
}

// ============================================
// Background Sync for Mutations
// ============================================

async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone())
    return response
  } catch (err) {
    if ("sync" in self.registration) {
      await queueRequest(request)
      await self.registration.sync.register(BACKGROUND_SYNC_QUEUE)

      return new Response(
        JSON.stringify({
          queued: true,
          message: "Request queued for sync when online",
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
    throw err
  }
}

async function queueRequest(request) {
  const serialized = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  }
  pendingRequests.push(serialized)
}

async function processPendingRequests() {
  const requests = [...pendingRequests]
  pendingRequests.length = 0

  for (const req of requests) {
    try {
      await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body || undefined,
      })
      console.log(`[SW] Synced queued request: ${req.method} ${req.url}`)
    } catch (err) {
      console.warn(`[SW] Failed to sync request: ${req.url}`, err)
      // Re-queue if still failing
      pendingRequests.push(req)
    }
  }
}

// Background sync event
self.addEventListener("sync", (event) => {
  if (event.tag === BACKGROUND_SYNC_QUEUE) {
    event.waitUntil(processPendingRequests())
  }
})

// ============================================
// Helper Functions
// ============================================

function isCacheableApi(pathname) {
  const cacheablePatterns = [/^\/api\/manifest$/, /^\/api\/accesspoints\/resolve\//, /^\/api\/pass-types\//]
  return cacheablePatterns.some((pattern) => pattern.test(pathname))
}

function isImageRequest(request) {
  const url = new URL(request.url)
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico"]
  return imageExtensions.some((ext) => url.pathname.toLowerCase().endsWith(ext))
}

function isPrecached(pathname) {
  return PRECACHE_ASSETS.some((asset) => {
    const url = typeof asset === "string" ? asset : asset.url
    return url === pathname
  })
}

// ============================================
// Message Handler
// ============================================
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting()
  }

  if (event.data === "clearCache") {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))))
  }

  if (event.data === "getVersion") {
    event.ports[0]?.postMessage({
      version: SW_VERSION,
      buildTime: BUILD_TIME,
    })
  }
})

// ============================================
// Push Notifications (placeholder for future)
// ============================================
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.jpg",
    badge: "/icon-192.jpg",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
  }

  event.waitUntil(self.registration.showNotification(data.title || "Zezamii Pass", options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url === url && "focus" in client) {
          return client.focus()
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url)
    }),
  )
})

console.log(`[SW] Service Worker v${SW_VERSION} loaded`)
