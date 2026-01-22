import { type NextRequest, NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { sendPassNotifications } from "@/lib/notifications"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import logger from "@/lib/logger"
import { getLockCodeByPassId } from "@/lib/db/lock-codes"

/**
 * POST /api/passes/send-confirmation
 * 
 * Called by the success page after the PIN countdown completes to send
 * the confirmation email with the correct PIN (Rooms or backup).
 * 
 * This ensures the email is sent with the final PIN, not a potentially
 * incorrect backup PIN that would be replaced by the Rooms PIN.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(request, 5, 60000)) {
    const headers = getRateLimitHeaders(request, 5)
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers })
  }

  try {
    const body = await request.json()
    const { passId, pin, pinSource } = body

    if (!passId) {
      return NextResponse.json({ error: "passId is required" }, { status: 400 })
    }

    if (!pin) {
      return NextResponse.json({ error: "pin is required" }, { status: 400 })
    }

    const passDb = createSchemaServiceClient("pass")
    const coreDb = createSchemaServiceClient("core")

    // Get pass details
    const { data: pass, error: passError } = await passDb
      .from("passes")
      .select("id, device_id, valid_from, valid_to, status")
      .eq("id", passId)
      .single()

    if (passError || !pass) {
      logger.warn({ passId }, "Pass not found for confirmation email")
      return NextResponse.json({ error: "Pass not found" }, { status: 404 })
    }

    // Get payment with customer details
    const { data: payment, error: paymentError } = await passDb
      .from("payments")
      .select("metadata")
      .eq("pass_id", passId)
      .single()

    if (paymentError || !payment?.metadata) {
      logger.warn({ passId }, "Payment not found for confirmation email")
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    const meta = payment.metadata as Record<string, unknown>
    const customerEmail = meta.customer_email as string | undefined
    const customerPhone = meta.customer_phone as string | undefined

    if (!customerEmail) {
      logger.warn({ passId }, "No email address for confirmation")
      return NextResponse.json({ error: "No email address" }, { status: 400 })
    }

    // Check if email was already sent for this pass
    const { data: existingEmail } = await passDb
      .from("lock_codes")
      .select("email_sent_at")
      .eq("pass_id", passId)
      .maybeSingle()

    if (existingEmail?.email_sent_at) {
      logger.info({ passId, email: customerEmail }, "Confirmation email already sent")
      return NextResponse.json({ success: true, alreadySent: true })
    }

    // Get device/access point info
    let accessPointName = "Access Point"
    if (pass.device_id) {
      const { data: device } = await coreDb
        .from("devices")
        .select("name")
        .eq("id", pass.device_id)
        .single()
      if (device?.name) {
        accessPointName = device.name
      }
    }

    // Get org info from metadata
    const orgSlug = meta.org_slug as string | undefined
    const orgName = meta.org_name as string | undefined
    const timezone = (meta.org_timezone as string) || "Australia/Sydney"
    const passType = (meta.variant as string) || "day"
    const passTypeName = (meta.pass_type_name as string) || (passType.toLowerCase().includes("camping") ? "Camping Pass" : "Day Pass")
    const numberOfDays = Number.parseInt((meta.number_of_days as string) || "1", 10)

    // Send the email with the final PIN
    await sendPassNotifications(
      customerEmail,
      customerPhone || null,
      {
        accessPointName,
        pin,
        validFrom: pass.valid_from,
        validTo: pass.valid_to,
        vehiclePlate: meta.customer_plate as string | undefined,
        orgName,
        orgSlug,
        passType,
        passTypeName,
        numberOfDays,
      },
      timezone,
    )

    // Mark email as sent
    await passDb
      .from("lock_codes")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("pass_id", passId)

    logger.info(
      { passId, email: customerEmail, pinSource },
      "Confirmation email sent successfully",
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error }, "Failed to send confirmation email")
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
