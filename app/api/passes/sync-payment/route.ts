import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { validateBody, handleValidationError } from "@/lib/utils/validate-request"
import { syncPaymentBodySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"
import { ENV } from "@/lib/env"
import { createRoomsReservation, buildRoomsPayload } from "@/lib/integrations/rooms-event-hub"
import { sendPassNotifications } from "@/lib/notifications"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(req: NextRequest) {
  console.log("[v0] sync-payment: POST called")
  try {
    const { paymentIntentId } = await validateBody(req, syncPaymentBodySchema)
    console.log("[v0] sync-payment: paymentIntentId =", paymentIntentId)

    // Fetch the payment intent from Stripe to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {
          error: "Payment not yet succeeded",
          status: paymentIntent.status,
        },
        { status: 400 },
      )
    }

    // Get metadata
    const meta = paymentIntent.metadata
    const passId = meta.pass_id
    const accessPointId = meta.access_point_id // Declare accessPointId variable

    if (!passId) {
      return NextResponse.json({ error: "No pass ID in payment metadata" }, { status: 400 })
    }

    const passDb = createSchemaServiceClient("pass")

    // Check if pass is already active
    const { data: existingPass } = await passDb.from("passes").select("status").eq("id", passId).maybeSingle()

    if (existingPass?.status === "active") {
      console.log("[v0] sync-payment: Pass already active, returning early")
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    // Check if lock code already exists
    const { data: existingLockCode } = await passDb.from("lock_codes").select("id, code").eq("pass_id", passId).maybeSingle()
    console.log("[v0] sync-payment: existingLockCode =", existingLockCode)

    if (!existingLockCode) {
      console.log("[v0] sync-payment: No existing lock code, generating new one")
      // Need to generate pincode - try Rooms first, then backup
      const { data: pass } = await passDb
        .from("passes")
        .select("id, valid_from, valid_to, org_id")
        .eq("id", passId)
        .maybeSingle()

      if (!pass) {
        return NextResponse.json({ error: "Pass not found" }, { status: 404 })
      }

      const now = new Date()
      const startsAt = pass.valid_from || now.toISOString()
      const endsAt = pass.valid_to || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

      let pinCode: string | null = null
      let pinProvider: "rooms" | "backup" = "rooms"

      // Try Rooms endpoint first
      const slugPath = `${meta.org_slug || "org"}/${meta.site_slug || "site"}/${meta.device_slug || "device"}`

      const roomsPayload = buildRoomsPayload({
        siteId: meta.site_id || "",
        passId: passId,
        validFrom: startsAt,
        validTo: endsAt,
        fullName: meta.customer_name || undefined,
        email: meta.customer_email || undefined,
        phone: meta.customer_phone || undefined,
        slugPath,
        status: "Confirmed",
      })

      const roomsResult = await createRoomsReservation(pass.org_id, roomsPayload)

      // Note: Rooms API does NOT return pincode - PIN arrives async via Portal webhook
      if (roomsResult.success) {
        logger.info({ passId }, "Rooms reservation confirmed, PIN will arrive via Portal webhook (sync-payment)")
      } else {
        logger.warn({ passId, error: roomsResult.error }, "Rooms call failed (sync-payment)")
      }

      // Use backup pincode from metadata - PIN from Rooms will be fetched later via by-session polling
      if (meta.backup_pincode) {
        pinCode = meta.backup_pincode
        pinProvider = "backup"
        logger.info({ passId, pinCode }, "Using backup pincode from metadata (sync-payment)")
      } else {
        // No backup pincode available - fail
        logger.error({ passId }, "No backup pincode available")
        return NextResponse.json({ error: "Unable to generate access code" }, { status: 503 })
      }

      // Store the pincode (use upsert to handle race conditions)
      const { error: insertError } = await passDb
        .from("lock_codes")
        .upsert(
          {
            pass_id: pass.id,
            code: pinCode,
            provider: pinProvider,
            starts_at: startsAt,
            ends_at: endsAt,
          },
          { onConflict: "pass_id" },
        )

      if (insertError && !insertError.message.includes("duplicate")) {
        logger.error({ passId, insertError }, "Failed to store lock code")
      }

      // Send email notification with pincode
      console.log("[v0] sync-payment: Checking email condition", { customer_email: meta.customer_email, pinCode })
      if (meta.customer_email && pinCode) {
        // Get access point name
        let accessPointName = "Access Point"
        if (accessPointId) {
          const coreDb = createSchemaServiceClient("core")
          const { data: device } = await coreDb.from("qr_ready_devices").select("name").eq("id", accessPointId).single()
          if (device?.name) {
            accessPointName = device.name
          }
        }

        const timezone = "Australia/Sydney"

        try {
          console.log("[v0] sync-payment: Sending email notification", {
            email: meta.customer_email,
            pinCode,
            pinProvider,
          })
          await sendPassNotifications(
            meta.customer_email,
            meta.customer_phone || null,
            {
              accessPointName,
              pin: pinCode,
              validFrom: startsAt,
              validTo: endsAt,
              vehiclePlate: meta.customer_plate,
            },
            timezone,
          )
          logger.info({ passId, email: meta.customer_email, pinProvider }, "Pass notification email sent (sync-payment)")
        } catch (emailError) {
          logger.error({ passId, email: meta.customer_email, emailError }, "Failed to send email (sync-payment)")
        }
      }
    }

    // Update pass status to active
    await passDb.from("passes").update({ status: "active" }).eq("id", passId)

    // Update payment status
    await passDb.from("payments").update({ status: "succeeded" }).eq("stripe_payment_intent", paymentIntentId)

    logger.info({ passId, paymentIntentId }, "Payment synced manually (webhook fallback)")

    return NextResponse.json({ success: true, passId, status: "active" })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Payment sync failed")
    return NextResponse.json({ error: "Failed to sync payment" }, { status: 500 })
  }
}
