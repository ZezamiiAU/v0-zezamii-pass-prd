import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { validateBody, handleValidationError } from "@/lib/utils/validate-request"
import { syncPaymentBodySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"
import { ENV } from "@/lib/env"
import { createRoomsReservation, buildRoomsPayload } from "@/lib/integrations/rooms-event-hub"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await validateBody(req, syncPaymentBodySchema)

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

    if (!passId) {
      return NextResponse.json({ error: "No pass ID in payment metadata" }, { status: 400 })
    }

    const passDb = createSchemaServiceClient("pass")

    // Check if pass is already active
    const { data: existingPass } = await passDb.from("passes").select("status").eq("id", passId).maybeSingle()

    if (existingPass?.status === "active") {
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    // Check if lock code already exists
    const { data: existingLockCode } = await passDb.from("lock_codes").select("id, code").eq("pass_id", passId).maybeSingle()

    if (!existingLockCode) {
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
      const accessPointId = meta.access_point_id || meta.gate_id
      const slugPath = `${meta.org_slug || "org"}/${meta.site_slug || "site"}/${meta.device_slug || "device"}`

      const roomsPayload = buildRoomsPayload({
        siteId: meta.site_id || "",
        passId: passId,
        validFrom: startsAt,
        validTo: endsAt,
        email: meta.customer_email || undefined,
        phone: meta.customer_phone || undefined,
        deviceId: accessPointId || "",
        slugPath,
      })

      const roomsResult = await createRoomsReservation(pass.org_id, roomsPayload)

      if (roomsResult.success && roomsResult.pincode) {
        pinCode = roomsResult.pincode
        pinProvider = "rooms"
        logger.info({ passId, pinCode }, "Pincode received from Rooms webhook (sync-payment)")
      } else {
        // Use backup pincode from metadata
        if (meta.backup_pincode) {
          pinCode = meta.backup_pincode
          pinProvider = "backup"
          logger.info({ passId, pinCode }, "Using backup pincode from metadata (sync-payment)")
        } else {
          // No pincode available - fail
          logger.error({ passId }, "No pincode available - both Rooms and backup failed")
          return NextResponse.json({ error: "Unable to generate access code" }, { status: 503 })
        }
      }

      // Store the pincode (use upsert to handle race conditions)
      const { error: insertError } = await passDb.from("lock_codes").upsert({
        pass_id: pass.id,
        code: pinCode,
        provider: pinProvider,
        starts_at: startsAt,
        ends_at: endsAt,
      }, { onConflict: "pass_id" })
      
      if (insertError && !insertError.message.includes("duplicate")) {
        logger.error({ passId, insertError }, "Failed to store lock code")
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
