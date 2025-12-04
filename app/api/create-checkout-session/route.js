import { NextResponse } from "next/server"
import Stripe from "stripe"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/schemas/api.schema"
import { safeValidateBody } from "@/lib/utils/validate-request"
import logger from "@/lib/logger"
import { ENV } from "@/lib/env"
import { getAllowedOrigin } from "@/lib/utils/get-allowed-origin"
import { getPassTypeById } from "@/lib/db/pass-types"
import { createPass } from "@/lib/db/passes"
import { createPayment } from "@/lib/db/payments"
import { resolveOrgFromAccessPoint } from "@/lib/config/org-context"

export async function OPTIONS(request) {
  const allowedOrigin = getAllowedOrigin(request)
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}

export async function POST(request) {
  try {
    // Rate limiting
    if (!rateLimit(request, 10, 60000)) {
      const headers = getRateLimitHeaders(request, 10)
      logger.warn({ ip: request.headers.get("x-forwarded-for") }, "[Checkout] Rate limit exceeded")
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
    }

    const allowedOrigin = getAllowedOrigin(request)
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    }

    const serverEnv = ENV.server()
    if (!serverEnv.STRIPE_SECRET_KEY) {
      logger.error("[Checkout] STRIPE_SECRET_KEY is missing")
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY)

    // Validate request body
    const validation = await safeValidateBody(request, checkoutSchema, corsHeaders)
    if (!validation.ok) return validation.response

    const { accessPointId, passTypeId, email, plate, phone, baseUrl: clientBaseUrl } = validation.data

    // Resolve organization from access point
    const orgContext = await resolveOrgFromAccessPoint(accessPointId)
    if (!orgContext) {
      logger.error({ accessPointId }, "[Checkout] Could not resolve organization")
      return NextResponse.json({ error: "Invalid access point" }, { status: 400, headers: corsHeaders })
    }

    // Get pass type with pricing
    const passType = await getPassTypeById(passTypeId)
    if (!passType) {
      logger.error({ passTypeId }, "[Checkout] Pass type not found")
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400, headers: corsHeaders })
    }

    if (!passType.price_cents || passType.price_cents <= 0) {
      logger.error({ passTypeId, price: passType.price_cents }, "[Checkout] Invalid pass type pricing")
      return NextResponse.json({ error: "Pass type has invalid pricing" }, { status: 400, headers: corsHeaders })
    }

    // Create pending pass
    const passResult = await createPass({
      passTypeId,
      vehiclePlate: plate,
      purchaserEmail: email,
      orgId: orgContext.org_id,
      deviceId: accessPointId,
      siteId: orgContext.site_id,
    })

    if (!passResult.success) {
      logger.error({ passTypeId, error: passResult.error }, "[Checkout] Failed to create pass")
      return NextResponse.json({ error: "Failed to create pass" }, { status: 500, headers: corsHeaders })
    }

    const pass = passResult.data

    // Build line items - use Stripe Price ID if available, otherwise use price_data
    const lineItems = passType.stripe_price_id
      ? [{ price: passType.stripe_price_id, quantity: 1 }]
      : [
          {
            price_data: {
              currency: passType.currency.toLowerCase(),
              product_data: {
                name: passType.name,
                description: passType.description || `${passType.name} - ${passType.duration_minutes} minutes`,
              },
              unit_amount: passType.price_cents,
            },
            quantity: 1,
          },
        ]

    // Determine success/cancel URLs
    const baseUrl = clientBaseUrl || serverEnv.APP_ORIGIN || "https://zezamii-pass.vercel.app"

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: email || undefined,
      metadata: {
        passId: pass.id,
        passTypeId: passTypeId,
        accessPointId: accessPointId,
        orgId: orgContext.org_id,
        plate: plate || "",
        email: email || "",
        phone: phone || "",
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    })

    // Create payment record
    await createPayment({
      passId: pass.id,
      stripeCheckoutSession: session.id,
      amountCents: passType.price_cents,
      currency: passType.currency,
      status: "pending",
    })

    logger.info(
      { sessionId: session.id, passId: pass.id, passTypeId, orgId: orgContext.org_id },
      "[Checkout] Session created successfully",
    )

    return NextResponse.json(
      {
        sessionId: session.id,
        url: session.url,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, "[Checkout] Failed to create checkout session")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
