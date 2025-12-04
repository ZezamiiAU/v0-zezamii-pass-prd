import { NextResponse } from "next/server"
import { getAllowedOrigin } from "./get-allowed-origin"

// Re-export for convenience
export { getAllowedOrigin }

/**
 * Default CORS headers builder
 * @param {Request} request
 * @param {string[]} [methods=["GET", "POST", "OPTIONS"]]
 * @returns {Record<string, string>}
 */
export function getCorsHeaders(request, methods = ["GET", "POST", "OPTIONS"]) {
  const allowedOrigin = getAllowedOrigin(request)
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  }
}

/**
 * Add CORS headers to existing headers object
 * @param {Record<string, string>} headers
 * @param {Request} request
 * @param {string[]} [methods]
 * @returns {Record<string, string>}
 */
export function withCors(headers, request, methods) {
  return {
    ...headers,
    ...getCorsHeaders(request, methods),
  }
}

/**
 * Create a NextResponse with CORS headers
 * @param {Request} request
 * @param {any} body
 * @param {{ status?: number, headers?: Record<string, string> }} [init]
 * @returns {NextResponse}
 */
export function corsResponse(request, body, init = {}) {
  const { status = 200, headers = {} } = init
  return NextResponse.json(body, {
    status,
    headers: withCors(headers, request),
  })
}

/**
 * Handle OPTIONS preflight request
 * @param {Request} request
 * @param {string[]} [methods]
 * @returns {NextResponse}
 */
export function optionsCors(request, methods) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, methods),
  })
}
