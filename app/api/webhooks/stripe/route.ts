import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { z } from "zod"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { ENV } from "@/lib/env"
import { createRoomsReservation, buildRoomsPayload } from "@/lib/integrations/rooms-event-hub"
import { sendPassNotifications } from "@/lib/notifications"

export const runtime = "nodejs"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

const Meta = z.object({
  org_slug: z.string().min(1),
  org_id: z.string().uuid().optional(),
  org_timezone: z.string().optional(),
  product: z.enum(["pass", "room"]),
  variant: z.string().optional(),
  pass_type_name: z.string().optional(),
  access_point_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
  site_slug: z.string().optional(),
  device_slug: z.string().optional(),
  gate_id: z.string().uuid().optional(),
  pass_id: z.string().uuid().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_plate: z.string().optional(),
  number_of_days: z.string().optional(),
  return_url: z.string().optional(),
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
  backup_pincode: z.string().optional(),
  backup_pincode_fortnight: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  const raw = Buffer.from(await req.arrayBuffer())
  let event: Stripe.Event
  try {
    const { STRIPE_WEBHOOK_SECRET } = ENV.server()
    if (!STRIPE_WEBHOOK_SECRET) {
      logger.error("STRIPE_WEBHOOK_SECRET is not configured")
      return NextResponse.json({ error: "Webhook configuration error" }, { status: 500 })
    }
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    logger.error({ error: e.message }, "Webhook signature verification failed")
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const passDb = createSchemaServiceClient("pass")
  const { data: existing } = await passDb.from("processed_webhooks").select("id").eq("event_id", event.id).single()

  if (existing) {
    logger.info({ eventId: event.id }, "Webhook already processed, skipping")
    return NextResponse.json({ received: true, duplicate: true })
  }

  await passDb.from("processed_webhooks").insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
  })

  if (event.type === "checkout.session.completed") {
    return handleCheckoutSessionCompleted(event)
  } else if (event.type === "payment_intent.succeeded") {
    return handlePaymentIntentSucceeded(event)
  } else if (event.type === "payment_intent.payment_failed") {
    return handlePaymentIntentFailed(event)
  }

  return NextResponse.json({ ok: true })
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  const meta = Meta.safeParse(session.metadata ?? {})
  if (!meta.success) {
    logger.warn({ issues: meta.error.issues }, "Invalid Stripe metadata")
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 })
  }

  const core = createSchemaServiceClient("core")
  const { data: org, error: orgErr } = await core
    .from("organisations")
    .select("id")
    .eq("slug", meta.data.org_slug)
    .single()

  if (orgErr || !org) {
    logger.error({ slug: meta.data.org_slug, orgErr }, "Unknown organisation")
    return NextResponse.json({ error: "Unknown organisation" }, { status: 400 })
  }

  const passDb = createSchemaServiceClient("pass")
  const amount = session.amount_total ?? 0
  const currency = (session.currency ?? "aud").toLowerCase()
  const intentId = String(session.payment_intent ?? "")
  const checkoutId = session.id

  const { data: pass } = await passDb
    .from("passes")
    .select("id, valid_from, valid_to")
    .eq("id", meta.data.pass_id!)
    .single()

  if (pass) {
    const { error: activateError } = await passDb
      .from("passes")
      .update({ status: "active" })
      .eq("id", pass.id)
      .eq("schema", "pass")

    if (activateError) {
      return NextResponse.json({ error: "Failed to activate pass", details: activateError.message }, { status: 500 })
    }
  }

  await passDb.from("payments").upsert(
    {
      pass_id: meta.data.pass_id ?? null,
      stripe_checkout_session: checkoutId,
      stripe_payment_intent: intentId,
      amount_cents: amount,
      currency,
      status: "succeeded",
    },
    { onConflict: "stripe_checkout_session" },
  )

  const startsAt = pass?.valid_from || new Date().toISOString()
  const endsAt = pass?.valid_to || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const customerEmail = meta.data.customer_email || "guest@example.com"
  const customerName = customerEmail.split("@")[0]

  const roomsResult = await createRoomsReservation(org.id, {
    propertyId: "z71owzgoNUxJtxOC",
    reservationId: meta.data.pass_id!, // Pass ID is used as reservation ID
    arrivalDate: new Date(startsAt).toISOString().split("T")[0],
    departureDate: new Date(endsAt).toISOString().split("T")[0],
    guestId: customerEmail, // Will be converted to UUID by generateGuestId if needed
    guestFirstName: customerName,
    guestLastName: customerEmail,
    guestEmail: customerEmail,
    guestPhone: meta.data.customer_phone ?? "",
    roomId: meta.data.access_point_id || meta.data.gate_id || "default-device",
    roomName: `${meta.data.org_slug}/site/device`,
    status: "Unconfirmed",
  })

  let pinCode = null

  if (roomsResult.success && roomsResult.pincode) {
    pinCode = roomsResult.pincode

    const { error: lockCodeError } = await passDb.from("lock_codes").insert({
      pass_id: meta.data.pass_id!,
      code: pinCode,
      provider: "rooms",
      provider_ref: roomsResult.reservationId,
      starts_at: startsAt,
      ends_at: endsAt,
    })

    if (lockCodeError) {
      logger.error({ passId: meta.data.pass_id, lockCodeError }, "Failed to store Rooms pincode")
    }
  } else {
    logger.error({ passId: meta.data.pass_id, error: roomsResult.error }, "Rooms API failed, using fallback pincode")

    const { data: existingCode } = await passDb
      .from("lock_codes")
      .select("code")
      .eq("pass_id", meta.data.pass_id!)
      .single()

    if (existingCode) {
      pinCode = existingCode.code
    }
  }

  if (pinCode) {
    // Send email notification with pincode
    if (meta.data.customer_email) {
      // Fetch access point name for the email
      let accessPointName = "Access Point"
      const accessPointId = meta.data.access_point_id || meta.data.gate_id
      if (accessPointId) {
        const { data: accessPoint } = await core
          .from("qr_ready_devices")
          .select("name")
          .eq("id", accessPointId)
          .single()
        if (accessPoint?.name) {
          accessPointName = accessPoint.name
        }
      }

      // Determine timezone - default to Australia/Sydney
      const timezone = "Australia/Sydney"

      try {
        await sendPassNotifications(
          meta.data.customer_email,
          meta.data.customer_phone || null,
          {
            accessPointName,
            pin: pinCode,
            validFrom: startsAt,
            validTo: endsAt,
            vehiclePlate: meta.data.customer_plate,
            orgName: org.name,
            orgSlug: org.slug,
            passType: meta.data.variant || "day",
            passTypeName: meta.data.pass_type_name || (meta.data.variant?.toLowerCase().includes("camping") ? "Camping Pass" : "Day Pass"),
            numberOfDays: meta.data.number_of_days ? Number.parseInt(meta.data.number_of_days, 10) : 1,
          },
          timezone,
        )
        logger.info(
          { passId: meta.data.pass_id, email: meta.data.customer_email },
          "Pass notification email sent successfully (checkout)",
        )
      } catch (emailError) {
        logger.error(
          { passId: meta.data.pass_id, email: meta.data.customer_email, emailError },
          "Failed to send pass notification email (checkout)",
        )
      }
    }

    const customerIdentifier =
      meta.data.customer_email || meta.data.customer_phone || meta.data.customer_plate || "unknown"

    const events = createSchemaServiceClient("events")
    await events.from("outbox").insert({
      topic: "pass.pass_paid.v1",
      payload: {
        org_id: org.id,
        product: meta.data.product,
        variant: meta.data.variant,
        pass_id: meta.data.pass_id,
        access_point_id: meta.data.access_point_id || meta.data.gate_id,
        gate_id: meta.data.gate_id,
        pin_code: pinCode,
        starts_at: startsAt,
        ends_at: endsAt,
        customer_identifier: customerIdentifier,
        customer_email: meta.data.customer_email || null,
        customer_phone: meta.data.customer_phone || null,
        customer_plate: meta.data.customer_plate || null,
        provider: "stripe",
        provider_session_id: checkoutId,
        provider_intent_id: intentId,
        amount_cents: amount,
        currency,
        occurred_at: new Date().toISOString(),
      },
    })
  }

  logger.info({ passId: meta.data.pass_id, eventId: event.id }, "Checkout session completed")
  return NextResponse.json({ received: true })
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  const meta = Meta.safeParse(paymentIntent.metadata ?? {})
  if (!meta.success) {
    logger.warn({ issues: meta.error.issues }, "Invalid Stripe metadata")
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 })
  }

  const core = createSchemaServiceClient("core")
  const { data: org, error: orgErr } = await core
    .from("organisations")
    .select("id")
    .eq("slug", meta.data.org_slug)
    .single()

  if (orgErr || !org) {
    logger.error({ slug: meta.data.org_slug, orgErr }, "Unknown organisation")
    return NextResponse.json({ error: "Unknown organisation" }, { status: 400 })
  }

  const passDb = createSchemaServiceClient("pass")
  const amount = paymentIntent.amount ?? 0
  const currency = (paymentIntent.currency ?? "aud").toLowerCase()
  const intentId = paymentIntent.id

  const { data: pass } = await passDb
    .from("passes")
    .select("id, valid_from, valid_to")
    .eq("id", meta.data.pass_id!)
    .single()

  if (pass) {
    const { error: activateError } = await passDb.from("passes").update({ status: "active" }).eq("id", pass.id)

    if (activateError) {
      logger.error({ passId: pass.id, activateError }, "Failed to activate pass")
    }
  }

  await passDb.from("payments").upsert(
    {
      pass_id: meta.data.pass_id ?? null,
      stripe_payment_intent: intentId,
      amount_cents: amount,
      currency,
      status: "succeeded",
    },
    { onConflict: "stripe_payment_intent" },
  )

  const startsAt = meta.data.valid_from || pass?.valid_from || new Date().toISOString()
  const endsAt = meta.data.valid_to || pass?.valid_to || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const accessPointId = meta.data.access_point_id || meta.data.gate_id
  const siteId = meta.data.site_id
  const slugPath = `${meta.data.org_slug}/${meta.data.site_slug || "site"}/${meta.data.device_slug || "device"}`

  let pinCode: string | null = null
  let pinProvider: "rooms" | "backup" = "rooms"

  const roomsPayload = buildRoomsPayload({
    siteId: siteId || "",
    passId: meta.data.pass_id!,
    validFrom: startsAt,
    validTo: endsAt,
    email: meta.data.customer_email || undefined,
    phone: meta.data.customer_phone || undefined,
    deviceId: accessPointId || "",
    slugPath,
  })

  const roomsResult = await createRoomsReservation(org.id, roomsPayload)

  if (roomsResult.success && roomsResult.pincode) {
    pinCode = roomsResult.pincode
    pinProvider = "rooms"
    logger.info({ passId: meta.data.pass_id, pinCode }, "Pincode received from Rooms webhook")
  } else {
    logger.warn(
      { passId: meta.data.pass_id, error: roomsResult.error },
      "Rooms webhook failed, using cached backup pincode from metadata",
    )

    if (meta.data.backup_pincode) {
      pinCode = meta.data.backup_pincode
      pinProvider = "backup"
      logger.info(
        { passId: meta.data.pass_id, pinCode, fortnight: meta.data.backup_pincode_fortnight },
        "Using cached backup pincode from payment metadata",
      )
    }
  }

  // Store lock code if we have a pincode
  if (pinCode) {
    const { error: lockCodeError } = await passDb.from("lock_codes").insert({
      pass_id: meta.data.pass_id!,
      code: pinCode,
      provider: pinProvider,
      starts_at: startsAt,
      ends_at: endsAt,
    })

    if (lockCodeError) {
      logger.error({ passId: meta.data.pass_id, lockCodeError }, "Failed to store pincode")
    }
  }

  // ALWAYS send email notification (even without pincode - customer can contact support)
  if (meta.data.customer_email) {
      // Fetch access point name and organization details for the email
      let accessPointName = "Access Point"
      let orgName = meta.data.org_slug
      let orgLogo: string | undefined
      let siteName: string | undefined
      
      // Fetch org details for branding
      const { data: orgDetails } = await core
        .from("organisations")
        .select("name, brand_settings")
        .eq("id", org.id)
        .single()
      
      if (orgDetails) {
        orgName = orgDetails.name
        // Parse brand_settings if it's a string
        let brandSettings = orgDetails.brand_settings
        if (typeof brandSettings === "string") {
          try { brandSettings = JSON.parse(brandSettings) } catch { brandSettings = null }
        }
        orgLogo = brandSettings?.logo_url
      }
      
      // Fetch site name
      if (siteId) {
        const { data: siteDetails } = await core
          .from("sites")
          .select("name")
          .eq("id", siteId)
          .single()
        if (siteDetails) {
          siteName = siteDetails.name
        }
      }
      
      if (accessPointId) {
        const { data: accessPoint } = await core
          .from("qr_ready_devices")
          .select("name")
          .eq("id", accessPointId)
          .single()
        if (accessPoint?.name) {
          accessPointName = accessPoint.name
        }
      }

      // Determine timezone from metadata or default to Australia/Sydney
      const timezone = meta.data.org_timezone || "Australia/Sydney"
      
      // Determine pass type
      const passType = meta.data.variant || "day"
      const passTypeName = meta.data.pass_type_name || (passType.toLowerCase().includes("camping") ? "Camping Pass" : "Day Pass")
      const numberOfDays = Number.parseInt(meta.data.number_of_days || "1", 10)

      try {
        await sendPassNotifications(
          meta.data.customer_email,
          meta.data.customer_phone || null,
          {
            accessPointName,
            pin: pinCode,
            validFrom: startsAt,
            validTo: endsAt,
            vehiclePlate: meta.data.customer_plate,
            orgName,
            orgSlug: meta.data.org_slug,
            orgLogo,
            siteName,
            passType,
            passTypeName,
            numberOfDays,
          },
          timezone,
        )
        logger.info(
          { passId: meta.data.pass_id, email: meta.data.customer_email, pinProvider, hasPin: !!pinCode },
          "Pass notification email sent successfully",
        )
      } catch (emailError) {
        logger.error(
          { passId: meta.data.pass_id, email: meta.data.customer_email, emailError },
          "Failed to send pass notification email",
        )
      }
    }

  const customerIdentifier =
    meta.data.customer_email || meta.data.customer_phone || meta.data.customer_plate || "unknown"

  const events = createSchemaServiceClient("events")
  await events.from("outbox").insert({
    topic: "pass.pass_paid.v1",
    payload: {
      org_id: org.id,
      product: meta.data.product,
      variant: meta.data.variant,
      pass_id: meta.data.pass_id,
      access_point_id: accessPointId,
      gate_id: meta.data.gate_id,
      pin_code: pinCode,
      pin_provider: pinProvider,
      starts_at: startsAt,
      ends_at: endsAt,
      customer_identifier: customerIdentifier,
      customer_email: meta.data.customer_email || null,
      customer_phone: meta.data.customer_phone || null,
      customer_plate: meta.data.customer_plate || null,
      provider: "stripe",
      provider_intent_id: intentId,
      amount_cents: amount,
      currency,
      number_of_days: Number.parseInt(meta.data.number_of_days || "1", 10),
      occurred_at: new Date().toISOString(),
    },
  })

  logger.info({ passId: meta.data.pass_id, eventId: event.id, pinProvider }, "Payment intent succeeded")
  return NextResponse.json({ received: true })
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const meta = Meta.safeParse(paymentIntent.metadata ?? {})

  if (!meta.success || !meta.data.pass_id) {
    logger.warn({ issues: meta.error?.issues }, "Invalid metadata in failed payment")
    return NextResponse.json({ received: true })
  }

  const passDb = createSchemaServiceClient("pass")

  const { error: deleteLockCodeError } = await passDb
    .from("lock_codes")
    .delete()
    .eq("pass_id", meta.data.pass_id)
    .eq("schema", "pass")

  if (!deleteLockCodeError) {
  }

  await passDb.from("passes").update({ status: "cancelled" }).eq("id", meta.data.pass_id)

  await passDb.from("payments").update({ status: "failed" }).eq("stripe_payment_intent", paymentIntent.id)

  logger.info({ passId: meta.data.pass_id, eventId: event.id }, "Payment failed - lock code deleted")
  return NextResponse.json({ received: true })
}
