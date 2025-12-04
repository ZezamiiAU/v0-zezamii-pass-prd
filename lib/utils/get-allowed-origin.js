/**
 * Get allowed origin for CORS headers
 * Returns the origin if allowed, otherwise returns empty string
 * @param {Request} request
 * @returns {string}
 */
export function getAllowedOrigin(request) {
  const origin = request.headers.get("origin") || ""

  // Allow localhost for development
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
    return origin
  }

  // Allow Vercel preview deployments
  if (origin.includes(".vercel.app") || origin.includes(".vusercontent.net")) {
    return origin
  }

  // Allow zezamii domains
  if (origin.endsWith(".zezamii.com") || origin === "https://zezamii.com") {
    return origin
  }

  // Allow configured app URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.APP_ORIGIN
  if (appUrl && origin === appUrl) {
    return origin
  }

  // Allow same-origin requests (no origin header)
  if (!origin) {
    return "*"
  }

  // Default: return empty string (block CORS)
  return ""
}
