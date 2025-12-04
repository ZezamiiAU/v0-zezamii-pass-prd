import { NextResponse } from "next/server"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/schemas/api.schema"
import { safeValidateBody } from "@/lib/utils/validate-request"
import logger from "@/lib/logger"
import { getAllowedOrigin } from "@/lib/utils/cors"
import { createPaymentIntentService } from "@/lib/payments/payments.service"
import { getIdempotencyKey } from "@/lib/http/idempotency"

export async function OPTIONS(request) {
  const allowedOrigin = getAllowedOrigin(request)
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  })
}

export async function POST(request) {
  const allowedOrigin = getAllowedOrigin(request)
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
    "Access-Control-Allow-Credentials": "true",
  }

  try {
    // Rate limiting
    if (!rateLimit(request, 10, 60000)) {
      const headers = { ...corsHeaders, ...getRateLimitHeaders(request, 10), "Retry-After": "60" }
      logger.warn({ ip: request.headers.get("x-forwarded-for") }, "Rate limit exceeded")
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
    }

    let body
    try {
      body = await request.clone().json()
      console.log("[v0] payment-intents request body:", JSON.stringify(body))
    } catch (e) {
      console.log("[v0] Failed to parse request body:", e.message)
    }

    // Validate request body
    const validation = await safeValidateBody(request, checkoutSchema, corsHeaders)
    if (!validation.ok) {
      console.log("[v0] Validation failed:", validation.response)
      return validation.response
    }

    const { accessPointId, passTypeId, email, plate, phone } = validation.data
    console.log("[v0] Validated data:", { accessPointId, passTypeId, email, plate, phone })

    // Get idempotency key for Stripe
    const idempotencyKey = getIdempotencyKey(request, { accessPointId, passTypeId, email, plate, phone })

    console.log("[v0] Calling createPaymentIntentService...")

    // Create payment intent via service
    const result = await createPaymentIntentService({ accessPointId, passTypeId, email, plate, phone }, idempotencyKey)

    console.log("[v0] Payment intent created:", result)
    logger.info({ passTypeId, accessPointId }, "Payment intent created successfully")

    return NextResponse.json(result, { status: 200, headers: corsHeaders })
  } catch (error) {
    console.log("[v0] Error in payment-intents:", error.message)
    console.log("[v0] Error stack:", error.stack)
    logger.error({ error: error.message, stack: error.stack }, "Error creating payment intent")

    // Handle specific error types
    if (error.message.includes("Invalid pass type") || error.message.includes("invalid pricing")) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders })
    }

    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500, headers: corsHeaders },
    )
  }
}
