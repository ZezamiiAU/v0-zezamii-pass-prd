import { type NextRequest, NextResponse } from "next/server"

/**
 * Guard for dev-only endpoints that should not be accessible in production.
 *
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const devCheck = assertDevOnly(request);
 *   if (devCheck) return devCheck;
 *
 *   // ... your dev-only endpoint logic
 * }
 * ```
 */
export function assertDevOnly(request: NextRequest): NextResponse | null {
  // Block all access in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // In development, require either DEV_SECRET header or admin session
  const devSecret = request.headers.get("x-dev-secret")
  const expectedSecret = process.env.DEV_SECRET

  if (expectedSecret && devSecret === expectedSecret) {
    return null // Allow access
  }

  // TODO: Add admin session check here if needed
  // const session = await getSession(request);
  // if (session?.user?.role === 'admin') return null;

  return NextResponse.json({ error: "Unauthorized - dev-only endpoint requires x-dev-secret header" }, { status: 401 })
}
