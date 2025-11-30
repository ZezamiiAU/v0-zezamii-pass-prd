/**
 * Next.js 15 Route Handler Parameter Types
 *
 * ⚠️ IMPORTANT: In Next.js 15, route handler params are SYNCHRONOUS objects.
 *
 * ❌ DO NOT type params as Promise:
 *    { params }: { params: Promise<{ id: string }> }
 *
 * ❌ DO NOT await params:
 *    const { id } = await params
 *
 * ✅ CORRECT usage:
 *    { params }: { params: { id: string } }
 *    const { id } = params
 *
 * These types enforce the correct pattern for route handlers.
 */

export type AccessPointRouteParams = {
  accessPointId: string
}

export type PassRouteParams = {
  passId: string
}

export type SubscriptionRouteParams = {
  id: string
}

/**
 * Generic route params type for custom dynamic routes
 */
export type RouteParams<T extends Record<string, string>> = T

/**
 * Next.js 15 Route Handler Context
 * Second parameter to route handlers (GET, POST, etc.)
 */
export type RouteContext<T extends Record<string, string>> = {
  params: T
}
