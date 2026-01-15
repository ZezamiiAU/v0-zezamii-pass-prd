import { type NextRequest, NextResponse } from "next/server"
import { ENV } from "@/lib/env"
import Stripe from "stripe"
import { createPass } from "@/lib/db/passes"
import { getPassTypeById } from "@/lib/db/pass-types"
import { createPayment } from "@/lib/db/payments"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/validation"
import logger from "@/lib/logger"
import { createCoreClient } from "@/lib/supabase/core-client"
import { generateSecurePin } from "@/lib/pin-generator"
import { createSchemaServiceClient } from "@/lib/supabase/server"

function getStripeClient() {
  const { STRIPE_SECRET_KEY } = ENV.server()
  return new Stripe(STRIPE_SECRET_KEY)
}

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  const allowedOrigins = [
    ENV.PUBLIC_BASE_URL,
    ENV.APP_ORIGIN,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
  ].filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    return origin
  }

  if (origin && host && origin.includes(host)) {
    return origin
  }

  if (origin && origin.endsWith(".vercel.app")) {
    return origin
  }

  return ENV.PUBLIC_BASE_URL || "*"
}

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(request, 10, 60000)) {
      const headers = getRateLimitHeaders(request, 10)
      headers["Retry-After"] = "60"
      logger.warn({ ip: request.headers.get("x-forwarded-for") }, "Rate limit exceeded")
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
    }

    const allowedOrigin = getAllowedOrigin(request)
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
      "Access-Control-Allow-Credentials": "true",
    }

    const body = await request.json()

    console.log("[v0] Payment intent request body:", JSON.stringify(body, null, 2))

    const validation = checkoutSchema.safeParse(body)
    if (!validation.success) {
      console.log("[v0] Validation failed:", JSON.stringify(validation.error.format(), null, 2))
      logger.warn({ errors: validation.error.errors }, "Validation failed")
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400, headers: corsHeaders },
      )
    }

    const { accessPointId, passTypeId, email, plate, phone } = validation.data

    const idempotencyKey = request.headers.get("x-idempotency-key") || undefined

    const coreClient = createCoreClient()

    const { data: device, error: deviceError } = await coreClient
      .from("devices")
      .select("id, site_id, floor_id")
      .eq("id", accessPointId)
      .single()

    if (deviceError || !device) {
      logger.error({ accessPointId, error: deviceError }, "Failed to fetch device")
      return NextResponse.json({ error: "Invalid access point ID" }, { status: 400, headers: corsHeaders })
    }

    let siteId: string | null = device.site_id || null

    if (!siteId && device.floor_id) {
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
        return NextResponse.json({ error: "Organisation configuration error" }, { status: 500, headers: corsHeaders })
      }

      siteId = building.site_id
    }

    if (!siteId) {
      logger.error({ deviceId: device.id }, "Device has no associated site")
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

    const now = new Date()
    const validFrom = now

    let durationHours = 24
    const passCode = passType.code?.toLowerCase()

    if (passCode === "day" || passCode === "day-pass") {
      durationHours = 12
    } else if (passCode === "camping") {
      durationHours = 24
    }

    const validTo = new Date(now.getTime() + durationHours * 60 * 60 * 1000)

    const pass = await createPass({
      passTypeId,
      vehiclePlate: plate || undefined,
      purchaserEmail: email || undefined,
      orgId: passType.org_id,
      deviceId: accessPointId,
      siteId,
      validFrom,
      validTo,
    })

    if (!pass) {
      logger.error({ passTypeId, accessPointId }, "Failed to create pass")
      return NextResponse.json({ error: "Failed to create pass record" }, { status: 500, headers: corsHeaders })
    }

    const pin = generateSecurePin(6)
    const passDb = createSchemaServiceClient("pass")

    const { error: lockCodeError } = await passDb.from("lock_codes").insert({
      pass_id: pass.id,
      code: pin,
      provider: "zezamii",
      starts_at: validFrom.toISOString(),
      ends_at: validTo.toISOString(),
    })

    if (lockCodeError) {
      logger.error({ passId: pass.id, error: lockCodeError }, "Failed to create lock code")
    }

    const customerIdentifier = email || phone || plate || "unknown"
    const events = createSchemaServiceClient("events")

    const currency = passType.currency?.toLowerCase() || "aud"

    await events.from("outbox").insert({
      topic: "pass.pass_paid.v1",
      payload: {
        org_id: passType.org_id,
        product: "pass",
        variant: passType.code || "standard",
        pass_id: pass.id,
        access_point_id: accessPointId,
        gate_id: accessPointId,
        pin_code: pin,
        starts_at: validFrom.toISOString(),
        ends_at: validTo.toISOString(),
        customer_identifier: customerIdentifier,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_plate: plate || null,
        provider: "stripe",
        provider_session_id: null,
        provider_intent_id: null,
        amount_cents: passType.price_cents,
        currency,
        occurred_at: new Date().toISOString(),
      },
    })

    const stripe = getStripeClient()

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: passType.price_cents,
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          org_slug: org.slug,
          product: "pass",
          variant: passType.code || "standard",
          pass_id: pass.id,
          access_point_id: accessPointId,
          gate_id: accessPointId,
          customer_email: email || "",
          customer_phone: phone || "",
          customer_plate: plate || "",
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    await createPayment({
      passId: pass.id,
      stripePaymentIntent: paymentIntent.id,
      amountCents: passType.price_cents,
      currency,
      status: "pending",
    })

    logger.info({ passId: pass.id, paymentIntentId: paymentIntent.id }, "Payment intent created")
    return NextResponse.json({ clientSecret: paymentIntent.client_secret }, { headers: corsHeaders })
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) },
      "Payment intent error",
    )

    const allowedOrigin = getAllowedOrigin(request)
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
      "Access-Control-Allow-Credentials": "true",
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create payment intent",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500, headers: corsHeaders },
    )
  }
}
