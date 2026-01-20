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
import { getBackupPincode } from "@/lib/db/backup-pincodes"

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

    const validation = checkoutSchema.safeParse(body)
    if (!validation.success) {
      logger.warn({ errors: validation.error.errors }, "Validation failed")
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400, headers: corsHeaders },
      )
    }

    const { accessPointId, passTypeId, email, plate, phone, numberOfDays = 1 } = validation.data

    const idempotencyKey = request.headers.get("x-idempotency-key") || undefined

    const coreClient = createCoreClient()

    const { data: device, error: deviceError } = await coreClient
      .from("devices")
      .select("id, site_id, floor_id, slug")
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

    const { data: site } = await coreClient.from("sites").select("slug").eq("id", siteId).single()

    const siteSlug = site?.slug || null

    const passType = await getPassTypeById(passTypeId)
    if (!passType) {
      logger.warn({ passTypeId }, "Invalid pass type")
      return NextResponse.json({ error: "Invalid pass type" }, { status: 400, headers: corsHeaders })
    }

    const { data: org, error: orgError } = await coreClient
      .from("organisations")
      .select("id, slug")
      .eq("id", passType.org_id)
      .single()

    if (orgError || !org || !org.slug) {
      logger.error({ orgId: passType.org_id, error: orgError }, "Failed to fetch organisation")
      return NextResponse.json({ error: "Organisation configuration error" }, { status: 500, headers: corsHeaders })
    }

    const now = new Date()
    const validFrom = now

    const passCode = passType.code?.toLowerCase()
    const isCampingPass = passCode === "camping" || passType.name?.toLowerCase().includes("camping")

    let validTo: Date
    if (isCampingPass) {
      // Camping pass: ends at 10:00 AM AEDT on the last day
      validTo = new Date(now)
      validTo.setDate(validTo.getDate() + numberOfDays - 1)
      // 10:00 AM AEDT = 23:00 UTC previous day (AEDT is UTC+11)
      validTo.setUTCHours(23, 0, 0, 0)
      validTo.setDate(validTo.getDate() - 1)
    } else {
      // Day pass: ends at 11:59 PM AEDT same day
      validTo = new Date(now)
      // 11:59 PM AEDT = 12:59 UTC same day (AEDT is UTC+11)
      validTo.setUTCHours(12, 59, 59, 999)
    }

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

    const slugPath = `${org.slug}/${siteSlug || "site"}/${device.slug || "device"}`

    let backupPincode = ""
    let backupFortnightNumber = ""
    try {
      const backupPin = await getBackupPincode(passType.org_id, siteId, accessPointId)
      if (backupPin) {
        backupPincode = backupPin.pincode
        backupFortnightNumber = String(backupPin.fortnight_number)
        logger.info(
          { backupPincode: backupPin.pincode, fortnight: backupPin.fortnight_number },
          "Backup pincode cached for payment",
        )
      } else {
        logger.warn(
          { orgId: passType.org_id, siteId, accessPointId },
          "No backup pincode available - will rely on Rooms",
        )
      }
    } catch (backupError) {
      logger.warn({ error: backupError }, "Failed to fetch backup pincode - will rely on Rooms")
    }

    const currency = passType.currency?.toLowerCase() || "aud"
    const totalAmountCents = isCampingPass ? passType.price_cents * numberOfDays : passType.price_cents

    const stripe = getStripeClient()

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountCents,
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          org_slug: org.slug,
          org_id: passType.org_id,
          product: "pass",
          variant: passType.code || "standard",
          pass_id: pass.id,
          access_point_id: accessPointId,
          site_id: siteId,
          site_slug: siteSlug || "",
          device_slug: device.slug || "",
          gate_id: accessPointId,
          customer_email: email || "",
          customer_phone: phone || "",
          customer_plate: plate || "",
          number_of_days: String(isCampingPass ? numberOfDays : 1),
          return_url: `/p/${slugPath}`,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          backup_pincode: backupPincode,
          backup_pincode_fortnight: backupFortnightNumber,
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    await createPayment({
      passId: pass.id,
      stripePaymentIntent: paymentIntent.id,
      amountCents: totalAmountCents,
      currency,
      status: "pending",
    })

    logger.info(
      { passId: pass.id, paymentIntentId: paymentIntent.id, numberOfDays, totalAmountCents },
      "Payment intent created - pincode will be generated after payment succeeds",
    )
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
