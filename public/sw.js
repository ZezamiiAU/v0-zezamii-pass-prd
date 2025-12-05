// Zezamii Pass Service Worker v2.0.0
const SW_VERSION = "2.0.0"
const CACHE_NAME = `zezamii-pass-v${SW_VERSION}`

const CACHE_STRATEGIES = {
  NETWORK_FIRST: "network-first",
  CACHE_FIRST: "cache-first",
  STALE_WHILE_REVALIDATE: "stale-while-revalidate",
}

// Assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/icon.svg",
  "/icon-192.jpg",
  "/icon-512.jpg",
  "/apple-touch-icon.jpg",
  "/zezamii-pass-logo.png",
]

const ROUTE_STRATEGIES = [
  { pattern: /^\/api\//, strategy: null }, // Never cache API routes
  { pattern: /\.(js|css)$/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
  { pattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/, strategy: CACHE_STRATEGIES.CACHE_FIRST },
  { pattern: /\.(woff|woff2|ttf|otf)$/, strategy: CACHE_STRATEGIES.CACHE_FIRST },
  { pattern: /.*/, strategy: CACHE_STRATEGIES.NETWORK_FIRST }, // Default
]

function log(message, ...args) {
  console.log(`[SW] ${message}`, ...args)
}

function getStrategy(url) {
  for (const route of ROUTE_STRATEGIES) {
    if (route.pattern.test(url.pathname)) {
      return route.strategy
    }
  }
  return CACHE_STRATEGIES.NETWORK_FIRST
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached

    if (request.mode === "navigate") {
      return caches.match("/offline")
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return new Response("Asset unavailable offline", {
      status: 503,
      statusText: "Service Unavailable",
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || fetchPromise || new Response("Unavailable", { status: 503 })
}

// Install event - cache static assets
self.addEventListener("install", (event) => {
  log(`Installing version ${SW_VERSION}`)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).then(() => {
        log(`Precached ${STATIC_ASSETS.length} assets`)
      })
    }),
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  log(`Activating version ${SW_VERSION}`)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("zezamii-pass-") && name !== CACHE_NAME)
          .map((name) => {
            log(`Deleting old cache: ${name}`)
            return caches.delete(name)
          }),
      )
    }),
  )
  // Take control of all pages immediately
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Skip external resources
  if (!url.origin.includes(self.location.origin)) return

  const strategy = getStrategy(url)

  // Skip if no caching strategy (API routes)
  if (strategy === null) return

  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(request))
      break
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(request))
      break
    case CACHE_STRATEGIES.NETWORK_FIRST:
    default:
      event.respondWith(networkFirst(request))
      break
  }
})

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    log("Skip waiting triggered by app")
    self.skipWaiting()
  }

  if (event.data === "getVersion") {
    event.ports[0].postMessage({ version: SW_VERSION })
  }
})

self.addEventListener("error", (event) => {
  console.error("[SW] Error:", event.error)
})

self.addEventListener("unhandledrejection", (event) => {
  console.error("[SW] Unhandled rejection:", event.reason)
})
