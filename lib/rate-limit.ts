import type { NextRequest } from "next/server"

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number; burstCount: number; burstResetAt: number }
}

const store: RateLimitStore = {}

export function rateLimit(request: NextRequest, maxRequests: number, windowMs: number): boolean {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const key = `${ip}-${request.nextUrl.pathname}`
  const now = Date.now()

  // Burst limit: 3 requests per second
  const burstLimit = 3
  const burstWindow = 1000

  if (!store[key]) {
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
      burstCount: 1,
      burstResetAt: now + burstWindow,
    }
    return true
  }

  // Check burst limit
  if (store[key].burstResetAt < now) {
    store[key].burstCount = 1
    store[key].burstResetAt = now + burstWindow
  } else {
    if (store[key].burstCount >= burstLimit) {
      return false
    }
    store[key].burstCount++
  }

  // Check sustained limit
  if (store[key].resetAt < now) {
    store[key].count = 1
    store[key].resetAt = now + windowMs
    return true
  }

  if (store[key].count >= maxRequests) {
    return false
  }

  store[key].count++
  return true
}

export function getRateLimitHeaders(request: NextRequest, maxRequests: number): Record<string, string> {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const key = `${ip}-${request.nextUrl.pathname}`
  const entry = store[key]

  if (!entry) {
    return {
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": maxRequests.toString(),
    }
  }

  return {
    "X-RateLimit-Limit": maxRequests.toString(),
    "X-RateLimit-Remaining": Math.max(0, maxRequests - entry.count).toString(),
    "X-RateLimit-Reset": new Date(entry.resetAt).toISOString(),
  }
}
