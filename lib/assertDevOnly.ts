import { type NextRequest, NextResponse } from "next/server"
import { getServerAdminSession, checkAdminToken } from "@/lib/auth/admin"

export interface DevOnlyOptions {
  /** Require admin authentication even in dev mode */
  requireAdmin?: boolean
}

/**
 * Guard for dev-only endpoints that should not be accessible in production.
 *
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const devCheck = await assertDevOnly(request);
 *   if (devCheck) return devCheck;
 *
 *   // ... your dev-only endpoint logic
 * }
 * ```
 *
 * With admin requirement:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const devCheck = await assertDevOnly(request, { requireAdmin: true });
 *   if (devCheck) return devCheck;
 *
 *   // ... your admin-only endpoint logic
 * }
 * ```
 */
export async function assertDevOnly(request: NextRequest, options?: DevOnlyOptions): Promise<NextResponse | null> {
  const isDev = process.env.NODE_ENV !== "production"
  const isDevMode = process.env.PASS_DEV_MODE === "true"

  if (!isDev && !isDevMode) {
    // Return 404 to hide endpoint existence in production
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (options?.requireAdmin) {
    // Check for ADMIN_TOKEN header first (simpler for dev/testing)
    if (checkAdminToken(request)) {
      return null // Allow access
    }

    // Check for Supabase admin session
    const adminSession = await getServerAdminSession()
    if (adminSession) {
      return null // Allow access
    }

    // No valid admin authentication found
    return NextResponse.json(
      {
        error: "Unauthorized - admin authentication required",
        hint: "Provide Authorization: Bearer <ADMIN_TOKEN> header or authenticate as admin user",
      },
      { status: 401 },
    )
  }

  const devSecret = request.headers.get("x-dev-secret")
  const expectedSecret = process.env.DEV_SECRET

  if (expectedSecret && devSecret === expectedSecret) {
    return null // Allow access
  }

  // If DEV_SECRET is not set, allow unrestricted access in dev
  if (!expectedSecret && isDev) {
    return null
  }

  return NextResponse.json(
    {
      error: "Unauthorized - dev-only endpoint requires x-dev-secret header or admin authentication",
      hint: "Set x-dev-secret header or authenticate as admin",
    },
    { status: 401 },
  )
}
