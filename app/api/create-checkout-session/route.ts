import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createPass } from "@/lib/db/passes"
import { getPassTypeById } from "@/lib/db/pass-types"
import { createPayment } from "@/lib/db/payments"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/validation"
import logger from "@/lib/logger"
import { createCoreClient } from "@/lib/supabase/core-client"
import { ENV } from "@/lib/env"

// These will be initialized at runtime inside the handler

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  // Allow configured origins
  const allowedOrigins = [
    ENV.PUBLIC_BASE_URL,
    ENV.APP_ORIGIN,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
  ].filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    return origin
  }

  // Allow if origin matches the host (for Vercel deployments)
  if (origin && host && origin.includes(host)) {
    return origin
  }

  // Allow any Vercel deployment
  if (origin && origin.endsWith(".vercel.app")) {
    return origin
  }

  // Fallback to configured base URL or wildcard
  return ENV.PUBLIC_BASE_URL || "*"
}

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(request, 10, 60000)) {
      const headers = getRateLimitHeaders(request, 10)
      logger.warn({ ip: request.headers.get("x-forwarded-for") }, "Rate limit exceeded")
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
      logger.error("STRIPE_SECRET_KEY is missing")
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY)

    const body = await request.json()

    const validation = checkoutSchema.safeParse(body)
    if (!validation.success) {
      logger.warn({ errors: validation.error.errors }, "Validation failed")
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400, headers: corsHeaders },
      )
    }

    const { accessPointId, passTypeId, email, plate, phone, baseUrl: clientBaseUrl } = validation.data

    const coreClient = createCoreClient()

    const { data: device, error: deviceError } = await coreClient
      .from("devices")
      .select("id, floor_id")
      .eq("id", accessPointId)
      .single()

    if (deviceError || !device) {
      logger.error({ accessPointId, error: deviceError }, "Failed to fetch device")
      return NextResponse.json({ error: "Invalid access point ID" }, { status: 400, headers: corsHeaders })
    }

    const { data: floor, error: floorError } = await coreClient
      .from("floors")
      .select("id, building_id")
      .eq("id", device.floor_id)
      .single()

    if (floorError || !floor) {
      logger.error({ floorId: device.floor_id, error: floorError }, "Failed to fetch floor")
      return NextResponse.json({ error: "Access point configuration error" }, { status: 500, headers: corsHeaders })
    }

    const { data: building, error: buildingError } = await coreClient
      .from("buildings")
      .select("id, site_id")
      .eq("id", floor.building_id)
      .single()

    if (buildingError || !building) {
      logger.error({ buildingId: floor.building_id, error: buildingError }, "Failed to fetch building")
      return NextResponse.json({ error: "Access point configuration error" }, { status: 500, headers: corsHeaders })
    }

    const siteId = building.site_id

    if (!siteId) {
      logger.error({ buildingId: building.id }, "Building has no associated site")
      return NextResponse.json({ error: "Access point configuration error" }, { status: 500, headers: corsHeaders })
    }

    const passType = await getPassTypeById(passTypeId)
    if (!passType) {
      logger.warn({ passTypeId }, "Invalid pass type")
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400, headers: corsHeaders })
    }

    const { data: org, error: orgError } = await coreClient
      .from("organisations")
      .select("slug")
      .eq("id", passType.org_id)
      .single()

    if (orgError || !org || !org.slug) {
      logger.error({ orgId: passType.org_id, error: orgError }, "Failed to fetch organisation")
      return NextResponse.json({ error: "Organisation configuration error" }, { status: 500, headers: corsHeaders })
    }

    const pass = await createPass({
      passTypeId,
      vehiclePlate: plate || undefined,
      purchaserEmail: email || undefined,
      orgId: passType.org_id,
      deviceId: accessPointId,
      siteId,
    })

    if (!pass) {
      logger.error({ passTypeId, accessPointId }, "Failed to create pass")
      return NextResponse.json({ error: "Failed to create pass record" }, { status: 500, headers: corsHeaders })
    }

    const baseUrl = clientBaseUrl || ENV.PUBLIC_BASE_URL || `https://${request.headers.get("host") || "localhost:3000"}`

    const currency = passType.currency?.toLowerCase() || "aud"

    const lineItem = passType.stripe_price_id
      ? {
          price: passType.stripe_price_id,
          quantity: 1,
        }
      : {
          price_data: {
            currency,
            product_data: {
              name: passType.name,
              description: passType.description || undefined,
            },
            unit_amount: passType.price_cents,
          },
          quantity: 1,
        }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency,
      line_items: [lineItem],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/ap/${accessPointId}`,
      metadata: {
        org_slug: org.slug,
        product: "pass",
        variant: passType.code || "standard",
        pass_id: pass.id,
        access_point_id: accessPointId,
        gate_id: accessPointId, // Legacy support
        customer_email: email || "",
        customer_phone: phone || "",
        customer_plate: plate || "",
      },
      customer_email: email || undefined,
    })

    await createPayment({
      passId: pass.id,
      stripeCheckoutSession: session.id,
      amountCents: passType.price_cents,
      currency,
      status: "pending",
    })

    logger.info({ passId: pass.id, sessionId: session.id }, "Checkout session created")

    return NextResponse.json({ url: session.url }, { headers: corsHeaders })
  } catch (error) {
    logger.error({ error }, "Checkout error")

    const allowedOrigin = getAllowedOrigin(request)
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create checkout session",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500, headers: corsHeaders },
    )
  }
}
