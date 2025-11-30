import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // CSRF protection for state-changing API requests
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    // Exempt Stripe webhooks (verified by signature)
    if (request.nextUrl.pathname === "/api/webhooks/stripe") {
      return response
    }

    // Require custom header for API requests (prevents simple form POST)
    const hasCustomHeader =
      request.headers.get("x-requested-with") === "XMLHttpRequest" ||
      request.headers.get("content-type")?.includes("application/json")

    if (!hasCustomHeader) {
      return NextResponse.json({ error: "Missing required headers" }, { status: 403 })
    }

    const origin = request.headers.get("origin")
    const host = request.headers.get("host")

    if (origin) {
      const allowedOrigins = [
        process.env.PUBLIC_BASE_URL || "http://localhost:3000",
        process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
        process.env.APP_ORIGIN,
      ].filter(Boolean) as string[]

      // Check if origin matches any allowed origin
      const isAllowedOrigin = allowedOrigins.some((allowed) => origin === allowed)

      // Check if origin matches the current host (for Vercel preview deployments)
      const originHost = origin.replace(/^https?:\/\//, "")
      const isMatchingHost = host && originHost === host

      // Check if origin is a Vercel deployment URL
      const isVercelDeployment = origin.includes(".vercel.app")

      // Allow if any of these conditions are met
      if (!isAllowedOrigin && !isMatchingHost && !isVercelDeployment) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
      }
    }
  }

  return response
}

export const config = {
  matcher: ["/api/:path*"],
}
