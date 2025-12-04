import { NextResponse } from "next/server"
import Stripe from "stripe"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/schemas/api.schema"
import { safeValidateBody } from "@/lib/utils/validate-request"
import logger from "@/lib/logger"
import { getAllowedOrigin } from "@/lib/utils/cors"
import { ENV } from "@/lib/env"
import { getPassTypeById } from "@/lib/db/pass-types"
import { createPass } from "@/lib/db/passes"
import { createPayment } from "@/lib/db/payments"
import { getOrgContextFromDevice } from "@/lib/config/org-context"

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

    const serverEnv = ENV.server()
    if (!serverEnv.STRIPE_SECRET_KEY) {
      logger.error("[PaymentIntents] STRIPE_SECRET_KEY is missing")
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY)

    // Validate request body
    const validation = await safeValidateBody(request, checkoutSchema, corsHeaders)
    if (!validation.ok) {
      return validation.response
    }

    const { accessPointId, passTypeId, email, plate, phone } = validation.data

    const orgContext = await getOrgContextFromDevice(accessPointId)
    if (!orgContext) {
      logger.error({ accessPointId }, "[PaymentIntents] Could not resolve organization")
      return NextResponse.json({ error: "Invalid access point" }, { status: 400, headers: corsHeaders })
    }

    const passType = await getPassTypeById(passTypeId)
    if (!passType) {
      logger.error({ passTypeId }, "[PaymentIntents] Pass type not found")
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400, headers: corsHeaders })
    }

    if (!passType.price_cents || passType.price_cents <= 0) {
      logger.error({ passTypeId, price: passType.price_cents }, "[PaymentIntents] Invalid pricing")
      return NextResponse.json({ error: "Pass type has invalid pricing" }, { status: 400, headers: corsHeaders })
    }

    const passResult = await createPass({
      passTypeId,
      vehiclePlate: plate,
      purchaserEmail: email,
      orgId: orgContext.orgId,
      deviceId: accessPointId,
      siteId: orgContext.siteId,
    })

    if (!passResult.success) {
      logger.error({ passTypeId, error: passResult.error }, "[PaymentIntents] Failed to create pass")
      return NextResponse.json({ error: "Failed to create pass" }, { status: 500, headers: corsHeaders })
    }

    const pass = passResult.data

    // Get idempotency key
    const idempotencyKey = request.headers.get("X-Idempotency-Key") || `pi_${pass.id}_${Date.now()}`

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: passType.price_cents,
        currency: passType.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          passId: pass.id,
          passTypeId: passTypeId,
          accessPointId: accessPointId,
          orgId: orgContext.orgId,
          plate: plate || "",
          email: email || "",
          phone: phone || "",
        },
        receipt_email: email || undefined,
        description: `${passType.name} - ${orgContext.orgName || "Zezamii Pass"}`,
      },
      { idempotencyKey },
    )

    await createPayment({
      passId: pass.id,
      stripePaymentIntent: paymentIntent.id,
      amountCents: passType.price_cents,
      currency: passType.currency,
      status: "pending",
    })

    logger.info(
      { paymentIntentId: paymentIntent.id, passId: pass.id, passTypeId, orgId: orgContext.orgId },
      "[PaymentIntents] Payment intent created successfully",
    )

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        passId: pass.id,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, "Error creating payment intent")

    if (error.message.includes("Invalid pass type") || error.message.includes("invalid pricing")) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders })
    }

    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500, headers: corsHeaders },
    )
  }
}
